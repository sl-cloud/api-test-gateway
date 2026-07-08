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

## Quick start (Docker)

Everything runs in Docker: the API, Postgres, and all development tooling
(lint, typecheck, tests). No local Node.js install or `npm install` on the
host is required.

```bash
cp .env.example .env      # fill in JWT_SECRET (openssl rand -base64 32)
make up                   # docker compose up -d --wait (builds api + db, waits for healthchecks)
curl http://localhost:3000/health/ready
```

Equivalent plain Docker Compose commands, if you'd rather not use `make`:

```bash
docker compose up -d --wait   # build and start api + db, wait for healthchecks
docker compose logs -f        # tail logs
docker compose down           # stop and remove containers
docker compose down -v        # also wipe the Postgres volume
```

Try the API once it's up:

```bash
curl -sf -X POST http://localhost:3000/api/v1/auth/register \
  -H 'content-type: application/json' \
  -d '{"email":"you@example.com","password":"a_valid_password","displayName":"You"}'
```

All development commands run inside the running `api` container via
`docker compose exec`, so `make up` must be running first:

```bash
make test              # full suite (unit + integration, real Postgres)
make test-unit
make test-integration
make lint
make format
make typecheck
make migrate            # re-apply migrations explicitly (also runs automatically on container start)
make logs
make down
make reset               # wipe the Postgres volume and start fresh
```

If Docker runs on a different machine than your browser/terminal, set
`API_HOST_PORT` in `.env` and substitute that machine's hostname or IP for
`localhost` above. Nothing in this codebase assumes `localhost`.

## Scripts

The `Makefile` targets above are the supported way to run these; each wraps
the equivalent `npm run <script>` executed inside the `api` container via
`docker compose exec`. The underlying `package.json` scripts:

| Command                                           | Does                                                                |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `npm run dev`                                     | Watch mode (`tsx watch`), used by the container's own start command |
| `npm run build`                                   | Compile to `dist/`                                                  |
| `npm run lint` / `lint:fix`                       | ESLint                                                              |
| `npm run format` / `format:check`                 | Prettier                                                            |
| `npm run typecheck`                               | `tsc --noEmit`                                                      |
| `npm run test` / `test:unit` / `test:integration` | Vitest                                                              |
| `npm run migrate`                                 | Apply Drizzle migrations                                            |

## Deploying to staging

CI builds and pushes an image to GHCR on every push to `main`, then a
second workflow deploys it to a VPS over SSH, verifies `/health/ready`
from outside the container, and attempts a signed notification to the
companion platform (never blocking the deploy if that fails). Rolling
back is redeploying an earlier immutable image tag. See
[`docs/deploy-staging.md`](./docs/deploy-staging.md) for host setup and
the required GitHub Actions configuration.
