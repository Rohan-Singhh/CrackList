# Security Policy

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

If you discover a security vulnerability in CrackList, please report it
responsibly through one of these channels:

1. **GitHub Security Advisories** (preferred):
   Go to [Security → Advisories → New draft advisory](https://github.com/Rohan-Singhh/CrackList/security/advisories/new)
   and submit a private report.

2. **Email**:
   Send details to **rohanranjan840@gmail.com** with the subject line
   `[SECURITY] CrackList vulnerability report`.

## What to Include

- Description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- Potential impact
- Any suggested fix (optional but appreciated)

## What to Expect

- **Acknowledgement** within 48 hours of your report.
- We will work with you to understand and validate the issue.
- A fix will be developed and tested before any public disclosure.
- You will be credited in the release notes (unless you prefer anonymity).

## Scope

The following are in scope:

- The CrackList backend API (`backend/`)
- The CrackList frontend application (`frontend/`)
- GitHub Actions workflows (`.github/`)
- Docker configuration

The following are **out of scope**:

- Third-party services (Supabase, Vercel, Render) — report those to the
  respective vendors
- Social engineering attacks against maintainers
- Denial-of-service attacks against the hosted instance

## Supported Versions

We only address vulnerabilities in the latest version on the `main` branch.

## Guidelines

- Give us reasonable time to fix the issue before disclosing publicly.
- Do not access or modify other users' data.
- Do not degrade the service for others while testing.
- Act in good faith.

Thank you for helping keep CrackList and its users safe!
