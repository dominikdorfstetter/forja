# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in OpenYapper, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please report vulnerabilities via [GitHub Security Advisories](https://github.com/dominikdorfstetter/openyapper/security/advisories/new).

Alternatively, you can email security concerns to the repository maintainer directly (see profile contact information).

### What to Include

When reporting a vulnerability, please provide:

- A description of the vulnerability
- Steps to reproduce the issue
- Affected component(s) (backend API, admin panel, frontend)
- Potential impact assessment
- Suggested fix (if any)

### Response Timeline

- **Acknowledgment**: Within 48 hours of your report
- **Assessment**: Initial severity assessment within 5 business days
- **Resolution**: Critical vulnerabilities will be prioritized for immediate patching; lower-severity issues will be addressed in the next scheduled release

### What to Expect

- You will receive confirmation that your report was received
- We will investigate and validate the vulnerability
- If accepted, we will work on a fix and coordinate disclosure with you
- If declined, we will explain why the report does not qualify as a vulnerability
- We will credit reporters in the release notes (unless anonymity is preferred)

## Scope

The following components are in scope:

- **Backend API** (Rust/Rocket) - authentication, authorization, data handling, SQL injection, API abuse
- **Admin Panel** (React/Vite) - XSS, CSRF, authentication bypass, session management
- **Frontend** (Next.js) - XSS, SSRF, information disclosure
- **Infrastructure** - Docker configurations, CI/CD pipelines, dependency vulnerabilities

### Out of Scope

- Issues in third-party dependencies (report these upstream, but let us know so we can update)
- Denial-of-service attacks that require excessive resources
- Social engineering attacks
- Issues requiring physical access to a user's device

## Security Best Practices for Deployers

- Always use HTTPS in production
- Rotate API keys regularly
- Keep the `CLERK_SECRET_KEY` and database credentials secure and never commit them to version control
- Run the backend behind a reverse proxy (e.g., nginx, Caddy)
- Keep all dependencies up to date
- Review the Docker configuration before deploying to production
