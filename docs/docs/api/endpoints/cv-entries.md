---
sidebar_position: 5
---

# CV Entries and Skills

CV entries and skills power the portfolio/resume section of a site. Skills represent technical competencies, while CV entries represent work experience, education, certifications, and projects.

## Endpoints

### Skills

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/skills?page&per_page` | Read | List skills for a site (paginated) |
| GET | `/skills/{id}` | Read | Get skill by ID |
| GET | `/skills/by-slug/{slug}` | Read | Get skill by slug |
| POST | `/skills` | Author | Create a skill |
| PUT | `/skills/{id}` | Author | Update a skill |
| DELETE | `/skills/{id}` | Author | Soft delete a skill |

### CV Entries

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/cv?entry_type&page&per_page` | Read | List CV entries (paginated, filterable by type) |
| GET | `/cv/{id}` | Read | Get CV entry by ID |
| POST | `/cv` | Author | Create a CV entry |
| PUT | `/cv/{id}` | Author | Update a CV entry |
| DELETE | `/cv/{id}` | Author | Soft delete a CV entry |

## List Skills

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/skills?page=1&per_page=25"
```

## List CV Entries

Filter by entry type using the `entry_type` query parameter. Valid types: `work`, `education`, `volunteer`, `certification`, `project`.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/cv?entry_type=work&page=1&per_page=25"
```

## Create a Skill

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "site_ids": ["550e8400-..."],
    "name": "Rust",
    "slug": "rust",
    "category": "Programming Languages",
    "proficiency": 90
  }' \
  https://your-domain.com/api/v1/skills
```

**Response** `201 Created`

## Create a CV Entry

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "site_ids": ["550e8400-..."],
    "entry_type": "work",
    "title": "Senior Engineer",
    "organization": "Acme Corp",
    "start_date": "2022-01-01",
    "is_current": true
  }' \
  https://your-domain.com/api/v1/cv
```

**Response** `201 Created`
