---
sidebar_position: 2
---

# Authentication

Forja uses [Clerk](https://clerk.com) for authentication in the admin dashboard. Clerk provides a secure, hosted identity layer with support for email/password, social logins, and multi-factor authentication.

## Signing In

1. Navigate to your dashboard URL (`/dashboard`).
2. If you are not authenticated, you are automatically redirected to `/dashboard/login`.
3. On the login page, enter your email and password, or select a social login provider (Google, GitHub, etc., depending on your Clerk configuration).
4. After successful authentication, you are redirected to the home dashboard.

## Signing Up

If your Clerk instance has sign-up enabled:

1. Click the **Sign up** link on the login page.
2. Fill in your details (email, password, name).
3. Verify your email address if required by your Clerk configuration.
4. Once verified, you can sign in and access the dashboard.

:::info
New users do not automatically have access to any site. A site owner or admin must add them as a member before they can manage content. See [Members](./members) for details.
:::

## Role-Based Access Control

Forja uses a six-tier permission model. Each user is assigned a role per site that determines what they can do:

| Role | Capabilities |
|------|-------------|
| **Owner** | Full control including ownership transfer and site deletion. One per site. |
| **Admin** | Full site management -- settings, members, webhooks, API keys, and all content. |
| **Editor** | Can manage all content (including other authors' work) and publish directly. |
| **Author** | Can create and edit their own content. Must submit for review when editorial workflow is enabled. |
| **Reviewer** | Can review and approve/reject content submitted for review. |
| **Viewer** | Read-only access. Can view content and settings but cannot make changes. |

For a detailed breakdown of what each role can do, including how the editorial workflow changes permissions, see [Roles & Permissions](./roles).

### How Roles Are Assigned

- Roles are set per site membership. You might be an **Editor** on one site and a **Viewer** on another.
- The site creator automatically becomes the **Owner**.
- Roles can be changed by **Owners** and **Admins**.

### Clerk Role Mapping

When authenticating via a Clerk JWT, the role claim in the token is mapped to an Forja permission level. The mapping is configured in the backend and follows this flow:

1. User signs in via Clerk.
2. The React app sends the JWT in the `Authorization: Bearer <token>` header.
3. The backend validates the JWT against Clerk's JWKS endpoint.
4. The role claim from the token is mapped to one of the six permission levels.
5. The user's Clerk `sub` claim is converted to a deterministic UUID v5 for internal use.

## Session Management

- Sessions are managed by Clerk. The session token is stored securely in the browser.
- Session duration and expiry are configured in your Clerk dashboard.
- When the session expires, the user is redirected to the login page.

## Signing Out

Click your **profile avatar** in the top bar, then select **Sign out**. This clears your session and redirects you to the login page.

## API Authentication

In addition to Clerk JWTs, Forja supports API key authentication via the `X-API-Key` header. API keys are used for programmatic access (frontends, CI/CD pipelines, scripts). See [API Keys](./api-keys) for details on creating and managing API keys.

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Stuck on login page | Clear your browser cookies and try again. Check that your Clerk publishable key is correctly set (`VITE_CLERK_PUBLISHABLE_KEY`). |
| "Unauthorized" errors after login | Your Clerk JWT may have expired. Sign out and sign back in. |
| Cannot access a site | Ask a site admin to add you as a member. See [Members](./members). |
| Social login not working | Verify that the social provider is enabled in your Clerk dashboard. |
