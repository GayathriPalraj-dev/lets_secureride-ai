# lets_secureride-ai

A new production-style MERN car-booking application, currently at Step 3: the MongoDB connection foundation.

## Scope and status

The foundation provides a React/TypeScript client, Express/TypeScript API, type-only shared contracts, basic security middleware, and a tested Mongoose connection lifecycle. No database schemas, collections, seed data, authentication, RBAC, cars, bookings, payments, uploads, or deployment are implemented. Liveness reports process health; the separate readiness endpoint reports database availability.

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

The development script uses Node 24's native `--env-file-if-exists` loader for the server workspace's local file. Configure it privately following the Atlas guide; this foundation does not create or inspect it. No dotenv dependency is installed. Existing process environment values take precedence. `npm run start:local --workspace @lets-secureride-ai/server` loads the same optional file for a compiled local run; the production `start` command uses runtime-injected variables only.

Vite can read a local client environment file if you create one later; only public values such as VITE_API_BASE_URL belong there. Never put credentials in VITE_* variables. Future JWT, Stripe, and AWS placeholders remain unused. The fake database placeholder must be replaced privately before manually starting the server.

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

Suggested Step 4: separately plan authentication requirements, account and session contracts, credential protection, and authorization boundaries. No Step 4 implementation is included or authorized.

## Liveness and readiness

`GET /api/v1/health` preserves the original liveness response. `GET /api/v1/health/ready` returns HTTP 200 when connected and not shutting down, or a safe HTTP 503 error envelope otherwise. Readiness responses are not cached. The existing client continues to display liveness only.

Database and lifecycle tests use isolated fakes, never a real database or a downloaded database binary. See [validation evidence](docs/evidence/README.md) for results and limits.
