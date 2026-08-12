# NameSolver

NameSolver is a deterministic Taiwanese name-constraint solver. This Phase 0–7 prototype includes the constraint contract, versioned fixtures and import pipeline, PostgreSQL migration, solver/ranking/diagnostics, a Next.js UI, APIs, cache/rate-limit guards, and beta-gate tests.

## Run

```sh
npm install
npm test
npm run build
npm run dev
```

## Current contract

`totalStrokes` is the sum of the given-name characters, using the stroke system declared for each position. Every returned result has passed every hard rule; preference ranking never changes that eligibility.

## Documentation

- [Current user manual](./docs/user-manual.md)
- [Implementation plan compliance review](./docs/implementation-review.md)
- [Implementation plan](./docs/implementation-plan.md)
- [Closed-beta handoff](./docs/closed-beta.md)
