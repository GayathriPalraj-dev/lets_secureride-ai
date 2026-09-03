# lets_secureride-ai

A new production-style MERN car-booking application, currently at Step 2: the application foundation.

## Scope and status

The foundation provides a React/TypeScript client, Express/TypeScript API, type-only shared contracts, basic security middleware, and initial tests. MongoDB, authentication, RBAC, cars, bookings, payments, uploads, and deployment are not implemented. The health endpoint reports process health only, not database or dependency readiness.

## Architecture

- `apps/client`: React Router and Vite; browser requests use `/api/v1/health`.
- `apps/server`: separately testable Express app and HTTP startup.
- `packages/contracts`: health/API types imported with `import type`; no runtime JavaScript dependency.
- Infrastructure and integration directories are placeholders only.

See [foundation architecture](docs/architecture/foundation.md).

## Prerequisites and installation

Use Node.js 22.23.1 (recorded in .nvmrc) and npm 10 or newer. From PowerShell:

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

Only example files are supplied. The root example is a documentation pointer. Server defaults work without an environment file; client defaults to /api/v1.

Read `apps/server/.env.example` for configuration names. Set current values in your PowerShell session, for example:

```powershell
$env:PORT = '5000'
$env:CLIENT_ORIGIN = 'http://localhost:5173'
npm run dev:server
```

No automatic server .env loader is installed. If you choose to create a private local .env later, Node 22 can load it explicitly when starting the built API with `node --env-file=.env dist/server.js` from apps/server. No real .env is created by this foundation.

Vite can read a local client environment file if you create one later; only public values such as VITE_API_BASE_URL belong there. Never put credentials in VITE_* variables. Future server placeholders are unused and do not prevent startup.

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

Suggested Step 3: separately plan MongoDB Atlas configuration, safe server-side secret handling, connection lifecycle, and readiness tests. Approval is required before implementation.
