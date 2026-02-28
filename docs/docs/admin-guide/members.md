---
sidebar_position: 13
---

# Members

Members are the users who have access to a specific site within OpenYapper. The members page lets you manage who can access your site and what they can do.

![Members management](/img/screenshots/admin-members.png)

## Accessing Members

Navigate to **Members** in the sidebar. The page shows all members of the currently selected site.

## Member Listing

| Column | Description |
|--------|-------------|
| **Name** | The member's display name. |
| **Email** | The member's email address. |
| **Role** | Their permission level on this site (Admin, Write, or Read). |
| **Joined** | When they were added to the site. |
| **Last active** | When they last accessed the site. |

## Adding a Member

1. Click the **Add Member** button.
2. Search for the user by email or name. The user must already have a Clerk account.
3. Select the user from the search results.
4. Assign a **role**:
   - **Admin** -- full access to the site, including member and settings management.
   - **Write** -- can create, edit, and delete content.
   - **Read** -- view-only access.
5. Click **Add**. The user now has access to this site and it appears in their site selector.

:::info
The user must have an existing Clerk account before they can be added as a member. They can create one by visiting the login page and signing up.
:::

## Changing a Member's Role

1. Click on a member in the listing.
2. Select a new role from the role dropdown.
3. Save the change.

Role changes take effect immediately. The member's permissions update the next time they make a request.

## Removing a Member

1. Click on the member you want to remove.
2. Click **Remove** and confirm.

The member loses access to this site immediately. They can no longer see it in their site selector.

:::caution
Removing a member does not delete any content they created. Their content remains associated with the site.
:::

## Transferring Ownership

If you need to transfer site ownership to another member:

1. Navigate to the members page.
2. Find the member who should become the new owner.
3. Click the **Transfer ownership** option (available to the current owner or a Master-level user).
4. Confirm the transfer.

The new owner receives Admin-level permissions, and the previous owner retains their current role.

## Site Owner

Every site has an owner -- the user who created it. The owner:

- Cannot be removed from the site without transferring ownership first.
- Has Admin-level permissions that cannot be downgraded.
- Can transfer ownership to another member.

## Permissions

| Action | Required Role |
|--------|--------------|
| View members | Admin, Master |
| Add members | Admin, Master |
| Change member roles | Admin, Master |
| Remove members | Admin, Master |
| Transfer ownership | Site owner, Master |
