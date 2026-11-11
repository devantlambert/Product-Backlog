# Roadmap by Dev

A single place to manage the product backlog and share the state of every project across the organization.

## What it does

- **Backlog:** two ranked sections, Committed (being built or planned for the near term) and Everything else. Budget and estimate are in developer weeks, and budget health compares actual spend to budget.
- **Stages:** Intake → Discovery → Ready for Dev → In Development → UAT → Released → Post-release Review.
- **Dependencies:** finish to start, start to start, finish to finish, start to finish, or a stage gate (for example, B can't start until A reaches UAT).
- **Backlog filters:** by section, stage, forecast start, forecast release and budget health.
- **Capacity forecast:** a weekly simulation hands roadmap capacity to in-flight work first, then to the backlog in rank order. It respects dependencies and each project's maximum team size, and produces forecast start and release dates.
- **Project pages:** owner, budget against estimated cost, dependencies, and deliverables by team (Problem Statement, System Documentation, UAT Workbook, Marketing Hand-off, Post-release Analysis).
- **Roles:** Product and the Head of Development edit. C-Suite, Marketing, Support and Customer Success get read-only views tailored to them.
- **Stage alerts:** each team subscribes to the stages it cares about.

## Status

`prototype/index.html` is a self-contained clickable prototype with fictional sample data. Edits are stored in the browser's localStorage. Open the file in a browser to try it.

Next step: a Next.js + Supabase app (auth, roles, shared database, email/Slack alerts) deployed on Vercel.

Styled with the Dev brand standard (tokens v1.0.0): paper neutrals, slate blue Roadmap accent, IBM Plex Sans, 8 px corners, dates as 10-Nov-2026.

All sample data is fictional.
