---
sidebar_position: 22
title: Profile
description: View and manage your user profile
---

# Profile

The Profile page lets you view your account information, export your data, and manage your account. User identity and authentication are handled by Clerk, so most profile fields are read-only within Forja.

## Accessing Your Profile

Click your **avatar** or **user icon** in the top bar to open the user menu, then select **Profile**. You can also reach the profile page via the command palette by typing "profile".

## User Information

The profile page displays the following details from your Clerk account:

| Field | Description |
|-------|-------------|
| **Name** | Your full name as set in Clerk. |
| **Email** | Your primary email address. |
| **Avatar** | Your profile picture. |

:::note
To update your name, email, or avatar, use the Clerk user management portal. Changes are reflected in Forja automatically on your next sign-in.
:::

## Data Export (GDPR)

Forja provides a data export feature so you can download a copy of all data associated with your account.

1. On the Profile page, click **Export My Data**.
2. Forja generates a JSON file containing your account information, content, and activity.
3. The file downloads to your browser automatically.

The export includes all user-associated data across every site you belong to. This supports GDPR "right of access" requirements.

## Account Deletion

If you want to permanently remove your account from Forja:

1. On the Profile page, click **Delete Account**.
2. A confirmation dialog explains what will be deleted.
3. Confirm to proceed.

:::warning
Account deletion is permanent and cannot be undone. All of your content, settings, and site memberships will be removed. If you are the sole owner of a site, that site and its data will also be deleted.
:::

## Session Management

To sign out of your current session, open the user menu in the top bar and click **Sign Out**. This ends your session on the current device. To manage sessions across multiple devices, use the Clerk user portal.

## Next Steps

- [Authentication](./authentication) -- learn about sign-in methods and session handling.
- [Help System](./help-system) -- keyboard shortcuts, quick tour, and contextual help.
- [Settings](./settings) -- configure site-level settings.
