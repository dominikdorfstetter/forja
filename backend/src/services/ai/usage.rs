//! AI usage recording (issue #929).
//!
//! Best-effort write of one `ai_usage_logs` row per generate call, plus the
//! AiAction/provider-label mappings that keep the stored strings in sync with
//! the enum + site config. Lifted out of the orchestrator's request path.

use sqlx::PgPool;
use uuid::Uuid;

use crate::dto::ai::AiAction;
use crate::services::ai_service::{Provider, TokenUsage};

/// Map an `AiAction` to the snake_case string stored in
/// `ai_usage_logs.action`. Stays in sync with the enum's serde rename.
pub(crate) fn ai_action_key(action: &AiAction) -> &'static str {
    match action {
        AiAction::Seo => "seo",
        AiAction::Excerpt => "excerpt",
        AiAction::Translate => "translate",
        AiAction::DraftOutline => "draft_outline",
        AiAction::DraftPost => "draft_post",
        AiAction::AutoTag => "auto_tag",
        AiAction::AltText => "alt_text",
        AiAction::ImageCaption => "image_caption",
        AiAction::ImageTitle => "image_title",
        AiAction::SectionContent => "section_content",
        AiAction::BlogTags => "blog_tags",
    }
}

/// Provider name to record alongside each usage row. The string matches
/// what's stored in `site_ai_configs.provider_name`, so reports can join
/// to provider-level config without normalisation.
pub(crate) fn provider_label(provider: &Provider, raw_name: &str) -> String {
    match provider {
        Provider::Anthropic => "anthropic".to_string(),
        Provider::OpenAiCompatible => raw_name.to_lowercase(),
    }
}

/// Context passed into [`record_usage`]. Grouped into a struct so the
/// signature doesn't trip clippy's too-many-arguments check and so each
/// call site reads "this is one logical event," not eight loose parameters.
pub(crate) struct UsageRecordCtx<'a> {
    pub(crate) pool: &'a PgPool,
    pub(crate) site_id: Uuid,
    pub(crate) actor: Option<&'a crate::guards::actor::Actor>,
    pub(crate) action: &'a AiAction,
    pub(crate) provider: &'a Provider,
    pub(crate) raw_provider_name: &'a str,
    pub(crate) model: &'a str,
    pub(crate) usage: TokenUsage,
}

/// Best-effort write of a usage row. Logged-but-swallowed on failure —
/// the AI response has already been delivered to the user and we don't
/// want a usage-log failure to surface as a 500 they can't act on.
pub(crate) async fn record_usage(ctx: UsageRecordCtx<'_>) {
    let new = crate::models::ai_usage::NewAiUsage {
        site_id: ctx.site_id,
        actor_id: ctx.actor.map(|a| a.id),
        action: ai_action_key(ctx.action),
        provider: &provider_label(ctx.provider, ctx.raw_provider_name),
        model: ctx.model,
        input_tokens: ctx.usage.input_tokens,
        output_tokens: ctx.usage.output_tokens,
    };
    if let Err(e) = crate::models::ai_usage::AiUsageLog::insert(ctx.pool, new).await {
        tracing::warn!(
            error = %e,
            site_id = %ctx.site_id,
            action = ai_action_key(ctx.action),
            "Failed to record AI usage row (the AI response was delivered successfully)"
        );
    }
}
