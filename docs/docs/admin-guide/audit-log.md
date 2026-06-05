---
sidebar_position: 14
---

# Audit Log

The audit log provides a complete trail of all actions performed within your site. Every create, update, and delete operation is recorded, giving you full visibility into who changed what and when.

## Accessing the Audit Log

Navigate to **Activity** (Audit Log) in the sidebar. The page shows the audit trail for the currently selected site.

## Audit Log Listing

The audit log displays entries in reverse chronological order (newest first):

| Column | Description |
|--------|-------------|
| **Timestamp** | When the action occurred. |
| **User** | Who performed the action. |
| **Action** | The type of action: Created, Updated, or Deleted. |
| **Entity type** | The type of resource affected (Blog, Page, Media, Navigation, etc.). |
| **Entity** | The name or title of the affected resource. |
| **Details** | A summary of what changed. |

## Filtering the Audit Log

Use the filters at the top of the page to narrow down the audit trail:

- **Date range** -- show entries within a specific time period.
- **User** -- filter by the user who performed the action.
- **Action type** -- filter by Created, Updated, or Deleted.
- **Entity type** -- filter by resource type (Blog, Page, Media, etc.).

## Viewing Change Details

Click on an audit log entry to see the full details of the change:

- **Before** -- the state of the resource before the change (for updates).
- **After** -- the state of the resource after the change (for creates and updates).
- **Changed fields** -- a highlighted diff showing which fields were modified.

This detail view lets you see exactly what changed in each update.

## Entity History

To see the complete history of a specific resource:

1. Navigate to the resource (e.g., a blog post or page).
2. Look for a **History** or **Activity** tab in the detail view.
3. The entity history shows all audit log entries related to that specific resource, in chronological order.

This gives you a timeline of every modification made to that resource.

## Reverting Changes

For certain entity types, you can revert a change:

1. Open the audit log entry detail view.
2. Review the "Before" state.
3. Click **Revert** to restore the resource to its state before the change.

:::caution
Reverting a change creates a new audit log entry. The revert itself is tracked, so you can always see that a revert occurred and undo it if necessary.
:::

:::info
Not all changes can be reverted. Deletions that cascade to related resources, or changes to system-level settings, may not support revert.
:::

## Retention

Audit log entries are automatically cleaned up by a daily background worker. Both audit log entries and change history records older than the configured retention period are deleted.

| Setting | Default | Scope |
|---------|---------|-------|
| `audit_log_retention_days` (site setting) | 365 days | Per site — overrides the system default |
| `APP__AUDIT__RETENTION_DAYS` (env var) | 365 days | System-wide default for all sites |

The cleanup runs once every 24 hours and logs how many entries were removed. System-level entries (not associated with any site) use the system-wide default.

:::tip
To change the retention period for a specific site, update the `audit_log_retention_days` key in the site's settings via the API:

```bash
PUT /api/v1/sites/{site_id}/settings
{
  "audit_log_retention_days": 90
}
```

The minimum retention is 1 day. Values below 1 are clamped to 1.
:::

## Permissions

| Action | Required Role |
|--------|--------------|
| View audit log | Admin, Owner |
| View change details | Admin, Owner |
| Revert changes | Admin, Owner |
