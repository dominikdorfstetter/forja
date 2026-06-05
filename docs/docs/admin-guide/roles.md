---
sidebar_position: 4
---

# Roles & Permissions

Forja uses role-based access control (RBAC) to manage what each team member can do on a site. Roles are assigned **per site**, so the same user can be an Editor on one site and a Viewer on another.

## Role Hierarchy

Forja defines six roles, listed from most to least privileged:

| Role | Description |
|------|-------------|
| **Owner** | The site creator. Full control including ownership transfer and site deletion. One per site. |
| **Admin** | Full site management -- settings, members, webhooks, API keys, and all content operations. |
| **Editor** | Can manage all content (including other authors' work) and publish directly. |
| **Author** | Can create and edit their own content. When editorial workflow is enabled, must submit for review before publishing. |
| **Reviewer** | Can review content that has been submitted for approval -- approve or request changes. |
| **Viewer** | Read-only access. Can view all content and settings but cannot make changes. |

## Permission Matrix

| Capability | Owner | Admin | Editor | Author | Reviewer | Viewer |
|------------|:-----:|:-----:|:------:|:------:|:--------:|:------:|
| View content | x | x | x | x | x | x |
| Create content | x | x | x | x | | |
| Edit own content | x | x | x | x | | |
| Edit any content | x | x | x | | | |
| Publish directly | x | x | x | | | |
| Submit for review | x | x | x | x | x | |
| Approve / reject reviews | x | x | x | | x | |
| Schedule content | x | x | x | | | |
| Archive / restore | x | x | x | | | |
| Manage media | x | x | x | x | | |
| Manage navigation | x | x | x | | | |
| Manage taxonomy | x | x | x | | | |
| Manage webhooks | x | x | | | | |
| Manage API keys | x | x | | | | |
| Manage redirects | x | x | | | | |
| Manage site settings | x | x | | | | |
| Manage members | x | x | | | | |
| Transfer ownership | x | | | | | |
| Delete site | x | | | | | |

## Small Team Setup

For solo creators or small teams (1--3 people), the default configuration works out of the box. When the **editorial workflow is disabled** (the default), any user with write access can publish content directly.

A typical small-team setup:

| Member | Role | Why |
|--------|------|-----|
| You | Owner | Full control over the site |
| Collaborator | Editor | Can create, edit, and publish any content |

In this setup there is no review gate -- everyone who can write can also publish. This keeps things fast and frictionless when you trust your team.

:::tip
Forja prompts you to consider enabling editorial workflow when your site gets its first additional contributor. You can dismiss this prompt if you prefer the simpler model.
:::

## Editorial Workflow

For larger teams or organizations that need content review before publishing, enable the **editorial workflow** toggle in **Settings > Feature Toggles**.

When editorial workflow is enabled, the content lifecycle changes:

```
Draft  ──▶  In Review  ──▶  Published
  ▲             │
  │         Rejected
  └─────────────┘
```

### How roles interact with the workflow

- **Authors** write drafts and submit them for review. They **cannot** publish directly.
- **Reviewers** see submitted content and can **approve** (moves to Published) or **request changes** (moves back to Draft with feedback).
- **Editors** have full control -- they can submit, review, approve, publish, and bypass the workflow when needed.
- **Admins and Owners** have all Editor capabilities plus site management.

### A typical editorial team

| Member | Role | Responsibility |
|--------|------|----------------|
| Site owner | Owner | Overall site management, billing |
| Managing editor | Admin | Site configuration, member management |
| Senior writer | Editor | Publishes directly, reviews others' work |
| Writers | Author | Draft content, submit for review |
| Guest reviewer | Reviewer | Review and approve submitted content |
| Stakeholder | Viewer | Read-only access for oversight |

### Published content protection

Even outside the editorial workflow, Forja protects published content. Authors can only edit their **own** content, and once content is Published, Scheduled, or Archived, only Editors and above can modify it. This prevents accidental changes to live content by writers who are still learning the system.

## Changing Roles

1. Navigate to **Site Settings** in the sidebar, then open the **Members** tab.
2. Find the member whose role you want to change.
3. Select a new role from the dropdown.
4. The change takes effect immediately.

Only **Owners** and **Admins** can change member roles. Owners can assign any role including Admin. Admins cannot assign the Owner or Admin role to others.

## Transferring Ownership

The Owner role cannot be assigned through the role dropdown. To transfer ownership:

1. Go to **Members**.
2. Find the member you want to make the new owner.
3. Click the **Transfer Ownership** action.
4. Confirm the transfer.

After transfer, you are automatically downgraded to Admin on that site.

:::caution
Ownership transfer is irreversible through the UI. Only the new owner can transfer it back.
:::

## API Key Permissions

API keys use a simplified four-level model that maps to the role hierarchy:

| API Key Permission | Equivalent To | Use Case |
|-------------------|---------------|----------|
| **Master** | Owner | CI/CD pipelines, admin scripts |
| **Admin** | Admin | Site management automation |
| **Write** | Editor | Content creation tools, import scripts |
| **Read** | Viewer | Frontend data fetching, public API consumers |

When creating an API key, you can only assign a permission level up to your own role's maximum.
