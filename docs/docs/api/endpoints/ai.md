---
sidebar_position: 19
---

# AI

Endpoints for configuring AI providers and generating content with large language models.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/ai/config` | Admin | Retrieve AI configuration |
| PUT | `/sites/{site_id}/ai/config` | Admin | Create or update AI configuration |
| DELETE | `/sites/{site_id}/ai/config` | Admin | Remove AI configuration |
| POST | `/sites/{site_id}/ai/test` | Admin | Test provider connection |
| POST | `/sites/{site_id}/ai/generate` | Author | Generate content |
| POST | `/sites/{site_id}/ai/models` | Admin | List available models |

## Get AI Configuration

Returns the AI provider configuration for a site. The API key is always returned in masked form.

```bash
curl https://your-site.com/api/v1/sites/{site_id}/ai/config \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK`

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "site_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "provider_name": "OpenAI",
  "base_url": "https://api.openai.com",
  "api_key_masked": "sk-abc1...xyz9",
  "model": "gpt-4o-mini",
  "temperature": 0.7,
  "max_tokens": 1024,
  "system_prompts": {},
  "updated_at": "2026-03-08T10:30:00Z"
}
```

Returns `404` if no AI configuration exists for the site.

## Create or Update AI Configuration

Creates a new configuration or updates the existing one (upsert). The API key is encrypted with AES-256-GCM before storage.

```bash
curl -X PUT https://your-site.com/api/v1/sites/{site_id}/ai/config \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_name": "OpenAI",
    "base_url": "https://api.openai.com",
    "api_key": "sk-...",
    "model": "gpt-4o-mini",
    "temperature": 0.7,
    "max_tokens": 1024,
    "system_prompts": {
      "seo": "You are an SEO expert. Generate a meta title and description.",
      "excerpt": "Summarize the content in 1-2 sentences.",
      "translate": "Translate the content professionally."
    }
  }'
```

**Request Body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `provider_name` | string | Yes | 1 -- 100 chars | Display name (e.g. "OpenAI", "Claude") |
| `base_url` | string | Yes | 1 -- 500 chars | Provider API endpoint |
| `api_key` | string | No | max 500 chars | Provider secret key. Omit for local providers. |
| `model` | string | Yes | 1 -- 200 chars | Model identifier (e.g. "gpt-4o-mini") |
| `temperature` | number | No | 0.0 -- 2.0 | Sampling temperature. Default: `0.7` |
| `max_tokens` | integer | No | >= 1 | Maximum output tokens. Default: `1024` |
| `system_prompts` | object | No | | Custom prompts keyed by action (`seo`, `excerpt`, `translate`, `draft_outline`, `draft_post`). Empty uses built-in defaults. |

**Response** -- `200 OK` with the saved configuration (API key masked).

Logs an audit event: `Update` on `ai_config`.

## Delete AI Configuration

Removes the AI configuration and encrypted API key for a site.

```bash
curl -X DELETE https://your-site.com/api/v1/sites/{site_id}/ai/config \
  -H "X-API-Key: your_api_key"
```

**Response** -- `204 No Content`

## Test Provider Connection

Sends a minimal prompt to the configured provider to verify connectivity and API key validity. Always returns `200` with a success flag -- never fails with a provider error status.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/ai/test \
  -H "X-API-Key: your_api_key"
```

**Response** -- `200 OK`

```json
{
  "success": true,
  "message": "Connection successful — AI provider responded correctly."
}
```

On failure:

```json
{
  "success": false,
  "message": "Connection failed: 401 Unauthorized"
}
```

Returns `404` if no AI configuration exists for the site.

## Generate Content

Generates AI content based on the specified action. Requires the AI module to be enabled for the site.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/ai/generate \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "seo",
    "content": "Your blog post content here..."
  }'
```

**Request Body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `action` | string | Yes | See table below | The type of content to generate |
| `content` | string | Yes | 1 -- 50,000 chars | Input content for generation |
| `target_locale` | string | No | | Target language code. Required when `action` is `translate`. |

**Actions**

| Action | Input | Output Fields |
|--------|-------|---------------|
| `seo` | Blog body content | `meta_title`, `meta_description` |
| `excerpt` | Blog body content | `excerpt` |
| `translate` | JSON with translatable fields + `target_locale` | `title`, `subtitle`, `excerpt`, `body`, `meta_title`, `meta_description` |
| `draft_outline` | Topic idea or description | `title`, `subtitle`, `outline` |
| `draft_post` | Title + outline text | `body`, `excerpt`, `meta_title`, `meta_description` |

**Response** -- `200 OK`

```json
{
  "meta_title": "How to Build a Headless CMS",
  "meta_description": "Learn how to build a fast, modern headless CMS with Rust and React.",
  "excerpt": "A practical guide to building a headless CMS from scratch.",
  "title": null,
  "subtitle": null,
  "body": null,
  "outline": null
}
```

Fields not applicable to the requested action are returned as `null`.

**Errors**

| Status | Condition |
|--------|-----------|
| `400` | AI not configured, invalid action, missing `target_locale` for translate |
| `403` | AI module disabled for the site |
| `429` | Rate limited by provider |

Logs an audit event: `Create` on `ai_generation` with the action type.

### Translation Input Format

The `translate` action expects `content` to be a JSON string containing the fields to translate:

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/ai/generate \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "translate",
    "content": "{\"title\": \"My Post\", \"body\": \"Full content here...\"}",
    "target_locale": "de"
  }'
```

Each field is translated individually with constraints appropriate to its type (e.g. meta titles respect length limits). Markdown formatting is preserved in the `body` field.

## List Available Models

Queries the provider's API to discover which models are available. Useful for populating a model selector in the UI.

```bash
curl -X POST https://your-site.com/api/v1/sites/{site_id}/ai/models \
  -H "X-API-Key: your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "base_url": "https://api.openai.com",
    "api_key": "sk-...",
    "provider_name": "OpenAI"
  }'
```

**Request Body**

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `base_url` | string | Yes | 1 -- 500 chars | Provider API endpoint |
| `api_key` | string | No | max 500 chars | Provider secret key |
| `provider_name` | string | Yes | 1 -- 100 chars | Provider name for detection logic |

**Response** -- `200 OK`

```json
{
  "models": [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-4-turbo",
    "gpt-3.5-turbo"
  ]
}
```

:::info
For **Anthropic**, model listing returns a static list of known Claude models rather than querying an API. For **Ollama**, Forja tries the `/api/tags` endpoint first, then falls back to `/v1/models`.
:::

## Provider Detection

Forja auto-detects the provider type from the URL and name to choose the correct API format:

| Condition | Detected As | Behavior |
|-----------|-------------|----------|
| URL contains `anthropic.com` or name contains "claude" / "anthropic" | Anthropic | Uses Messages API format |
| URL port `:11434` or name contains "ollama" | Ollama | Special model listing |
| URL is `localhost` / `127.0.0.1` / `0.0.0.0` | Local provider | Disables JSON mode, uses XML output |
| Everything else | OpenAI-compatible | Standard Chat Completions API |
