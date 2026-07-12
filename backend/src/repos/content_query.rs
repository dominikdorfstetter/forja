//! Shared JOIN / pagination builder for content entities.
//!
//! Bounds the recurring pattern used by blog/page/legal/document/cv/project:
//! `entity_table ⋈ contents ⋈ content_sites`, optionally joining
//! `content_localizations` and/or `content_categories ⋈ categories`,
//! filtered by site, locale, category slug, status set, and the standard
//! "published" gate (status IN ('published','scheduled') with publish_start /
//! publish_end window).
//!
//! All user-supplied values are bound via sqlx parameters; the only string
//! interpolated into SQL is the table name, which is an internal API
//! contract (callers pass a hard-coded string).

use sqlx::postgres::PgRow;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

use crate::errors::ApiError;
use crate::utils::list_params::order_clause;

/// A free-text search: a single bound term ILIKE-matched against a fixed set
/// of hard-coded columns (entity or content). The term is bound once and
/// referenced by every column fragment.
struct Search {
    columns: &'static [&'static str],
    term: String,
}

/// Map a content status — accepted either as the API/serde PascalCase name
/// (`"Published"`) or as the Postgres enum text (`"published"`) — to the
/// canonical lowercase enum text. Returns `None` for unrecognised values so the
/// caller can reject them. Accepting both forms keeps existing callers that
/// already pass enum text working while letting handlers pass the raw API value
/// straight through (#861).
fn normalize_status(raw: &str) -> Option<&'static str> {
    match raw {
        "Draft" | "draft" => Some("draft"),
        "InReview" | "in_review" => Some("in_review"),
        "Scheduled" | "scheduled" => Some("scheduled"),
        "Published" | "published" => Some("published"),
        "Archived" | "archived" => Some("archived"),
        _ => None,
    }
}

/// A bound value for a generic entity-equality predicate. `ContentQuery` only
/// understands these primitive shapes — never a domain enum — so it stays
/// decoupled from any one entity's types (callers cast/normalize to text first).
#[derive(Clone)]
pub enum FilterValue {
    Text(String),
    Bool(bool),
}

impl From<bool> for FilterValue {
    fn from(b: bool) -> Self {
        FilterValue::Bool(b)
    }
}

impl From<String> for FilterValue {
    fn from(s: String) -> Self {
        FilterValue::Text(s)
    }
}

impl From<&str> for FilterValue {
    fn from(s: &str) -> Self {
        FilterValue::Text(s.to_string())
    }
}

/// How an entity filter's value is produced at execute time: either bound
/// as-is, or a raw value run through a per-entity normalizer first (e.g.
/// `page_type` PascalCase -> enum text) that may reject unknown input.
enum FilterSpec {
    Value(FilterValue),
    Norm {
        raw: String,
        normalizer: fn(&str) -> Option<&'static str>,
    },
}

/// An entity-specific equality predicate: a hard-coded column (never user
/// input) plus the spec that yields its bound value.
struct EntityFilter {
    column: &'static str,
    spec: FilterSpec,
}

/// The filter values that need normalization/validation, resolved once at
/// execute time so `build_plan` (SQL shape only) and the fluent setters both
/// stay infallible. Produced by [`ContentQuery::resolve`], in placeholder order.
struct ResolvedBinds {
    statuses: Option<Vec<String>>,
    exclude_status: Option<String>,
    entity_filters: Vec<FilterValue>,
}

/// Builder for the content listing/count pattern. See module docs.
pub struct ContentQuery {
    table: &'static str,
    site_id: Uuid,
    locale_id: Option<Uuid>,
    category_slug: Option<String>,
    statuses: Option<Vec<String>>,
    search: Option<Search>,
    exclude_status: Option<String>,
    entity_filters: Vec<EntityFilter>,
    published_gate: bool,
    order_by: Option<String>,
    entity_soft_delete: bool,
    limit: i64,
    offset: i64,
}

impl ContentQuery {
    /// New builder against an entity table. `table` must be a hard-coded
    /// identifier (e.g. `"blogs"`) — never user input.
    pub fn new(table: &'static str, site_id: Uuid) -> Self {
        Self {
            table,
            site_id,
            locale_id: None,
            category_slug: None,
            statuses: None,
            search: None,
            exclude_status: None,
            entity_filters: Vec::new(),
            published_gate: false,
            order_by: None,
            entity_soft_delete: false,
            limit: 100,
            offset: 0,
        }
    }

    /// Restrict to entities that have a localization in this locale.
    pub fn with_locale(mut self, locale_id: Uuid) -> Self {
        self.locale_id = Some(locale_id);
        self
    }

    /// Restrict to entities tagged with a category whose slug matches.
    pub fn with_category(mut self, category_slug: impl Into<String>) -> Self {
        self.category_slug = Some(category_slug.into());
        self
    }

    /// Restrict to entities whose `contents.status` is in the given set.
    /// Values are stored raw and normalized at execute time: each may be the
    /// API PascalCase name (`"Published"`) or the Postgres enum text
    /// (`"published"`); unknown values become a 400 at `execute`/`count_only`.
    pub fn with_status<I, S>(mut self, statuses: I) -> Self
    where
        I: IntoIterator<Item = S>,
        S: Into<String>,
    {
        self.statuses = Some(statuses.into_iter().map(Into::into).collect());
        self
    }

    /// Restrict to rows where ANY of `columns` substring-matches `term`
    /// (case-insensitive ILIKE). `columns` must be hard-coded identifiers
    /// (`&'static str`, e.g. `"e.author"` / `"c.slug"`) — never user input;
    /// only `term` is bound as a parameter, once, and shared across columns.
    pub fn with_search(
        mut self,
        columns: &'static [&'static str],
        term: impl Into<String>,
    ) -> Self {
        self.search = Some(Search {
            columns,
            term: term.into(),
        });
        self
    }

    /// Exclude rows whose `contents.status` equals this value (API name or
    /// enum text, normalized at execute like [`Self::with_status`]). The negated
    /// counterpart to `with_status`, used by admin list filters that hide a
    /// single status (e.g. "archived").
    pub fn exclude_status(mut self, status: impl Into<String>) -> Self {
        self.exclude_status = Some(status.into());
        self
    }

    /// Add a generic equality predicate `{column} = $n` on an entity column.
    /// `column` must be a hard-coded identifier (`&'static str`, e.g.
    /// `"e.is_featured"` or `"e.page_type::text"`) — never user input; only the
    /// value is bound. The placeholder is allocated in `build_plan` in the same
    /// position the value is bound in `execute`/`count_only`. ContentQuery never
    /// learns the entity's column names — the caller hard-codes them.
    pub fn with_entity_filter(
        mut self,
        column: &'static str,
        value: impl Into<FilterValue>,
    ) -> Self {
        self.entity_filters.push(EntityFilter {
            column,
            spec: FilterSpec::Value(value.into()),
        });
        self
    }

    /// Like [`Self::with_entity_filter`], but runs `raw` through a per-entity
    /// `normalizer` (PascalCase API value -> enum text) at execute time. Unknown
    /// values are rejected as a 400 there — keeping this setter infallible so the
    /// fluent chain is unbroken. The normalized value is bound as text, so
    /// `column` should target a text-comparable expression (e.g.
    /// `"e.page_type::text"`).
    pub fn with_entity_filter_norm(
        mut self,
        column: &'static str,
        raw: impl Into<String>,
        normalizer: fn(&str) -> Option<&'static str>,
    ) -> Self {
        self.entity_filters.push(EntityFilter {
            column,
            spec: FilterSpec::Norm {
                raw: raw.into(),
                normalizer,
            },
        });
        self
    }

    /// Apply the standard publish gate: `is_deleted = FALSE`,
    /// `status IN ('published','scheduled')`, and the
    /// `publish_start <= NOW() < publish_end` window.
    pub fn published_only(mut self) -> Self {
        self.published_gate = true;
        self
    }

    /// Override the `ORDER BY` clause. The expression is interpolated into
    /// SQL unescaped, so it must be a hard-coded literal (`&'static str`) —
    /// never user input. Defaults to `e.published_date DESC`, which only
    /// fits entities whose table has a `published_date` column (e.g. `blogs`).
    /// Other entities (pages → `e.route ASC`, etc.) must override.
    pub fn order_by(mut self, expr: &'static str) -> Self {
        self.order_by = Some(expr.to_string());
        self
    }

    /// Set `ORDER BY` from a hard-coded column plus a runtime sort direction.
    /// `column` is interpolated unescaped (must be `&'static str`, never user
    /// input); `sort_dir` is normalized to `ASC`/`DESC` via [`order_clause`]
    /// (anything other than "asc"/"ASC" → `DESC`). Use when the column is
    /// chosen from a fixed allowlist but the direction comes from the request.
    pub fn order_by_dir(mut self, column: &'static str, sort_dir: Option<&str>) -> Self {
        self.order_by = Some(order_clause(column, sort_dir));
        self
    }

    /// Filter soft-deleted rows by the entity table's own `is_deleted` column
    /// (`e.is_deleted = FALSE`) instead of the canonical `c.is_deleted = FALSE`.
    /// Use for entities that track soft-delete on their own table — e.g.
    /// `legal_documents.is_deleted` — rather than mirroring `contents.is_deleted`.
    pub fn use_entity_soft_delete(mut self) -> Self {
        self.entity_soft_delete = true;
        self
    }

    /// SQL `LIMIT` / `OFFSET`. Defaults are `100` / `0`.
    pub fn paginate(mut self, limit: i64, offset: i64) -> Self {
        self.limit = limit;
        self.offset = offset;
        self
    }

    /// Resolve the filter values that need normalization/validation, in the
    /// exact order `build_plan` allocates their placeholders and
    /// `execute`/`count_only` bind them: statuses, then exclude-status, then
    /// each entity filter. Unknown status / entity values become a 400 here —
    /// this is the deferred error the infallible fluent setters trade for.
    fn resolve(&self) -> Result<ResolvedBinds, ApiError> {
        let statuses = match &self.statuses {
            Some(raw) => Some(
                raw.iter()
                    .map(|s| {
                        normalize_status(s).map(str::to_string).ok_or_else(|| {
                            ApiError::bad_request(format!("Invalid status filter: {s}"))
                        })
                    })
                    .collect::<Result<Vec<_>, _>>()?,
            ),
            None => None,
        };

        let exclude_status = match &self.exclude_status {
            Some(s) => Some(normalize_status(s).map(str::to_string).ok_or_else(|| {
                ApiError::bad_request(format!("Invalid exclude_status filter: {s}"))
            })?),
            None => None,
        };

        let entity_filters = self
            .entity_filters
            .iter()
            .map(|f| match &f.spec {
                FilterSpec::Value(v) => Ok(v.clone()),
                FilterSpec::Norm { raw, normalizer } => normalizer(raw)
                    .map(|t| FilterValue::Text(t.to_string()))
                    .ok_or_else(|| {
                        ApiError::bad_request(format!("Invalid {} filter: {raw}", f.column))
                    }),
            })
            .collect::<Result<Vec<_>, _>>()?;

        Ok(ResolvedBinds {
            statuses,
            exclude_status,
            entity_filters,
        })
    }

    /// Run the data query and a matching `COUNT(*)`. Returns
    /// `(rows, total_count)` so callers can build paginated responses
    /// in one call.
    pub async fn execute<T>(self, pool: &PgPool) -> Result<(Vec<T>, i64), ApiError>
    where
        T: for<'r> FromRow<'r, PgRow> + Send + Unpin,
    {
        let resolved = self.resolve()?;
        let plan = self.build_plan();

        let mut data_q = sqlx::query_as::<_, T>(sqlx::AssertSqlSafe(plan.data_sql));
        let mut count_q = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(plan.count_sql));

        data_q = data_q.bind(self.site_id);
        count_q = count_q.bind(self.site_id);

        if let Some(ref slug) = self.category_slug {
            data_q = data_q.bind(slug);
            count_q = count_q.bind(slug);
        }
        if let Some(locale_id) = self.locale_id {
            data_q = data_q.bind(locale_id);
            count_q = count_q.bind(locale_id);
        }
        if let Some(ref statuses) = resolved.statuses {
            data_q = data_q.bind(statuses);
            count_q = count_q.bind(statuses);
        }
        if let Some(ref search) = self.search {
            data_q = data_q.bind(&search.term);
            count_q = count_q.bind(&search.term);
        }
        if let Some(ref ex) = resolved.exclude_status {
            data_q = data_q.bind(ex);
            count_q = count_q.bind(ex);
        }
        for value in &resolved.entity_filters {
            match value {
                FilterValue::Text(s) => {
                    data_q = data_q.bind(s);
                    count_q = count_q.bind(s);
                }
                FilterValue::Bool(b) => {
                    data_q = data_q.bind(*b);
                    count_q = count_q.bind(*b);
                }
            }
        }

        data_q = data_q.bind(self.limit).bind(self.offset);

        let rows = data_q.fetch_all(pool).await?;
        let (total,) = count_q.fetch_one(pool).await?;

        Ok((rows, total))
    }

    /// Run only the `COUNT(*)` query. Use this for endpoints that need a
    /// total but never read rows — it skips the data query entirely
    /// (one round-trip instead of two) and side-steps `SELECT e.*` column
    /// collisions on entity tables that share names with `contents` (e.g.
    /// `projects.slug` vs `contents.slug`).
    pub async fn count_only(self, pool: &PgPool) -> Result<i64, ApiError> {
        let resolved = self.resolve()?;
        let plan = self.build_plan();

        let mut count_q = sqlx::query_as::<_, (i64,)>(sqlx::AssertSqlSafe(plan.count_sql));
        count_q = count_q.bind(self.site_id);

        if let Some(ref slug) = self.category_slug {
            count_q = count_q.bind(slug);
        }
        if let Some(locale_id) = self.locale_id {
            count_q = count_q.bind(locale_id);
        }
        if let Some(ref statuses) = resolved.statuses {
            count_q = count_q.bind(statuses);
        }
        if let Some(ref search) = self.search {
            count_q = count_q.bind(&search.term);
        }
        if let Some(ref ex) = resolved.exclude_status {
            count_q = count_q.bind(ex);
        }
        for value in &resolved.entity_filters {
            match value {
                FilterValue::Text(s) => {
                    count_q = count_q.bind(s);
                }
                FilterValue::Bool(b) => {
                    count_q = count_q.bind(*b);
                }
            }
        }

        let (total,) = count_q.fetch_one(pool).await?;
        Ok(total)
    }

    fn build_plan(&self) -> QueryPlan {
        let mut joins = String::from(
            "INNER JOIN contents c ON e.content_id = c.id\n\
             INNER JOIN content_sites cs ON c.id = cs.content_id\n",
        );
        let mut where_clauses = vec!["cs.site_id = $1".to_string()];
        let mut placeholder = 2;

        if self.category_slug.is_some() {
            joins.push_str(
                "INNER JOIN content_categories cc ON c.id = cc.content_id\n\
                 INNER JOIN categories cat ON cc.category_id = cat.id\n",
            );
            where_clauses.push(format!("cat.slug = ${placeholder}"));
            placeholder += 1;
        }
        if self.locale_id.is_some() {
            joins.push_str("INNER JOIN content_localizations cl ON c.id = cl.content_id\n");
            where_clauses.push(format!("cl.locale_id = ${placeholder}"));
            placeholder += 1;
        }
        if self.statuses.is_some() {
            where_clauses.push(format!("c.status::text = ANY(${placeholder})"));
            placeholder += 1;
        }
        if let Some(ref search) = self.search {
            // One bound placeholder, referenced by every column fragment.
            let term_ph = placeholder;
            let ors: Vec<String> = search
                .columns
                .iter()
                .map(|col| format!("{col} ILIKE '%' || ${term_ph} || '%'"))
                .collect();
            where_clauses.push(format!("({})", ors.join(" OR ")));
            placeholder += 1;
        }
        if self.exclude_status.is_some() {
            where_clauses.push(format!("c.status::text != ${placeholder}"));
            placeholder += 1;
        }
        for ef in &self.entity_filters {
            // Only the hard-coded `&'static str` column is interpolated; the
            // value is bound at ${placeholder}, matching the bind order in
            // execute()/count_only().
            where_clauses.push(format!("{} = ${placeholder}", ef.column));
            placeholder += 1;
        }
        // Soft-delete is part of the canonical join (see issue #617) and applies
        // to every listing, not just published-gated ones. Entities that track
        // soft-delete on their own table (e.g. legal_documents) opt in via
        // .use_entity_soft_delete() to swap c.is_deleted → e.is_deleted.
        let soft_delete_col = if self.entity_soft_delete {
            "e.is_deleted"
        } else {
            "c.is_deleted"
        };
        where_clauses.push(format!("{soft_delete_col} = FALSE"));
        if self.published_gate {
            if self.statuses.is_none() {
                where_clauses.push("c.status IN ('published', 'scheduled')".to_string());
            }
            where_clauses.push("(c.publish_start IS NULL OR c.publish_start <= NOW())".to_string());
            where_clauses.push("(c.publish_end IS NULL OR c.publish_end > NOW())".to_string());
        }

        let where_sql = where_clauses.join("\n  AND ");
        let limit_placeholder = placeholder;
        let offset_placeholder = placeholder + 1;

        let order_sql = self.order_by.as_deref().unwrap_or("e.published_date DESC");

        let data_sql = format!(
            "SELECT e.*,\n       \
             c.slug, c.status, c.published_at, c.publish_start, c.publish_end\n\
             FROM {table} e\n{joins}\
             WHERE {where_sql}\n\
             ORDER BY {order_sql}\n\
             LIMIT ${limit} OFFSET ${offset}",
            table = self.table,
            joins = joins,
            where_sql = where_sql,
            order_sql = order_sql,
            limit = limit_placeholder,
            offset = offset_placeholder,
        );

        let count_sql = format!(
            "SELECT COUNT(*)::bigint FROM {table} e\n{joins}WHERE {where_sql}",
            table = self.table,
            joins = joins,
            where_sql = where_sql,
        );

        QueryPlan {
            data_sql,
            count_sql,
        }
    }
}

struct QueryPlan {
    data_sql: String,
    count_sql: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_order_by_targets_published_date() {
        let plan = ContentQuery::new("blogs", Uuid::nil()).build_plan();
        assert!(
            plan.data_sql.contains("ORDER BY e.published_date DESC"),
            "default ORDER BY missing; got:\n{}",
            plan.data_sql
        );
    }

    #[test]
    fn entity_soft_delete_swaps_predicate_column() {
        let plan = ContentQuery::new("legal_documents", Uuid::nil())
            .use_entity_soft_delete()
            .build_plan();
        assert!(
            plan.data_sql.contains("e.is_deleted = FALSE"),
            "expected e.is_deleted = FALSE; got:\n{}",
            plan.data_sql
        );
        assert!(
            !plan.data_sql.contains("c.is_deleted = FALSE"),
            "default c.is_deleted should be swapped out; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.count_sql.contains("e.is_deleted = FALSE"),
            "swap must also apply to count_sql; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn count_plan_omits_select_e_star_and_order_by() {
        // count_only relies on the count_sql shape: no `SELECT e.*` (so no
        // slug/column collisions) and no ORDER BY (so entity tables without
        // `published_date` are safe even when no custom order_by is set).
        let plan = ContentQuery::new("projects", Uuid::nil()).build_plan();
        assert!(
            plan.count_sql.starts_with("SELECT COUNT(*)::bigint"),
            "count_sql should be COUNT-only; got:\n{}",
            plan.count_sql
        );
        assert!(
            !plan.count_sql.contains("SELECT e.*"),
            "count_sql must not expand e.* (would collide with projects.slug); got:\n{}",
            plan.count_sql
        );
        assert!(
            !plan.count_sql.contains("ORDER BY"),
            "count_sql must not include ORDER BY; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn soft_delete_filter_applies_without_published_gate() {
        let plan = ContentQuery::new("pages", Uuid::nil()).build_plan();
        assert!(
            plan.data_sql.contains("c.is_deleted = FALSE"),
            "soft-delete filter missing from non-published listing; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.count_sql.contains("c.is_deleted = FALSE"),
            "soft-delete filter missing from count; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn custom_order_by_overrides_default() {
        let plan = ContentQuery::new("pages", Uuid::nil())
            .order_by("e.route ASC")
            .build_plan();
        assert!(
            plan.data_sql.contains("ORDER BY e.route ASC"),
            "custom ORDER BY missing; got:\n{}",
            plan.data_sql
        );
        assert!(
            !plan.data_sql.contains("published_date"),
            "default ORDER BY should be replaced; got:\n{}",
            plan.data_sql
        );
    }

    #[test]
    fn with_search_ors_ilike_across_columns_on_one_placeholder() {
        // site_id is $1, so the single bound search term takes $2 and is
        // referenced by every column fragment (the term is bound once).
        let plan = ContentQuery::new("blogs", Uuid::nil())
            .with_search(&["e.id::text", "c.slug", "e.author"], "needle")
            .build_plan();
        let expected = "(e.id::text ILIKE '%' || $2 || '%' \
             OR c.slug ILIKE '%' || $2 || '%' \
             OR e.author ILIKE '%' || $2 || '%')";
        assert!(
            plan.data_sql.contains(expected),
            "search clause shape wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.count_sql.contains(expected),
            "search clause must also apply to count; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn exclude_status_generates_not_equal_predicate() {
        let plan = ContentQuery::new("blogs", Uuid::nil())
            .exclude_status("archived")
            .build_plan();
        assert!(
            plan.data_sql.contains("c.status::text != $2"),
            "exclude predicate missing; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.count_sql.contains("c.status::text != $2"),
            "exclude predicate must also apply to count; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn combined_filters_keep_placeholders_sequential_and_aligned() {
        // Verifies the placeholder counter advances in the same order the
        // values are bound in execute(): site($1), status ANY($2),
        // search($3), exclude($4), then limit/offset last.
        let plan = ContentQuery::new("blogs", Uuid::nil())
            .with_status(["published"])
            .with_search(&["c.slug"], "x")
            .exclude_status("archived")
            .paginate(10, 20)
            .build_plan();
        assert!(
            plan.data_sql.contains("c.status::text = ANY($2)"),
            "status placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("c.slug ILIKE '%' || $3 || '%'"),
            "search placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("c.status::text != $4"),
            "exclude placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("LIMIT $5 OFFSET $6"),
            "limit/offset must follow the filter placeholders; got:\n{}",
            plan.data_sql
        );
    }

    #[test]
    fn order_by_dir_resolves_direction_safely() {
        let asc = ContentQuery::new("blogs", Uuid::nil())
            .order_by_dir("e.author", Some("asc"))
            .build_plan();
        assert!(
            asc.data_sql.contains("ORDER BY e.author ASC"),
            "asc direction missing; got:\n{}",
            asc.data_sql
        );

        // Any non-asc direction (including None and garbage) defaults to DESC,
        // matching the order_clause helper the hand-rolled blog query used.
        let def = ContentQuery::new("blogs", Uuid::nil())
            .order_by_dir("e.published_date", None)
            .build_plan();
        assert!(
            def.data_sql.contains("ORDER BY e.published_date DESC"),
            "default direction should be DESC; got:\n{}",
            def.data_sql
        );
    }

    /// Test-only normalizer standing in for an entity's PascalCase->enum-text map
    /// (e.g. `normalize_page_type`).
    fn pascal_page_type(api_value: &str) -> Option<&'static str> {
        match api_value {
            "Landing" => Some("landing"),
            _ => None,
        }
    }

    #[test]
    fn entity_filter_emits_predicate_at_sequential_placeholder() {
        // site_id is $1, so a lone entity filter takes $2 in both data and count.
        let plan = ContentQuery::new("projects", Uuid::nil())
            .with_entity_filter("p.is_featured", true)
            .build_plan();
        assert!(
            plan.data_sql.contains("p.is_featured = $2"),
            "entity predicate missing/misplaced; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.count_sql.contains("p.is_featured = $2"),
            "entity predicate must also apply to count; got:\n{}",
            plan.count_sql
        );
    }

    #[test]
    fn entity_filter_norm_binds_normalized_value() {
        let resolved = ContentQuery::new("pages", Uuid::nil())
            .with_entity_filter_norm("e.page_type::text", "Landing", pascal_page_type)
            .resolve()
            .expect("known page_type should resolve");
        assert!(
            matches!(resolved.entity_filters.as_slice(), [FilterValue::Text(t)] if t == "landing"),
            "normalizer should bind the enum-text value"
        );
    }

    #[test]
    fn entity_filter_norm_rejects_unknown_value() {
        let err = ContentQuery::new("pages", Uuid::nil())
            .with_entity_filter_norm("e.page_type::text", "Bogus", pascal_page_type)
            .resolve();
        assert!(
            err.is_err(),
            "unknown entity value should be a deferred 400"
        );
    }

    #[test]
    fn with_status_normalizes_pascalcase_at_resolve() {
        let resolved = ContentQuery::new("blogs", Uuid::nil())
            .with_status(["InReview"])
            .resolve()
            .expect("known status should resolve");
        assert_eq!(resolved.statuses, Some(vec!["in_review".to_string()]));
    }

    #[test]
    fn with_status_accepts_enum_text_too() {
        // Existing callers (e.g. blog) already pass lowercase enum text; the
        // normalizer must be idempotent so they keep working unchanged.
        let resolved = ContentQuery::new("blogs", Uuid::nil())
            .with_status(["published"])
            .resolve()
            .expect("enum-text status should resolve");
        assert_eq!(resolved.statuses, Some(vec!["published".to_string()]));
    }

    #[test]
    fn with_status_rejects_unknown_status() {
        let err = ContentQuery::new("blogs", Uuid::nil())
            .with_status(["Bogus"])
            .resolve();
        assert!(err.is_err(), "unknown status should be a deferred 400");
    }

    #[test]
    fn entity_filters_keep_placeholders_sequential_and_aligned() {
        // Order: site($1), status ANY($2), search($3), exclude($4),
        // entity filter($5), then limit/offset last ($6/$7) — matching the bind
        // order in execute().
        let plan = ContentQuery::new("projects", Uuid::nil())
            .with_status(["published"])
            .with_search(&["p.slug"], "x")
            .exclude_status("archived")
            .with_entity_filter("p.is_featured", true)
            .paginate(10, 20)
            .build_plan();
        assert!(
            plan.data_sql.contains("c.status::text = ANY($2)"),
            "status placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("p.slug ILIKE '%' || $3 || '%'"),
            "search placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("c.status::text != $4"),
            "exclude placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("p.is_featured = $5"),
            "entity-filter placeholder wrong; got:\n{}",
            plan.data_sql
        );
        assert!(
            plan.data_sql.contains("LIMIT $6 OFFSET $7"),
            "limit/offset must follow the entity-filter placeholder; got:\n{}",
            plan.data_sql
        );
    }
}
