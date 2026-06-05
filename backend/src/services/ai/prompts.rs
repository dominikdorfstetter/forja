//! AI prompt assembly + default system prompts (issue #927).
//!
//! Content/vision default prompts, JSON/XML format suffixes, and the builders
//! that assemble a system prompt for an action (with language + format
//! instructions). Pure of the provider seam and the network.

use crate::dto::ai::{AiAction, BlogTagContext, SectionContext};

// ── Default system prompts ───────────────────────────────────────

// Content-only prompts (format instructions are appended separately via format_suffix)
pub const DEFAULT_PROMPT_SEO: &str =
    "You are an SEO expert. Generate an SEO-optimized meta title (max 60 characters) \
and meta description (max 160 characters) from the provided blog content.";

pub const DEFAULT_PROMPT_EXCERPT: &str =
    "You are a content editor. Generate a concise 1-2 sentence excerpt that \
summarizes the key points of the provided blog content.";

pub(crate) const DEFAULT_PROMPT_TRANSLATE_PREFIX: &str =
    "You are a professional translator. Translate the following content to ";
pub(crate) const DEFAULT_PROMPT_TRANSLATE_SUFFIX: &str =
    ". Maintain the original tone, style, and markdown formatting.";

// Output format suffixes — appended to ALL prompts (custom or default) based on provider
pub(crate) const JSON_FORMAT_SEO: &str = "\nRespond with ONLY valid JSON in this exact format: \
{\"meta_title\": \"...\", \"meta_description\": \"...\"}";

pub(crate) const JSON_FORMAT_EXCERPT: &str =
    "\nRespond with ONLY valid JSON in this exact format: \
{\"excerpt\": \"...\"}";

pub(crate) const JSON_FORMAT_TRANSLATE: &str =
    "\nRespond with ONLY valid JSON in this exact format: \
{\"title\": \"...\", \"subtitle\": \"...\", \"excerpt\": \"...\", \
\"body\": \"...\", \"meta_title\": \"...\", \"meta_description\": \"...\"}";

pub(crate) const XML_FORMAT_SEO: &str =
    "\nRespond using ONLY these XML tags, with no other text:\n\
<meta_title>your meta title here</meta_title>\n\
<meta_description>your meta description here</meta_description>";

pub(crate) const XML_FORMAT_EXCERPT: &str =
    "\nRespond using ONLY this XML tag, with no other text:\n\
<excerpt>your excerpt here</excerpt>";

pub(crate) const XML_FORMAT_TRANSLATE: &str =
    "\nRespond using ONLY these XML tags, with no other text:\n\
<title>translated title</title>\n\
<subtitle>translated subtitle</subtitle>\n\
<excerpt>translated excerpt</excerpt>\n\
<body>translated body (keep markdown)</body>\n\
<meta_title>translated meta title</meta_title>\n\
<meta_description>translated meta description</meta_description>";

pub(crate) const DEFAULT_PROMPT_DRAFT_OUTLINE: &str =
    "You are a creative blog content strategist. Given a topic idea, generate a compelling blog \
post title, subtitle, and a structured outline with 5-8 bullet points. Each bullet should be a \
concise section heading or key point that could be expanded into a paragraph.";

pub(crate) const JSON_FORMAT_DRAFT_OUTLINE: &str =
    "\nRespond with ONLY valid JSON in this exact format: \
{\"title\": \"...\", \"subtitle\": \"...\", \"outline\": [\"point 1\", \"point 2\", ...]}";

pub(crate) const XML_FORMAT_DRAFT_OUTLINE: &str =
    "\nRespond using ONLY these XML tags, with no other text:\n\
<title>blog post title</title>\n\
<subtitle>blog post subtitle</subtitle>\n\
<outline>first outline point</outline>\n\
<outline>second outline point</outline>\n\
<outline>...</outline>";

pub(crate) const DEFAULT_PROMPT_DRAFT_POST: &str =
    "You are a skilled blog writer who produces clean, minimal markdown.\n\
STRICT FORMATTING RULES — violating these is an error:\n\
1. NEVER use # (h1). The highest heading allowed is ## (h2).\n\
2. NEVER use **bold** or __bold__. Not for tool names, not for emphasis, not at all. Write everything in plain text.\n\
3. NEVER insert horizontal rules (---).\n\
4. Use *italics* only for a single foreign word or book title, never for emphasis.\n\
5. Each ## heading must be short (under 8 words) and derived from an outline bullet point.\n\n\
Given a title and outline, write a complete blog post following the rules above. \
Expand each outline point into one or two concise paragraphs of plain prose. \
Also generate a concise excerpt (1-2 sentences) and SEO metadata.";

pub(crate) const JSON_FORMAT_DRAFT_POST: &str = "\nRespond with ONLY valid JSON in this exact format: \
{\"body\": \"clean markdown with ## headings, no bold, no horizontal rules\", \"excerpt\": \"1-2 sentence summary\", \
\"meta_title\": \"SEO title (max 60 chars)\", \"meta_description\": \"SEO description (max 160 chars)\"}";

pub(crate) const XML_FORMAT_DRAFT_POST: &str =
    "\nRespond using ONLY these XML tags, with no other text:\n\
<body>clean markdown with ## headings, no bold, no horizontal rules</body>\n\
<excerpt>1-2 sentence summary</excerpt>\n\
<meta_title>SEO title (max 60 chars)</meta_title>\n\
<meta_description>SEO description (max 160 chars)</meta_description>";

// ── Vision / multimodal default prompts ─────────────────────────

pub(crate) const DEFAULT_AUTO_TAG_PROMPT: &str = "\
You are an image tagging assistant. Analyze the image and generate relevant tags \
that describe its content, subject, mood, colors, and context. \
Return a JSON object with a single key \"tags\" containing an array of 5-15 lowercase tag strings. \
Example: {\"tags\": [\"landscape\", \"mountains\", \"sunset\", \"nature\", \"orange sky\"]}";

pub(crate) const DEFAULT_ALT_TEXT_PROMPT: &str = "\
You are an accessibility expert. Generate a concise, descriptive alt text for this image. \
The alt text should be 1-2 sentences that accurately describe the image content for screen readers. \
Be specific about subjects, actions, and important visual details. \
Use plain text only — no markdown, no bold, no italic, no formatting. \
Return a JSON object with a single key \"alt_text\". \
Example: {\"alt_text\": \"A golden retriever playing fetch on a sandy beach at sunset\"}";

pub(crate) const DEFAULT_IMAGE_CAPTION_PROMPT: &str = "\
You are an image description expert. Generate a descriptive caption for this image. \
The caption should be 1-2 sentences that could be used as a subtitle or description beneath the image in a blog or article. \
Be vivid and contextual. Use plain text only — no markdown, no bold, no italic, no formatting. \
Return a JSON object with a single key \"caption\". \
Example: {\"caption\": \"Sunrise over the Swiss Alps, with golden light casting long shadows across the snow-covered peaks\"}";

pub(crate) const DEFAULT_IMAGE_TITLE_PROMPT: &str = "\
You are a content editor. Generate a short, compelling title for this image. \
The title should be 3-8 words, suitable for use as a heading or filename descriptor. \
Be specific and descriptive rather than generic. Use plain text only — no markdown, no formatting. \
Return a JSON object with a single key \"title\". \
Example: {\"title\": \"Alpine Sunrise Over Snow-Covered Peaks\"}";

// ── Section content (page-section authoring assist) ─────────────

pub(crate) const DEFAULT_PROMPT_SECTION_CONTENT_PREFIX: &str = "\
You are a senior web copywriter. Generate initial draft content for one section \
of a marketing/landing page. The user will review and edit your output — so be \
specific, concrete, and on-topic, not generic filler.";

/// Structural guidance per section type. The key is the lowercased SectionType
/// variant; values describe what the three fields (`title`, `text`, `button_text`)
/// should look like for that section. Falls back to a generic shape when the
/// section type is unrecognised.
pub(crate) fn section_type_guidance(section_type_lower: &str) -> &'static str {
    match section_type_lower {
        "hero" => "Section type: HERO — the page's main introductory banner. \
            title = punchy headline (≤ 10 words), text = 1–2 sentence value proposition, \
            button_text = primary call-to-action (2–4 words, e.g. 'Get started').",
        "features" => "Section type: FEATURES — a feature/benefit overview. \
            title = a short benefit-led heading (≤ 8 words), \
            text = 1–2 sentences framing what the features collectively deliver \
            (individual feature items live elsewhere — do not enumerate them), \
            button_text = an optional learn-more CTA (or empty).",
        "cta" => "Section type: CTA — a focused conversion block. \
            title = action-oriented heading (≤ 8 words, often a question or imperative), \
            text = ONE short sentence reinforcing urgency or value, \
            button_text = imperative verb phrase (2–4 words, e.g. 'Start free trial').",
        "gallery" => "Section type: GALLERY — an image collection introduction. \
            title = a short heading framing the gallery, \
            text = 1 sentence describing what visitors will see, \
            button_text = optional (e.g. 'See all').",
        "testimonials" => "Section type: TESTIMONIALS — customer proof block. \
            title = a short heading (e.g. 'What our customers say'), \
            text = 1 sentence framing why the proof matters (do NOT invent quotes), \
            button_text = optional (e.g. 'Read more stories').",
        "pricing" => "Section type: PRICING — pricing overview block. \
            title = a short heading (e.g. 'Simple, transparent pricing'), \
            text = 1–2 sentences on the pricing principle (value, fairness, no surprises), \
            button_text = optional (e.g. 'Compare plans').",
        "faq" => "Section type: FAQ — frequently-asked-questions block. \
            title = the FAQ heading (e.g. 'Frequently asked questions'), \
            text = ONE representative Q+A pair formatted as markdown: \
            '**Q: …?**\\n\\nA: …'. button_text = optional (e.g. 'Contact us').",
        "contact" => "Section type: CONTACT — get-in-touch block. \
            title = welcoming heading (≤ 8 words), \
            text = 1–2 sentences inviting contact, \
            button_text = imperative (e.g. 'Send a message').",
        "stats" => "Section type: STATS — key-numbers block. \
            title = a short framing heading, \
            text = 1 sentence summarising the proof these numbers provide (do NOT invent specific figures), \
            button_text = optional.",
        "team" => "Section type: TEAM — the people behind the product. \
            title = a short heading (e.g. 'Meet the team'), \
            text = 1–2 sentences on the team's character or expertise, \
            button_text = optional (e.g. 'Join us').",
        "timeline" => "Section type: TIMELINE — milestones / history. \
            title = a short heading (e.g. 'Our journey'), \
            text = 1 sentence framing the timeline (do NOT enumerate milestones), \
            button_text = optional.",
        "logo_cloud" => "Section type: LOGO CLOUD — trusted-by logos. \
            title = a short heading (e.g. 'Trusted by teams at'), \
            text = optional 1 sentence framing the proof, \
            button_text = optional.",
        "newsletter" => "Section type: NEWSLETTER — email-signup block. \
            title = short heading (e.g. 'Stay in the loop'), \
            text = 1 sentence on what subscribers receive and cadence, \
            button_text = imperative (e.g. 'Subscribe').",
        "video" => "Section type: VIDEO — featured-video block. \
            title = short heading framing the video, \
            text = 1 sentence on what the viewer will learn, \
            button_text = optional (e.g. 'Watch later').",
        "divider" => "Section type: DIVIDER — visual break. \
            title = empty or a single short transitional phrase, \
            text = empty, button_text = empty.",
        "text" => "Section type: TEXT — long-form prose block. \
            title = a section heading, \
            text = 2–4 short paragraphs of plain markdown prose appropriate to the page topic, \
            button_text = optional.",
        _ => "Section type: CUSTOM — a generic content block. \
            title = a short heading appropriate to the page topic, \
            text = 1–3 sentences on a relevant angle, \
            button_text = optional.",
    }
}

/// Normalise a section-type string to the snake_case form used as a key in
/// [`section_type_guidance`]. Accepts the PascalCase form the frontend sends
/// (matching the serde-default serialisation of [`models::page::SectionType`]),
/// the snake_case form used by sqlx, or any mixed-case variant a custom client
/// may produce. Inserts an underscore between a lowercase→uppercase boundary
/// (so `LogoCloud` → `logo_cloud`).
pub(crate) fn normalise_section_type(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    let mut prev_lower = false;
    for c in s.chars() {
        if c.is_ascii_uppercase() && prev_lower {
            out.push('_');
        }
        out.extend(c.to_lowercase());
        prev_lower = c.is_ascii_lowercase() || c.is_ascii_digit();
    }
    out
}

pub(crate) fn default_section_content_prompt(ctx: &SectionContext) -> String {
    let st_key = normalise_section_type(&ctx.section_type);
    let guidance = section_type_guidance(&st_key);

    let mut page_context = String::new();
    if let Some(ref title) = ctx.page_title {
        if !title.trim().is_empty() {
            page_context.push_str(&format!("\nPage title: {title}"));
        }
    }
    if let Some(ref route) = ctx.page_route {
        if !route.trim().is_empty() {
            page_context.push_str(&format!("\nPage route: {route}"));
        }
    }
    if !ctx.existing_section_types.is_empty() {
        page_context.push_str(&format!(
            "\nExisting sections on this page (do not duplicate angle): {}",
            ctx.existing_section_types.join(", ")
        ));
    }

    format!("{DEFAULT_PROMPT_SECTION_CONTENT_PREFIX}\n\n{guidance}{page_context}")
}

pub(crate) const JSON_FORMAT_SECTION_CONTENT: &str =
    "\nRespond with ONLY valid JSON in this exact format: \
{\"title\": \"...\", \"text\": \"...\", \"button_text\": \"...\"}. \
Use an empty string for fields not applicable to this section type.";

pub(crate) const XML_FORMAT_SECTION_CONTENT: &str =
    "\nRespond using ONLY these XML tags, with no other text:\n\
<title>section title</title>\n\
<text>section body text (markdown allowed)</text>\n\
<button_text>CTA button label or empty</button_text>";

// ── Blog auto-tagging (text-based, distinct from vision AutoTag) ────

/// Maximum number of tag suggestions returned to the client, regardless of
/// what the model produces. UI also caps but defence-in-depth at the API
/// boundary keeps the response shape predictable for any consumer.
pub const MAX_BLOG_TAG_SUGGESTIONS: usize = 8;

/// Minimum word count in `content` before the blog-tags action will run.
/// Below this, `generate()` returns `AI_CONTEXT_INSUFFICIENT` rather than
/// asking the model to hallucinate tags from a one-line draft.
pub const MIN_BLOG_TAGS_WORDS: usize = 30;

pub(crate) const DEFAULT_PROMPT_BLOG_TAGS_PREFIX: &str = "\
You suggest tags for a blog post based on its body text. \
Tags are short, lowercase, hyphenated slug strings (e.g. 'rust', 'web-development', 'tutorial'). \
Each tag is a single concept — never a sentence. \
Prefer existing site tags over inventing near-duplicates: if 'rust' is in the existing list \
and the post is about Rust, return 'rust' (not 'Rust' or 'rust-lang'). \
Only invent a new tag when no existing one fits. \
Return at most 8 tags, ranked by relevance — the most central first.";

pub(crate) const JSON_FORMAT_BLOG_TAGS: &str =
    "\nRespond with ONLY valid JSON in this exact format: \
{\"tags\": [\"tag-one\", \"tag-two\", \"tag-three\"]}. \
Use lowercase, hyphenated slug strings only.";

pub(crate) const XML_FORMAT_BLOG_TAGS: &str =
    "\nRespond using ONLY these XML tags, with no other text. \
Repeat <tag>...</tag> once per suggestion:\n\
<tag>tag-one</tag>\n\
<tag>tag-two</tag>\n\
<tag>tag-three</tag>";

pub(crate) fn default_blog_tags_prompt(ctx: Option<&BlogTagContext>) -> String {
    let existing_section = match ctx {
        Some(c) if !c.existing_tags.is_empty() => {
            format!(
                "\n\nExisting site tags (prefer reusing these — case-insensitive match): {}",
                c.existing_tags.join(", ")
            )
        }
        _ => String::new(),
    };
    format!("{DEFAULT_PROMPT_BLOG_TAGS_PREFIX}{existing_section}")
}

/// Normalise blog-tag suggestions: lowercase, trim, drop blanks, dedupe
/// preserving order, snap to existing-tag casing on case-insensitive match,
/// and cap at [`MAX_BLOG_TAG_SUGGESTIONS`].
pub(crate) fn normalise_blog_tags(raw: Vec<String>, existing: &[String]) -> Vec<String> {
    let mut out: Vec<String> = Vec::with_capacity(raw.len());
    let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
    for candidate in raw {
        let lower = candidate.trim().to_lowercase();
        if lower.is_empty() || seen.contains(&lower) {
            continue;
        }
        // Snap to canonical existing-tag form when the model returned a
        // case/whitespace variant of one we already have.
        let canonical = existing
            .iter()
            .find(|e| e.to_lowercase() == lower)
            .cloned()
            .unwrap_or(lower.clone());
        seen.insert(lower);
        out.push(canonical);
        if out.len() >= MAX_BLOG_TAG_SUGGESTIONS {
            break;
        }
    }
    out
}

pub(crate) fn default_content_prompt(action: &AiAction, target_locale: Option<&str>) -> String {
    match action {
        AiAction::Seo => DEFAULT_PROMPT_SEO.to_string(),
        AiAction::Excerpt => DEFAULT_PROMPT_EXCERPT.to_string(),
        AiAction::Translate => {
            let locale = target_locale.unwrap_or("en");
            format!("{DEFAULT_PROMPT_TRANSLATE_PREFIX}{locale}{DEFAULT_PROMPT_TRANSLATE_SUFFIX}")
        }
        AiAction::DraftOutline => DEFAULT_PROMPT_DRAFT_OUTLINE.to_string(),
        AiAction::DraftPost => DEFAULT_PROMPT_DRAFT_POST.to_string(),
        AiAction::AutoTag => DEFAULT_AUTO_TAG_PROMPT.to_string(),
        AiAction::AltText => DEFAULT_ALT_TEXT_PROMPT.to_string(),
        AiAction::ImageCaption => DEFAULT_IMAGE_CAPTION_PROMPT.to_string(),
        AiAction::ImageTitle => DEFAULT_IMAGE_TITLE_PROMPT.to_string(),
        // For section_content the prompt depends on section_context; that path is
        // handled in `generate()` rather than here so this fallback is only hit
        // if a caller bypasses the structured path.
        AiAction::SectionContent => DEFAULT_PROMPT_SECTION_CONTENT_PREFIX.to_string(),
        // BlogTags is similarly built from blog_tag_context in generate(); this
        // fallback is for direct callers that bypass the structured path.
        AiAction::BlogTags => DEFAULT_PROMPT_BLOG_TAGS_PREFIX.to_string(),
    }
}

/// Returns the output format suffix based on provider type and action.
/// Always appended to the system prompt (custom or default) so the model
/// knows how to structure its response.
pub(crate) fn format_suffix(action: &AiAction, use_json: bool) -> &'static str {
    if use_json {
        match action {
            AiAction::Seo => JSON_FORMAT_SEO,
            AiAction::Excerpt => JSON_FORMAT_EXCERPT,
            AiAction::Translate => JSON_FORMAT_TRANSLATE,
            AiAction::DraftOutline => JSON_FORMAT_DRAFT_OUTLINE,
            AiAction::DraftPost => JSON_FORMAT_DRAFT_POST,
            AiAction::SectionContent => JSON_FORMAT_SECTION_CONTENT,
            AiAction::BlogTags => JSON_FORMAT_BLOG_TAGS,
            // Vision actions embed their format instructions in the system prompt
            AiAction::AutoTag
            | AiAction::AltText
            | AiAction::ImageCaption
            | AiAction::ImageTitle => "",
        }
    } else {
        match action {
            AiAction::Seo => XML_FORMAT_SEO,
            AiAction::Excerpt => XML_FORMAT_EXCERPT,
            AiAction::Translate => XML_FORMAT_TRANSLATE,
            AiAction::DraftOutline => XML_FORMAT_DRAFT_OUTLINE,
            AiAction::DraftPost => XML_FORMAT_DRAFT_POST,
            AiAction::SectionContent => XML_FORMAT_SECTION_CONTENT,
            AiAction::BlogTags => XML_FORMAT_BLOG_TAGS,
            AiAction::AutoTag
            | AiAction::AltText
            | AiAction::ImageCaption
            | AiAction::ImageTitle => "",
        }
    }
}

/// Append a language instruction to non-translate prompts when a target locale is specified.
/// This ensures the AI generates content in the site's default language regardless of input language.
pub(crate) fn append_language_instruction(
    prompt: &str,
    action: &AiAction,
    locale: Option<&str>,
) -> String {
    if matches!(
        action,
        AiAction::Translate | AiAction::AutoTag | AiAction::BlogTags
    ) {
        return prompt.to_string();
    }
    match locale {
        Some(lang) => format!(
            "{prompt}\n\nIMPORTANT: Write ALL content in {lang}. \
             Regardless of the language of the user's input, your output MUST be in {lang}."
        ),
        None => prompt.to_string(),
    }
}

pub fn default_prompt_translate_for_locale(locale: &str) -> String {
    format!("{DEFAULT_PROMPT_TRANSLATE_PREFIX}{locale}{DEFAULT_PROMPT_TRANSLATE_SUFFIX}")
}

/// Strip any existing JSON or XML format instructions from a custom prompt.
/// Users may have saved prompts containing old "Respond with ONLY valid JSON..." text.
pub(crate) fn strip_format_instructions(prompt: &str) -> &str {
    // Find the last sentence boundary before any format instruction
    let markers = [
        "\nRespond with ONLY",
        "\nRespond using ONLY",
        "Respond with ONLY valid JSON",
        "Respond using ONLY these XML",
    ];
    let mut end = prompt.len();
    for marker in &markers {
        if let Some(pos) = prompt.find(marker) {
            end = end.min(pos);
        }
    }
    prompt[..end].trim_end()
}

pub(crate) fn field_translation_prompt(field_name: &str, locale: &str) -> String {
    let base = format!("Translate the following text to {locale}.");
    let constraint = match field_name {
        "title" => "This is a TITLE. Output ONLY the translated title as plain text. \
                    No markdown, no headings, no formatting, no quotes. Keep it concise (under 100 characters).",
        "subtitle" => "This is a SUBTITLE. Output ONLY the translated subtitle as plain text. \
                      No markdown, no headings, no formatting, no quotes. Keep it concise (under 150 characters).",
        "excerpt" => "This is a short EXCERPT (summary). Output ONLY the translated excerpt as a single sentence. \
                     No markdown, no headings, no formatting, no quotes. Maximum 2 sentences.",
        "body" => "This is the BODY content. Maintain any markdown formatting from the original. \
                  Output ONLY the translated text.",
        "text" => "This is the localized TEXT of a page section. \
                  Maintain any markdown formatting from the original. \
                  Output ONLY the translated text — no preamble, no quotes.",
        "button_text" => "This is a BUTTON / CTA label. Output ONLY the translated label as plain text. \
                         No markdown, no quotes, no trailing punctuation. Keep it short (2–4 words).",
        "meta_title" => "This is an SEO meta title. Output ONLY the translated title as plain text. \
                        No markdown, no formatting, no quotes. Maximum 60 characters.",
        "meta_description" => "This is an SEO meta description. Output ONLY the translated description as plain text. \
                              No markdown, no formatting, no quotes. Maximum 160 characters.",
        _ => "Output ONLY the translated text, nothing else.",
    };
    format!("{base} {constraint}")
}
