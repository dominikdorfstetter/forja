---
sidebar_position: 4
---

# Portfolio

The Portfolio section (formerly CV) is designed for portfolio sites. It lets you manage your professional experience, education, skills, and projects in a structured format. The admin page is organized into three tabs: **CV Entries**, **Skills**, and **Projects**.

:::info
The Portfolio module is reachable at `/portfolio`. The old `/cv` route redirects automatically to `/portfolio`.
:::

## CV Entries

CV entries represent individual items on your resume, such as a job position, a degree, a certification, or a project.

### Viewing CV Entries

Navigate to **Portfolio** in the sidebar. The **CV Entries** tab shows all entries for the currently selected site.

| Column | Description |
|--------|-------------|
| **Title** | The entry title (e.g., "Senior Developer at Acme Corp"). |
| **Type** | The category of the entry (e.g., Experience, Education, Certification). |
| **Date range** | Start and end dates for the entry. |
| **Order** | The display order. |

### Creating a CV Entry

Click the **New Entry** button to open the 4-step wizard:

1. **Company** -- company name, logo, location, and URL.
2. **Timeline** -- start date, end date, and "is current" flag.
3. **Content** -- position titles, descriptions, and achievements (per locale).
4. **Skills** -- link relevant skills to this entry.

### Editing a CV Entry

Click on an entry in the listing to open the detail view. Modify any field and click **Save**.

### Deleting a CV Entry

Click **Delete** on an entry and confirm. The entry is permanently removed.

## Skills

Skills represent your competencies (e.g., "Rust", "TypeScript", "PostgreSQL") and can be linked to both CV entries and projects.

### Skill Categories

Each skill is assigned to a category that groups it in your portfolio:

| Category | Examples |
|----------|----------|
| **Programming** | Rust, TypeScript, Python |
| **Framework** | React, Actix Web, Next.js |
| **Database** | PostgreSQL, Redis, MongoDB |
| **DevOps** | Docker, Kubernetes, CI/CD |
| **Language** | English, German, French |
| **SoftSkill** | Leadership, Communication |
| **Tool** | Git, Figma, VS Code |
| **Other** | Anything that doesn't fit the above |

### Proficiency Levels

Proficiency is expressed as a value from **0 to 100**:

| Range | Level |
|-------|-------|
| 0 -- 25 | Beginner |
| 25 -- 50 | Intermediate |
| 50 -- 75 | Advanced |
| 75 -- 100 | Expert |

Your frontend template can render these as progress bars, star ratings, or any other visual format.

### Skill Slugs

Each skill can have a **slug** -- a URL-friendly identifier (e.g., `react`, `type-script`). Slugs are useful if your template links to dedicated skill detail pages or filters content by skill.

### Managing Skills

1. Switch to the **Skills** tab in the Portfolio page.
2. Add a new skill by entering the skill name, selecting a category, and setting a proficiency level.
3. Reorder skills to control their display order.
4. Delete skills by clicking the remove icon.

## Projects

Projects are first-class portfolio items that showcase your work with rich media, links, and relationships to skills and CV entries.

### Project Features

- **Publishing workflow** -- Draft, InReview, Scheduled, Published, and Archived statuses with status transitions (publish, unpublish, archive, restore).
- **Featured flag** -- mark projects as featured for prominent display on your site.
- **Date range** -- start date, end date, and "is ongoing" flag.
- **Typed links** -- source code, live demo, documentation, website, or custom links with an inline editor.
- **Media gallery** -- attach images with display order and a cover image flag via the media picker.
- **Relations** -- link projects to skills and CV entries to build a connected portfolio graph.
- **Multi-locale** -- per-locale title, short description, and full description.

### Creating a Project

Click the **New Project** button to open the 3-step wizard:

1. **Basics** -- title (per locale), slug (auto-generated), dates, display order, featured flag, is ongoing.
2. **Content** -- short descriptions, full descriptions (per locale), and project links.
3. **Relations** -- media picker (with cover flag), skill autocomplete, and CV entry autocomplete.

### Project Actions

Each project has a context menu with status actions:

| Action | Description |
|--------|-------------|
| **Publish** | Move from Draft/InReview to Published. |
| **Unpublish** | Revert a published project to Draft. |
| **Archive** | Move to Archived status. |
| **Restore** | Move from Archived back to Draft. |
| **Delete** | Permanently remove the project. |

### Filtering and Search

The projects listing supports:

- **Search** -- filter by title text.
- **Status filter** -- show only projects in a specific status.
- **Featured filter** -- show only featured projects.
- **Pagination** -- paginated listing with configurable page size.
- **Bulk reorder** -- drag to rearrange display order.

## Localizations

CV entries and projects support multilingual content:

1. Open the entry or project detail view.
2. Switch to the desired locale using the locale selector.
3. Enter the translated title, description, and other locale-specific fields.
4. Save.

## Permissions

| Action | Required Role |
|--------|--------------|
| View portfolio content | Read |
| Create/edit CV entries and projects | Write, Admin, Master |
| Delete CV entries and projects | Write, Admin, Master |
| Publish/unpublish projects | Write, Admin, Master |
