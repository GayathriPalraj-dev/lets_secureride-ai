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

## Step 4 authentication evidence

Historical implementation-only record: the statements in this section describe the initial offline implementation boundary. Later separately approved operations and their results are recorded in the following sections; they do not retroactively change the original approval scope.

Implementation uses the approved files and three pinned server dependencies. The native Argon2 probe passed without system tools or install-policy changes. Existing dependency versions were compared against the Step 3 lockfile and remain unchanged. npm initially reported zero vulnerabilities plus install-script warnings for Argon2 and the existing esbuild package; native hashing and subsequent gates are verified separately.

The first full test pass exposed a recursion bug in a test spy used to simulate concurrent account invalidation; the fixture was corrected without changing the intended assertion. Initial type/lint findings were resolved within approved files. Database errors remain sanitized rather than retaining potentially sensitive driver causes.

Automated tests do not read a private environment file, connect to Atlas, create real accounts, or provision indexes. Real MongoDB atomicity/uniqueness/TTL and deployed browser behavior remain explicit acceptance gates. Step 5, private setup, services, commits, and pushes have not begun.

Final validation on 2026-09-03, Node 24.20.0 / npm 11.19.0:

| Gate                                | Result                                          |
| ----------------------------------- | ----------------------------------------------- |
| Formatting verification             | Passed, including final documentation           |
| Lint                                | Passed                                          |
| Typecheck                           | All three workspaces passed                     |
| Tests                               | 258 passed: 213 server and 45 client            |
| Existing regression tests           | All original 49 preserved                       |
| Added tests                         | 209                                             |
| Build                               | Contracts, server, and client passed            |
| Combined check                      | Passed, exit code 0                             |
| Production audit                    | Zero vulnerabilities                            |
| Full audit                          | Zero vulnerabilities                            |
| Diff whitespace check               | Passed                                          |
| File scope                          | Exactly 42 new and 18 modified approved files   |
| Existing locked dependency versions | Unchanged                                       |
| Secret-pattern scan                 | No findings in tracked and approved new content |

The final suite additionally checks normal-query exclusion of sensitive material, Web Locks usage, logout-only broadcasts and cleanup, delayed-user-response cancellation, and access refresh before logout-all. Initial failures were corrected without editing the original 49 tests or weakening their assertions.

Warnings: npm reported existing esbuild and new Argon2 install-script approval warnings; no policy setting changed and Argon2 loaded and hashed successfully. Git reports its existing LF-to-CRLF conversion warnings; Git configuration is unchanged. Real database/browser verification is not represented by the isolated test count.

Private configuration remains untouched and ignored. No Atlas provisioning, account creation, service startup, commit, push, or Step 5 work occurred. The working tree intentionally contains the reviewed implementation changes awaiting a separately approved checkpoint.

## Subsequent Step 4 setup and real API acceptance

Separate explicit approvals covered private authentication settings generation and validation, followed by authentication index provisioning and independent verification. Values were not displayed or recorded. Provisioning created the approved collections/indexes without test users or sessions or destructive synchronization. Automatic _id_ indexes and the named unique, compound, and TTL definitions passed verification.

Real Atlas authentication API acceptance passed 73 assertions with 0 failures. One temporary backend and isolated disposable data were used. Checks covered health/readiness, canonical-email uniqueness under concurrent registration, customer-only registration, Argon2id verification, safe login failures and DTOs, cookie attributes, authenticated identity, refresh rotation/replay, logout/logout-all, CSRF/CORS/content type, and HMAC-derived limiter storage. This was separate from the offline suite. The optional TTL deletion probe was not attempted.

API acceptance created and removed 2 disposable users, 4 sessions, and 13 limiter records using captured ownership. At that cleanup verification, all three collections returned to their empty pre-run state. This historical observation does not describe the database after later browser testing. Connections closed, the backend stopped gracefully, port 5000 closed, and the temporary harness was removed.

## Recorded manual-browser observations

The user explicitly supplied the following observations from the separately approved manual exercise. These are recorded manual observations, not automated browser capture, HAR evidence, or secret screenshots:

- Unauthenticated /account redirected to Sign in.
- Short-password validation prevented registration.
- Disposable customer registration succeeded.
- The account displayed the expected email and Role: customer.
- Reload restored the session.
- Another tab in the same private window restored the session.
- Sign-out removed access from both same-browser tabs.
- Duplicate registration produced a safe failure.
- An incorrect password produced a generic safe error.
- The correct password signed in successfully.
- Two genuinely separate browsers signed in.
- Sign out all devices invalidated both browser sessions after the second browser's next request.
- Both services were stopped and ports 5000/5173 were confirmed closed.

No additional browser behavior or production deployment acceptance is inferred from these observations.

## Exact-record manual-browser cleanup

One verified transaction removed 1 disposable customer, 4 owned authentication sessions, and 2 conclusively attributable limiter records. Exact target ownership and deletion counts were checked before commit. Independent verification through a separate connection confirmed the user and owned sessions were absent, deleted limiter IDs were absent, and unrelated record identities/counts and authentication indexes were unchanged. The existing index check passed.

One unattributed limiter record was retained for natural TTL expiration. Its current TTL status remains unverified. No claim is made that all authentication collections are currently empty. Database connections closed, the temporary harness was removed, no services started during cleanup, and ports 5000/5173 remained closed. No project or private configuration files changed during cleanup.

## Final offline checkpoint assessment before documentation correction

On 2026-09-03, Node 24.20.0 / npm 11.19.0, the direct test retry passed 258 tests: 45 client and 213 server, with 0 failed and 0 skipped. All original 49 regression tests remained present, unchanged, and passing. The repeated combined-check tests were not added to this total.

Formatting, lint, typecheck, build, combined check, and git diff --check passed with exit code 0. Both production and full audits reported zero vulnerabilities. The initial direct test command exited 1 because frontend workers timed out before running tests; its unchanged retry with process permission exited 0. The initial production audit exited 1 because registry access failed; its unchanged network-permission retry exited 0. Existing LF-to-CRLF warnings did not indicate whitespace errors. No test, timeout, dependency, or network configuration was changed.

The actual recovered planning report matched exactly 42 new and 18 modified files. Only argon2 0.45.1, jose 6.2.10, and cookie 2.0.1 were added as direct dependencies; existing versions were unchanged. Secret-pattern scans of the 60 checkpoint files found no concerns. Git metadata confirmed private environment files were ignored and untracked. All 112 checked project files stayed unchanged during that read-only assessment. Tests never loaded private configuration or connected to Atlas; no services started.

That assessment returned NOT READY because seven documentation files still described the original implementation boundary as current status. The separately approved documentation correction preserves those historical records and adds the later evidence above. Step 4 remains uncommitted; Step 5 and production acceptance remain pending.

## Documentation correction and offline revalidation

The seven approved Markdown files were corrected on 2026-09-03. Formatting verification, lint, typecheck, direct tests, build, combined check, production audit, full audit, and diff whitespace verification all passed with exit code 0. The direct test run reported 258 passed, 0 failed, 0 skipped: 45 client and 213 server, including the unchanged original 49 regression tests. Combined-check repetitions are excluded from the total. Both audits reported zero vulnerabilities. Process/network permissions were used for previously established sandbox limitations; this correction run required no failed-command retry. Git emitted its existing LF-to-CRLF warnings. No automatic formatter or fixer was run.

The approved checkpoint remains 42 new and 18 modified files. Fingerprints confirmed that only the seven authorized documentation files changed during correction. Dependency manifests and lockfile stayed unchanged; the server resolves argon2 0.45.1, jose 6.2.10, and cookie 2.0.1. The 60-file secret-pattern scan found no concerns, and private files remain ignored and untracked. Offline tests remained isolated from Atlas and private configuration. No live database, TTL, service-start, staging, commit, push, or Step 5 operation formed part of this correction. Final report verification covers the completed evidence text and service ports.
