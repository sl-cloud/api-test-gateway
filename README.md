# api-test-gateway

A small, professionally engineered TypeScript + Fastify REST API: a "TaskBoard"
project/task management service with real authentication, authorization,
ownership rules, and business logic.

This repository is one half of a two-repository portfolio project. On its
own it's a competent, testable, deployable API. Its broader purpose is to
act as a live subject for a companion platform that watches this repo,
analyses every change, generates and runs tests against it, and investigates
its runtime errors.

## Why this repo exists

The goal was a portfolio project that goes beyond "here's an API I built"
and instead demonstrates the full loop of modern, AI-assisted software
engineering practice: a real application, real CI/CD, and an autonomous
system that treats that application as its subject, analysing diffs,
reasoning about what changed, generating tests for it, running them, and
reporting on failures with real evidence.

That loop needs something to point at. `api-test-gateway` is that something.
It had to be:

- **Small enough** to stay a clean, readable demo, not a sprawling app that
  buries the point.
- **Rich enough in permission surface** that an automated analysis of a diff
  has something meaningful to reason about: role-based access, resource
  ownership, membership-scoped visibility, and state-machine business rules,
  not just CRUD.
- **A genuinely good implementation on its own terms**: thin route handlers,
  policy functions unit-tested in isolation, RFC 9457 error responses,
  structured logging, a full CI pipeline, and a real staging deployment.
  Being a demo subject doesn't mean it gets to be sloppy.

## What it does

TaskBoard is a projects-and-tasks API with a deliberately dense permission
model packed into three entities (`User`, `Project`, `Task`):

- **Authentication**: JWT access tokens, argon2id password hashing.
- **Authorization**: two layers, a system role (`admin` vs `member`) and
  per-project membership (owner vs member vs non-member), enforced through
  small, independently unit-tested policy functions rather than a framework.
- **Ownership rules**: only a project's owner (or an admin) can archive it,
  delete it, or manage its members; non-members get `404`, not `403`, to
  avoid leaking that a resource exists.
- **Business rules that are actually rules**: task status follows a state
  machine (`todo → in_progress → done`, with reopening but no skipping
  straight to `done`), archived projects become read-only (`409` on any
  mutation), and a task's assignee must actually belong to the project.

Every one of those rules is a deliberately testable, independently
observable behaviour: exactly the kind of thing an automated test can assert
against ("guest cannot create a task," "member cannot delete another
member's project," "assigning a non-member returns 422").

## How it's used in the demo

This is the flow the whole project is built to show, end to end:

```
Developer pushes a change to this repo
        │
        ▼
CI: lint, typecheck, unit tests, integration tests, build
        │
        ▼
Deploy to staging
        │
        ▼
Notify the companion platform of the deployment
        │
        ▼
The platform clones the repo at that commit, diffs it against the
previous deploy, and analyses what behaviour changed and what the
risk is
        │
        ▼
A structured test plan is proposed, for example spotting that a new
endpoint touches authorization and needs a "non-owner cannot delete"
test, with reasoning attached rather than just a list of test names
        │
        ▼
Real end-to-end test specs are generated for that plan, validated,
and run in a sandboxed runner against the live staging deployment
of this API
        │
        ▼
Results, including pass/fail, screenshots on failure, and analysis
of any failures, show up on a public, read-only dashboard
```

A second, parallel flow demonstrates the same platform reacting to
runtime problems: if this API throws an unhandled error in staging, it
reports a sanitised error event to the platform, which investigates using
git history and source context, then opens an internal ticket with its
evidence and inference clearly separated, visible on the same public
dashboard.

In short: this repo is the thing being watched. Every commit here is an
opportunity for the companion platform to prove it can understand real
code, reason about real risk, and generate real, runnable tests, which is
the actual portfolio piece.

## Status

Current status: Fastify skeleton, health endpoints (`/health/live`,
`/health/ready`), Zod-validated config, structured logging with request IDs,
Docker Compose (api + Postgres, healthchecked), and a full CI pipeline
(lint, format, typecheck, unit, integration, build).

The TaskBoard domain (users/projects/tasks, auth, and the business rules
described above) lands next, followed by staging deployment.

## Quick start

```bash
cp .env.example .env      # fill in JWT_SECRET (openssl rand -base64 32)
make up                   # docker compose up -d --wait
curl http://localhost:3000/health/ready
make test
make logs
make down
```

If Docker runs on a different machine than your browser/terminal, set
`API_HOST_PORT` in `.env` and substitute that machine's hostname or IP for
`localhost` above. Nothing in this codebase assumes `localhost`.

## Scripts

| Command                                           | Does                                                |
| ------------------------------------------------- | --------------------------------------------------- |
| `npm run dev`                                     | Watch mode (`tsx watch`)                            |
| `npm run build`                                   | Compile to `dist/`                                  |
| `npm run lint` / `lint:fix`                       | ESLint                                              |
| `npm run format` / `format:check`                 | Prettier                                            |
| `npm run typecheck`                               | `tsc --noEmit`                                      |
| `npm run test` / `test:unit` / `test:integration` | Vitest                                              |
| `npm run migrate`                                 | Apply Drizzle migrations (no-op until domain lands) |
