# Phase 7 closed-beta handoff

## Included

- Versioned fixture release with 50 validated Chinese characters and a reviewed gold set.
- SQL migration, Docker PostgreSQL service, import report and release-diff pipeline.
- Deterministic hard constraints, transparent counts, preference ranking, diversity rerank, and single-rule relaxation diagnostics.
- Next.js UI plus `/solve`, `/analyze`, `/diagnose`, `/characters/:char`, `/meta/options`, and `/explanations` endpoints.
- In-memory rate limiting, one-minute result cache, structured query-hash audit events, API/error states, unit/property/e2e tests.

## Beta gate

Run `npm install && npm run build && npm test && npm run pipeline:fixture`. The fixture import must report 50 valid rows, no duplicates, and no invalid rows. Before public beta, replace the fixture with reviewed source releases and run the gold set against the deployed PostgreSQL-backed repository.

## Operational limits

This build intentionally labels the bundled dataset as non-authoritative. Legal registration, formal stroke systems, source licensing, human review, production rate limiting, monitoring, backups, and recruiting closed-beta testers require external operational decisions and verified sources.

`npm run web:build` completes successfully with Next.js 16.3.0 on the local exFAT workspace. Continue to run this production build in CI before every deployment.
