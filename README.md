# lets_secureride-ai

A production-style MERN car-booking application in development. Steps 1–3 are complete and committed. Step 4 secure authentication is implemented and validated but not yet committed; the complete application and production deployment remain future work.

## Scope and status

The foundation provides a React/TypeScript client, Express/TypeScript API, type-only shared contracts, basic security middleware, and a tested Mongoose connection lifecycle. Authentication models, session services, and minimal account pages are implemented. No real authentication collections or data were created during implementation. RBAC, cars, bookings, payments, uploads, and deployment remain deferred. Liveness reports process health; the separate readiness endpoint reports database availability.

After implementation, separate approvals covered private authentication configuration, authentication index provisioning and independent verification, real Atlas API acceptance, recorded manual-browser acceptance, and exact-record cleanup. Offline validation passed 258 tests (45 client, 213 server), with 0 failed and 0 skipped; all original 49 regression tests passed. Real API acceptance passed 73 assertions with 0 failures. These are separate evidence sets, detailed in [validation evidence](docs/evidence/README.md).

Manual-browser cleanup removed 1 disposable customer, 4 owned sessions, and 2 conclusively attributable limiter records in one transaction. One unattributed limiter record was retained for automatic TTL expiration; its current status is unverified. This is not a claim that all Atlas authentication collections are currently empty. Step 5 has not started.

## Architecture

- `apps/client`: React Router and Vite; browser requests use `/api/v1/health`.
- `apps/server`: separately testable Express app and HTTP startup.
- `packages/contracts`: health/API types imported with `import type`; no runtime JavaScript dependency.
- Infrastructure and integration directories are placeholders only.

See [foundation architecture](docs/architecture/foundation.md) and the [manual Atlas setup guide](docs/architecture/mongodb-atlas.md). The server now requires valid database configuration and a successful connection before HTTP startup.

## Prerequisites and installation

Use Node.js 24.20.0 LTS (recorded in .nvmrc) with bundled npm 11.19.0. The supported engine ranges are Node >=24.20.0 <25 and npm >=11.19.0 <12. From PowerShell:

```powershell
Set-Location 'C:\Users\Gayathri\OneDrive\Desktop\lets_secure_rideAI_v2\lets_secureride-ai'
npm install
```

After the lockfile exists, use `npm ci` for reproducible clean installations.

## Development

Run these in separate PowerShell terminals in the project root:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Client: http://localhost:5173. API: http://localhost:5000/api/v1/health.
Vite proxies /api to port 5000. Use Ctrl+C to stop each process.

## Environment

Only example files are supplied. The root example is a documentation pointer. The client defaults to /api/v1. HTTP configuration keeps its defaults, but server startup additionally requires valid server-only database configuration.

Read `apps/server/.env.example` for configuration names. Set current values in your PowerShell session, for example:

```powershell
$env:PORT = '5000'
$env:CLIENT_ORIGIN = 'http://localhost:5173'
npm run dev:server
```

The development script uses Node 24's native `--env-file-if-exists` loader for the server workspace's local file. Private authentication settings were generated and validated under separate approval without displaying values. Private files remain ignored and untracked; offline validation does not read or load them. No dotenv dependency is installed. Existing process environment values take precedence. `npm run start:local --workspace @lets-secureride-ai/server` loads the same optional file for a compiled local run; the production `start` command uses runtime-injected variables only.

Vite can read a local client environment file if you create one later; only public values such as VITE_API_BASE_URL belong there. Never put credentials in VITE_* variables. Authentication configuration is now required; Stripe and AWS placeholders remain unused. The fake database placeholder must be replaced privately before manually starting the server.

**Never commit real secrets.** Environment files, logs, dependencies, build output, and coverage are ignored.

## Quality commands

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run check
npm audit --omit=dev
```

`check` repeats formatting, lint, typecheck, tests, and build sequentially, failing on the first failed gate. Frontend tests mock fetch; backend tests use Supertest. Builds produce client assets, server JavaScript, and contract declarations in each workspace's dist directory. The production server starts with `npm start --workspace @lets-secureride-ai/server` after building.

## Approval and next milestone

Follow AGENTS.md: read-only planning, explicit approval, one step at a time. No commits or deployments are performed automatically.

Step 4 implementation and the separately approved local acceptance operations are complete. Further private configuration, Atlas operations, service startup, and Git checkpoint actions require separate approval. Step 5 RBAC has not started.

## Liveness and readiness

`GET /api/v1/health` preserves the original liveness response. `GET /api/v1/health/ready` returns HTTP 200 when connected and not shutting down, or a safe HTTP 503 error envelope otherwise. Readiness responses are not cached. The existing client continues to display liveness only.

Database and lifecycle tests use isolated fakes, never a real database or a downloaded database binary. See [validation evidence](docs/evidence/README.md) for results and limits.

## Step 4 authentication

Secure authentication is implemented with isolated tests. See [authentication architecture](docs/architecture/authentication.md) for endpoints, private configuration names, session rotation, CSRF controls, limits, and release gates. Minimal pages are /register, /login, and /account. Registration does not automatically sign in.

Startup requires authentication secrets and explicitly provisioned authentication indexes. Private setup and provisioning succeeded under later approvals; missing or invalid configuration and indexes still fail safely. Existing health contracts remain unchanged once startup succeeds. Do not start services or provision indexes as part of automated validation. Production cookie/CORS/CSP, runtime capacity, and deployment acceptance remain pending.
