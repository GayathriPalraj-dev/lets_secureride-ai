# Step 2 validation evidence

Validated on 2026-09-03 using Windows PowerShell, Node.js 22.23.1, and npm 10.9.8.

| Gate                 | Result                                                          |
| -------------------- | --------------------------------------------------------------- |
| npm install          | Passed; 377 packages added, 381 audited, zero vulnerabilities   |
| npm run format:check | Passed after formatting new foundation files                    |
| npm run lint         | Passed with no reported warnings or errors                      |
| npm run typecheck    | Passed for client, server, and contracts                        |
| npm test             | Passed: 6 client tests and 11 server tests, 17 total            |
| npm run build        | Passed: client assets, server JavaScript, contract declarations |
| npm run check        | Passed all gates, including all 17 tests and all builds         |
| npm audit --omit=dev | Passed; zero vulnerabilities reported                           |

## Resolved issues and limits

- Registry/install/audit requests were blocked by the sandbox and succeeded with network permission. Installation and audit used the project-local node_modules/.cache/npm cache.
- The first frontend test run timed out while starting a worker, before any tests ran. A retry with process permission passed. The subsequent combined check also passed in the default environment; no assertions or timeouts were weakened.
- TypeScript 6.0.3 was selected because the lint tooling does not support TypeScript 7. The user separately approved the required @testing-library/dom dependency.
- Formatting required two passes for one test file; the final combined formatting gate passed.
- package-lock.json records direct and transitive resolved versions. No automatic audit fixes were used.
- No persistent development servers were launched. No browser visual QA, graceful-shutdown signal smoke test, E2E tests, or deployment was performed in this approved plan.
- The API health endpoint checks process liveness only. The in-memory limiter is per process; production proxy and scaling policy remain future work.

At completion of Step 2, no unresolved validation failures remained. The user later reported successful manual client/server startup and liveness verification, followed by stopping those services.

## Step 3 validation evidence

Validated on 2026-09-03. Only Mongoose 9.9.4 was added as a direct runtime dependency, scoped to the server. TypeScript 6.0.3 typechecking and builds passed with it. The database driver is a transitive dependency only.

| Gate             | Final result                                         |
| ---------------- | ---------------------------------------------------- |
| Installation     | Passed; 16 packages added, 397 audited               |
| Formatting       | Passed; corrections limited to approved Step 3 files |
| Lint             | Passed in final combined check                       |
| Typecheck        | All three workspaces passed                          |
| Tests            | 49 passed: 6 client and 43 server                    |
| Build            | All three workspaces passed                          |
| npm run check    | Passed, exit code 0                                  |
| Production audit | Zero vulnerabilities reported                        |

The original 17 tests remain passing. The 32 new tests comprise 6 configuration tests, 10 database-manager tests, 8 startup/shutdown tests, and 8 readiness tests. Test fixtures are isolated, event subscriptions are removed, and timers are restored. No database connection or local credential file is required by tests.

The initial test run exposed a TLS-option normalization issue; validation now checks the driver's normalized Node TLS settings. Two lint findings were corrected without disabling rules. The initial frontend worker again timed out before running tests; a permission retry and the subsequent default-environment combined check both passed without increased timeouts or client changes.

No real database connection, schema, collection, seed data, AWS resource, commit, or push was performed. No persistent services were started. Real Atlas network access and credentials remain for manual verification by the user. Readiness reflects observed driver state, not a new database query on each request.

Git status lists only the 7 new and 15 modified approved Step 3 files. Git emitted existing LF-to-CRLF conversion warnings during read-only diff inspection; Git configuration was not changed. There are no unresolved validation failures. Step 4 has not started.

## Node 24 runtime migration

On 2026-09-03, the approved Windows x64 Node.js 24.20.0 migration passed its portable-runtime DNS prerequisite before system installation. Both official artifacts matched the downloaded official SHA-256 manifest and the published release checksums:

- ZIP SHA-256: `6cac9ffbca8f6a47091e4b5c772e0606049c3871cb67d900c0cedde630e545ba`.
- MSI SHA-256: `28b69132c35ccc033bf8f2a67cd10c9d75ef5822593363309da448f2afff2d8a`.
- MSI Authenticode signature: valid, OpenJS Foundation.
- Portable default DNS discovery: passed; configured router discovered instead of loopback.
- Portable SRV resolution: passed, three records. TXT resolution: passed, one record. No DNS override or credentials were used.
- Official MSI installation: exit code 0. Installed Node v24.20.0, npm 11.19.0, c-ares 1.34.8. Node and npm resolve from `C:\Program Files\nodejs`.

The verified rollback MSI and original copies of all six approved files are staged outside the project. The lockfile change is limited to root engine metadata; dependency versions are preserved. Earlier Step 2 and Step 3 evidence above describes those historical runs.

Migration validation: `npm ci` succeeded (393 packages added, 397 audited). Formatting, lint, all-workspace typechecking, all 49 tests, and all three builds passed. Production `npm audit --omit=dev` reported zero vulnerabilities. The initial sandbox frontend worker timed out before running tests; retrying with process permission passed without test or timeout changes. npm warned that the existing esbuild postinstall was not covered by allowScripts; no policy or dependency change was made, and the test/build gates passed. The offered npm 12 upgrade was not applied.

The explicitly approved real Atlas smoke test used one temporary compiled server under the installed Node 24 runtime, without any DNS override. Liveness and readiness both returned HTTP 200 with request IDs; readiness reported connected. The server shut down with exit code 0, its process was confirmed absent, and port 5000 was confirmed closed. Only sanitized booleans and status codes were captured; the native runtime privately loaded existing local configuration without the agent inspecting its contents. No application writes or Atlas configuration changes were made.

Only the six approved project files were changed by this migration. Pre-existing Step 3 changes were preserved; nothing was committed or pushed. No controlled rollback was required. Installers, backups, and npm cache remain in the approved temporary staging directory for rollback until acceptance. Step 4 remains unstarted.

Final combined gate: `npm run check` passed with exit code 0, including formatting, lint, all-workspace typechecking, all 49 tests, and all three builds. A final formatting check after recording this result also passed.
