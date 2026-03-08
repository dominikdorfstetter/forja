---
sidebar_position: 17
---

# AI Content Assist

AI Content Assist lets you use large language models to generate blog drafts, SEO metadata, excerpts, and translations directly inside the admin dashboard. It connects to a provider of your choice and keeps your API key encrypted at rest.

:::info
AI Content Assist is a **site module**. It must be enabled during site creation or in your site's module settings before it appears in the dashboard.
:::

## Supported Providers

Forja ships with presets for popular providers. You can also point it at any OpenAI-compatible endpoint.

| Provider | Default Base URL | Default Model | API Key Required |
|----------|-----------------|---------------|------------------|
| **OpenAI** | `https://api.openai.com` | gpt-4o-mini | Yes |
| **Anthropic (Claude)** | `https://api.anthropic.com` | claude-sonnet-4-20250514 | Yes |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | gemini-2.0-flash | Yes |
| **Mistral** | `https://api.mistral.ai` | mistral-small-latest | Yes |
| **LM Studio** | `http://localhost:1234` | (auto-detect) | No |
| **Ollama** | `http://localhost:11434` | (auto-detect) | No |
| **Custom** | (you provide) | (you provide) | Configurable |

Local providers (LM Studio, Ollama, or any `localhost` URL) do not require an API key.

## Setting Up AI

1. Navigate to **AI Settings** in the sidebar (visible only when the AI module is enabled).
2. Select a **Provider** from the preset dropdown, or choose **Custom** and enter your own base URL.
3. Enter your **API Key** if the provider requires one. The key is encrypted with AES-256-GCM before storage and never displayed in full again.
4. Choose a **Model**. You can type a model name directly or click the refresh icon to **Discover available models** from the provider.
5. Click **Save**.

:::tip
After saving, click **Test Connection** to verify that Forja can reach your provider and the API key is valid. The test sends a minimal prompt and reports success or failure.
:::

## Configuration Options

### Basic Settings

| Setting | Description |
|---------|-------------|
| **Provider** | The AI service to use. Selecting a preset auto-fills the base URL and default model. |
| **Base URL** | The API endpoint. Auto-filled for presets, editable for custom providers. |
| **API Key** | Your provider's secret key. Encrypted at rest, masked in the UI after saving. |
| **Model** | The model to use for generation. Free-text or select from discovered models. |

### Advanced Settings

Expand the **Advanced Settings** accordion to access fine-tuning options:

| Setting | Default | Description |
|---------|---------|-------------|
| **Temperature** | 0.7 | Controls randomness (0 = deterministic, 2 = very creative). |
| **Max Tokens** | 1,024 | Maximum length of generated output (1 -- 16,384). |
| **SEO Generation Prompt** | Built-in | Custom system prompt for SEO metadata generation. |
| **Excerpt Generation Prompt** | Built-in | Custom system prompt for excerpt generation. |
| **Translation Prompt** | Built-in | Custom system prompt for content translation. |

:::info
Leave system prompt fields empty to use Forja's built-in defaults. When you provide a custom prompt, it fully replaces the default -- Forja does not merge them.
:::

## AI Capabilities

### Blog Draft Generation

Create a full blog post from an idea in three steps:

1. **Describe your idea** -- enter a topic, angle, or key points you want to cover.
2. **Review the outline** -- Forja generates a title, subtitle, and structured outline. You can edit, reorder, add, or remove points before proceeding.
3. **Generate the post** -- Forja writes the full Markdown body, excerpt, and SEO metadata from your approved outline. Review and edit the result before saving.

The same AI-assisted workflow is available from:
- The **Create Blog** wizard (select **AI Assist** as the creation method)
- The **Quick Post** dialog (toggle from **Write** to **AI Assist**)

### SEO Metadata Generation

On the blog editor's **SEO** tab, click **Generate SEO** to produce a meta title (max 60 characters) and meta description (max 160 characters) from your post's content.

:::info
The button is disabled until your post body has at least 50 characters of content.
:::

### Excerpt Generation

On the blog editor's **SEO** tab, click **Generate Excerpt** to produce a concise 1 -- 2 sentence summary of your post. The same 50-character minimum applies.

### AI-Powered Translation

When your site has multiple locales, the blog editor toolbar shows an **AI Translate** button:

1. Click **AI Translate** and select a **Target Locale**.
2. Click **Suggest Translation** -- Forja translates all fields (title, subtitle, excerpt, body, meta title, meta description) in one request.
3. Review the translation preview. Each field has a **refresh** button to re-translate that field individually.
4. Click **Apply** to populate the target locale's fields with the translated content.

Translations preserve Markdown formatting and respect field-specific constraints (e.g. meta title length).

## API Key Security

- Keys are encrypted with **AES-256-GCM** before being stored in the database.
- The encryption key is derived from the `AI_ENCRYPTION_KEY` environment variable (base64-encoded, 32 bytes).
- The API response always returns a **masked** key (e.g. `sk-123...abcd`) -- the full key is never sent back to the client.
- Deleting the AI configuration removes the encrypted key from the database entirely.

## Module Gating

When the AI module is **disabled** for a site:

- The **AI Settings** page is hidden from the sidebar.
- AI generation buttons (SEO, excerpt, translate, draft) do not appear in the blog editor.
- AI endpoints return `403 Forbidden` for generation requests.
- Configuration endpoints (GET/PUT/DELETE config, test, models) remain accessible to admins, so you can set up the provider before enabling the module.

## Removing the Configuration

1. Navigate to **AI Settings**.
2. Click **Remove Configuration** at the bottom of the page.
3. Confirm the action in the dialog.

This deletes the provider configuration and encrypted API key. AI features are disabled until you configure a new provider. No previously generated content is affected.

## Permissions

| Action | Required Role |
|--------|--------------|
| View / modify AI configuration | Admin |
| Test provider connection | Admin |
| Discover models | Admin |
| Generate content (SEO, excerpt, draft, translate) | Author |
