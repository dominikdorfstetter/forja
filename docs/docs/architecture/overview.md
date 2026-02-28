---
title: Architecture Overview
sidebar_position: 1
description: High-level architecture of the OpenYapper multi-site CMS.
---

# Architecture Overview

OpenYapper is a multi-site, headless CMS built for developer portfolios and blogs. It uses a three-layer architecture that cleanly separates the API, the admin interface, and the frontend rendering.

## System Diagram

```
                     +------------------------------+
                     |      Frontend Templates      |
                     |   (Astro, Next.js, etc.)      |
                     +-------------+----------------+
                                   |
                            REST API calls
                            (CMS_API_URL + CMS_API_KEY)
                                   |
+---------------------+           |
|   Admin Dashboard   |           |
|  (React SPA @ :5173)|           |
+--------+------------+           |
         |                        |
     Clerk JWT /                  |
     proxied to backend           |
         |                        |
         v                        v
+------------------------------------------------+
|              Backend API (Rust)                 |
|          Rocket 0.5  /  Port 8000               |
|          Prefix: /api/v1                        |
|                                                 |
|  Handlers -> Services -> Models -> Database     |
+--------+-------------------+-------------------+
         |                   |
         v                   v
+----------------+   +----------------+
|  PostgreSQL 16 |   |     Redis      |
|  (data store)  |   | (rate limits)  |
+----------------+   +----------------+

         +-------------------+
         |  Object Storage   |
         | (local or S3)     |
         +-------------------+
```

## The Three Layers

### 1. Backend API (Rust / Rocket)

The backend is the core of the system. It is a REST API written in Rust using the Rocket 0.5 framework, backed by PostgreSQL via SQLx and optionally Redis for rate limiting. It serves all content, authentication, and management endpoints under `/api/v1`.

Key responsibilities:
- CRUD operations for all content types (blogs, pages, media, navigation, legal docs, CV entries, etc.)
- Authentication and authorization (API keys and Clerk JWTs)
- Media file storage (local filesystem or S3-compatible)
- Rate limiting, audit logging, webhook delivery
- OpenAPI documentation via utoipa, served at `/api-docs`

### 2. Admin Dashboard (React SPA)

The admin dashboard is a React single-page application built with Vite. It is served by the backend at `/dashboard` and communicates with the API on the same origin. Authentication is handled through Clerk.

Key responsibilities:
- Site management and content editing
- Media library with folder organization
- User and API key management
- Navigation menu builder
- Webhook and redirect configuration

### 3. Frontend Templates (Bring Your Own)

OpenYapper is headless. Frontend sites consume the API using an API key. Any framework works -- Astro, Next.js, Hugo, or plain HTML. The frontend fetches content from the backend using `CMS_API_URL` and authenticates with `CMS_API_KEY`.

## Request Flow

A typical request through the system follows this path:

1. **Incoming request** arrives at the Rocket server on port 8000.
2. **CORS and security headers** are applied by the response fairing.
3. **Authentication guard** runs as a Rocket request guard:
   - Checks for `Authorization: Bearer <JWT>` (Clerk) first.
   - Falls back to `X-API-Key` header.
   - Validates credentials and resolves permissions.
4. **Rate limiting** is checked against Redis (if available). Loopback IPs are exempt.
5. **Handler** receives the authenticated request, deserializes input, and validates via DTO.
6. **Service layer** executes business logic (optional, used for complex operations).
7. **Model** performs database queries via SQLx.
8. **Response** is serialized as JSON and returned with appropriate status codes and rate limit headers.

## Infrastructure

OpenYapper requires the following infrastructure components:

| Component       | Purpose                        | Required |
|-----------------|--------------------------------|----------|
| PostgreSQL 16   | Primary data store             | Yes      |
| Redis           | Rate limiting counters         | No (graceful degradation) |
| Object Storage  | Media files (local disk or S3) | Yes (local is default)    |

### Docker Compose (Development)

A typical development setup uses Docker Compose for Postgres and Redis while running the backend and admin natively:

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: openyapper
      POSTGRES_USER: openyapper
      POSTGRES_PASSWORD: secret
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
```

The backend connects via `DATABASE_URL` and `REDIS_URL` environment variables. If Redis is unavailable, the API continues to function with rate limiting disabled.

## Key Design Decisions

- **Multi-tenant by design**: All content is scoped to a `site_id`. A single deployment serves multiple independent sites.
- **Localization-first**: Content tables use a separate `*_localizations` table pattern, allowing any content to exist in multiple languages.
- **Fail-open rate limiting**: If Redis goes down, requests are allowed through rather than blocked.
- **Dual authentication**: API keys for machine-to-machine access, Clerk JWTs for human users in the admin dashboard.
- **OpenAPI-first**: All endpoints are documented with utoipa macros, and Swagger UI is served at `/api-docs`.
