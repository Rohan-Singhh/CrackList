# Contributing to CrackList

Thanks for wanting to help! CrackList is a free, community-run database of real
interview questions — every contribution makes interview prep more accessible for
everyone.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branching & Commits](#branching--commits)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Code of Conduct](#code-of-conduct)

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/CrackList.git
   cd CrackList
   ```
3. **Add the upstream remote** so you can stay in sync:
   ```bash
   git remote add upstream https://github.com/Rohan-Singhh/CrackList.git
   ```

## Development Setup

### Prerequisites

- Node.js 18+ (20+ recommended — see `frontend/.nvmrc`)
- PostgreSQL 14+ (or Docker)

### Backend

```bash
cd backend
cp .env.example .env          # edit DATABASE_URL etc. as needed
npm install
npx prisma db push            # create tables
npx prisma db seed            # load sample data
npm run dev                   # → http://localhost:4000
```

**Quick Postgres via Docker** (if you don't have one running):

```bash
docker run -d --name cracklist-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=cracklist \
  -p 5432:5432 postgres:16
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # → http://localhost:5173
```

The frontend reads `VITE_API_URL` at build time (defaults to `http://localhost:4000`).

---

## Branching & Commits

### Branch Naming

Create a branch from `main` with a descriptive prefix:

| Prefix | Use for |
|--------|---------|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Tooling, CI, dependency bumps |
| `refactor/` | Code restructuring (no behavior change) |

Example: `feat/global-search`, `fix/upvote-race-condition`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add full-text search endpoint
fix: prevent duplicate submissions on double-click
docs: add API rate-limit section to README
chore: bump prisma to 6.3
```

Keep commits atomic — one logical change per commit.

---

## Pull Request Process

1. **Sync your fork** with upstream `main` before opening a PR:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```
2. **Push your branch** and open a PR against `main`.
3. **Fill out the PR template** — describe what changed, why, and how to test it.
4. **Make sure CI passes** — the GitHub Actions workflow runs typechecks and builds
   for both backend and frontend. If it's red, fix it before requesting review.
5. **One approval required** — a maintainer will review your PR. Be patient; we're
   a small team.
6. **Squash-merge** is the default merge strategy.

### PR Checklist

- [ ] My code compiles without errors (`npm run build` in both `backend/` and `frontend/`)
- [ ] I haven't committed any `.env` files or credentials
- [ ] I've added/updated comments where the intent isn't obvious
- [ ] If I changed the Prisma schema, I ran `npx prisma generate` and it succeeded
- [ ] If I changed API routes, I updated the API table in `README.md`

---

## Code Style

- **TypeScript** — strict mode, no implicit `any`. Both packages use `tsc` for typechecking.
- **No linter config wars** — the frontend uses [oxlint](https://oxc.rs/) (`npm run lint`).
  The backend doesn't have a linter yet; just keep the existing style consistent.
- **Prisma conventions** — model names are `PascalCase`, DB columns are `snake_case`
  (mapped via `@@map`/`@map`). Enum values are `snake_case`.
- **Imports** — use `.js` extensions in backend imports (required for Node ESM).

---

## Reporting Bugs

Use the [Bug Report](https://github.com/Rohan-Singhh/CrackList/issues/new?template=bug_report.md) issue template. Include:

- Steps to reproduce
- Expected vs. actual behavior
- Browser / Node version
- Screenshots if it's a UI issue

## Suggesting Features

Use the [Feature Request](https://github.com/Rohan-Singhh/CrackList/issues/new?template=feature_request.md) issue template. Please search existing issues first to avoid duplicates.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md).
By participating, you agree to uphold it. Report unacceptable behavior to the
maintainers via the channels listed in the Code of Conduct.

---

## Questions?

Open a [Discussion](https://github.com/Rohan-Singhh/CrackList/discussions) or
comment on a relevant issue. We're happy to help!
