# Role-based access control

## Trust boundary

The application supports only `customer` and `admin`. Public registration always creates a customer. MongoDB's current user record remains authoritative: JWT access tokens contain identity, session, and `authVersion`, but no role claim. Authentication loads the current session and user before authorization runs.

`requireRole('admin')` fails closed. Missing authentication returns the existing safe 401 response. A current customer or malformed role receives a generic 403 response that does not enumerate allowed roles. Authorization events include only fixed event data, validated role enums, correlation IDs, and timestamps.

## Durable admin boundary

`GET /api/v1/admin/access` applies no-store, `authenticate()`, `requireRole('admin')`, and its minimal handler in that order. A successful response contains only `authorized: true` in the standard request-ID envelope. The handler performs no database query because authentication already loaded authoritative state.

The React `/admin` route blocks known customers before rendering the page. A restored admin DTO reaches the page, which calls the server endpoint through the existing memory-only token session. The shell remains hidden until HTTP 200. A final 401 clears local authentication, 403 leads to the accessible forbidden page, and transient failures offer a safe retry.

## Offline role management

The command accepts exactly one mode, one role, and one process-local target:

```text
npm run auth:role --workspace @lets-secureride-ai/server -- --check --role admin
npm run auth:role --workspace @lets-secureride-ai/server -- --apply --role admin
npm run auth:role --workspace @lets-secureride-ai/server -- --apply --role customer
```

Exactly one of `AUTH_ROLE_TARGET_USER_ID` or `AUTH_ROLE_TARGET_EMAIL` must be supplied privately to the process. Neither variable belongs in `.env`, examples, or tracked configuration, and documentation never includes a real value.

Check mode performs no write. Apply mode filters by exact user, current role, active status, and current `authVersion`; it changes the role and increments the version atomically. It then revokes sessions with an older version. Already-at-target execution is idempotent. If cleanup fails after the update, old sessions remain unusable because their version is stale, and the command reports sanitized partial completion.

Running the command against Atlas and performing real API or browser acceptance require separate approval.

## Validation and acceptance status

The Step 5 offline implementation is complete within exactly 19 new and 24 modified files. Seven isolated Step 5 test files add 75 RBAC cases to the preserved 258-test baseline, for 333 passing tests with none failed or skipped. Step 5 adds no dependency and leaves `package-lock.json` unchanged. It introduces no schema, collection, index, migration, or JWT role claim.

A separately approved real API run completed 48 assertions before stopping. Anonymous access to the admin boundary returned 401 and authenticated customer access returned 403. The run stopped before completing the first role transition, so promotion, administrator access, stale-session invalidation, idempotent administrator apply, demotion, and final customer restoration remain pending.

One disposable customer, identified in evidence as `rbac-accept-[redacted]@example.invalid`, and two conclusively attributed sessions remain for separately approved cleanup. The user was last verified as a customer with unchanged `authVersion`, and no promotion or demotion was verified. Zero rate-limit records were conclusively attributed. The cleanup manifest containing exact identifiers remains outside the repository.

Later diagnostics passed module loading, configuration validation, and target validation, then failed during Atlas server selection before exact target lookup. No deterministic Step 5 source defect was established. Changing mobile-hotspot routing and Atlas access-list conditions remain the likely environmental limitation; this result proves neither database authentication nor database authorization failure.
