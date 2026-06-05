---
sidebar_position: 14
---

# User Moderation

System administrators can suspend, ban, and delete users from the **System > Users** page. Moderation actions affect all sites -- a suspended or banned user cannot access any part of the CMS.

## Accessing User Moderation

Navigate to **System > Users** in the sidebar. This page is only visible to system administrators.

## User List

The user table displays all Clerk users with the following columns:

| Column | Description |
|--------|-------------|
| **User** | Avatar and display name |
| **Email** | Primary email address |
| **Status** | Moderation status badge: Active (green), Suspended (amber), or Banned (red). If a reason was provided, it is shown next to the badge |
| **Last Sign In** | Date of the user's most recent sign-in |
| **Actions** | Context menu (system admins only) |

Click any row to open the user detail page.

## Moderation Actions

The action menu adapts based on the user's current status:

| Current Status | Available Actions |
|----------------|-------------------|
| **Active** | Suspend, Ban |
| **Suspended** | Unsuspend, Ban |
| **Banned** | Delete User |

### Suspend

Temporarily blocks a user from accessing the CMS. You must provide:

- **Reason** -- why the user is being suspended (visible to other admins)
- **Duration** -- how long the suspension lasts (in hours, 1--8760)

Once the suspension expires, the user is automatically restored to active status on their next API call.

### Ban

Permanently blocks a user from accessing the CMS. You must provide a reason. A ban cannot be lifted -- the user can only be deleted.

### Unsuspend

Immediately lifts a suspension and restores the user to active status. Only available for suspended users.

### Delete User

Permanently deletes a banned user and all associated data. This action:

- Removes all site memberships (the user loses access to every site)
- Disassociates content created by the user (content remains but `created_by` is cleared)
- Deletes the moderation record
- Deletes the user's Clerk account

**This action is irreversible.** A safeword confirmation dialog requires you to type "Delete" before proceeding.

## User Detail Page

Click any user in the list to view their detail page at `/system/users/:id`. The page includes:

- **Profile card** -- avatar, name, email, status badge with reason (if suspended/banned), join date, and last sign-in date
- **Activity timeline** -- paginated list of audit log entries for that user, showing action type, entity, IP address, and timestamp

## How Moderation Works

When a user is suspended or banned, the auth guard checks their moderation status on every API request:

- **Suspended users** receive a `403 Forbidden` response with error code `ACCOUNT_SUSPENDED`
- **Banned users** receive a `403 Forbidden` response with error code `ACCOUNT_BANNED`
- **Expired suspensions** are automatically lifted -- the user is restored to active status without admin intervention

All moderation actions are recorded in the audit log.
