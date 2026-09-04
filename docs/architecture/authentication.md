# Step 4 secure authentication

Status: Step 4 is implemented, validated, and committed. Private configuration, Atlas index provisioning/checking, real API acceptance, recorded manual-browser acceptance, and disposable-data cleanup completed under separate approvals. Step 5 RBAC is implemented and validated offline but is not yet committed. Its real Atlas role-transition acceptance and retained-record cleanup remain pending. Production/deployment verification remains pending.

## Boundaries

The application remains lets_secureride-ai, with the @lets-secureride-ai npm scope and lets-secureride-ai-api service. Existing health contracts and bounded shutdown remain intact. Models share the isolated connection from the Step 3 composition factory. No global Mongoose connection, automatic DDL, database download, or DNS override is introduced.

The app factory accepts optional injected authentication dependencies; foundation tests remain independent of authentication secrets. Production startup requires validated authentication configuration, successful database connection, and the expected indexes before listening. Missing indexes produce a sanitized startup failure.

## Passwords and accounts

Registration accepts only email and password. Email is trimmed, lowercased, validated, and protected by the named unique database index. Provider-specific dot/plus transformations are not applied. Public registration assigns customer; role/status/security-field injection is rejected.

Passwords are preserved exactly, allowing 15–128 Unicode code points and at most 512 UTF-8 bytes. They are not trimmed or truncated. A small explicit common-password denylist is a baseline, not a comprehensive breached-password service. Argon2id uses 64 MiB memory, three iterations, parallelism one, a 32-byte output, and library-generated random salts. At most two password operations run concurrently per API process. Login verifies a dummy hash for unknown accounts and returns the same failure for wrong passwords, unknown accounts, and disabled accounts. Permanent lockouts are not used.

Password hashes and internal security fields are excluded from normal model selection. Controllers return explicitly mapped public DTOs only: id, email, role. Registration returns 201 without opening a session; the user then signs in.

## Access and refresh sessions

Access tokens use jose with HS256, a trusted key identifier, exact issuer/audience, at+jwt type, five-minute default lifetime, and 30-second clock tolerance. Required claims are sub, sid, ver, jti, iat, exp, iss, and aud. Identifier formats, times, and maximum lifetime are checked. No personal data or role is included in JWTs. Token-controlled remote key sources are rejected.

The API checks current account status/version and session state on every authenticated request. req.auth contains only userId, sessionId, and the database-derived role. Logout therefore invalidates subsequent requests without waiting for access expiry; already-authorized in-flight work may finish.

Each device session receives a random 128-bit identifier and a random 256-bit opaque refresh secret. Only SHA-256 digests persist. Default idle lifetime is seven days; absolute lifetime is 30 days. Every refresh conditionally swaps the current digest and records the consumed digest in one atomic document update. The absolute deadline never slides. Rotation history is capped at 10,000; reaching the cap requires signing in again.

Replaying a consumed token revokes its family. A guessed secret does not revoke a family. Strict handling can revoke a session after concurrent duplicate requests or a lost rotation response. Browser single-flight and Web Locks reduce accidental races; there is no raw-token grace cache.

Logout recognizes current or consumed refresh material, revokes the family, and clears the cookie. Missing/invalid material is idempotent. Persistence failure is reported without claiming server-side revocation. Logout-all increments the user's security version atomically; older sessions are unusable even if secondary cleanup fails. Future password/status changes must use the same invalidation boundary.

## HTTP contracts and browser controls

All endpoints are under /api/v1/auth and preserve the existing success/error envelope and request IDs.

| Endpoint         | Success                                   | Authentication              |
| ---------------- | ----------------------------------------- | --------------------------- |
| POST /register   | 201, public user                          | Public                      |
| POST /login      | 200, user/accessToken/tokenType/expiresIn | Credentials                 |
| POST /refresh    | 200, replacement access token and cookie  | Refresh cookie              |
| POST /logout     | 200, loggedOut                            | Refresh cookie when present |
| POST /logout-all | 200, loggedOut                            | Bearer access token         |
| GET /me          | 200, public user                          | Bearer access token         |

All auth POST requests require exact trusted Origin, X-CSRF-Protection: 1, and JSON content. Missing/null/untrusted origins, incompatible Fetch Metadata, and form submissions are rejected. The custom header is a preflight-enforcing marker, not a secret. No separate CSRF token endpoint is needed for this strict API-only transport. CORS permits credentials only for the configured frontend origin and exposes X-Request-ID. All auth responses use no-store, including malformed-body errors.

Local cookies use lsrai-refresh, HttpOnly, SameSite=Lax, Path=/, and no Domain. Production uses __Host-lsrai-refresh with Secure required. Expiry is capped by idle and absolute deadlines; clearing preserves the same flags. Production requires an HTTPS frontend origin. An unrelated cross-site frontend requiring third-party cookies is outside this design.

The client stores access tokens only in a private in-memory closure. It never uses localStorage/sessionStorage for credentials. Session restoration is single-flight, checks /me, and does not blindly retry mutations. Logout broadcasts only a logout marker; tokens are never broadcast. Web Locks serialize cookie-mutating operations when supported. Transient restoration errors offer retry rather than falsely asserting a confirmed unauthenticated session. Protected routes support only safe internal return destinations.

HttpOnly does not eliminate XSS: injected same-origin script could act as the user. React escaping is retained; no raw HTML is introduced. A frontend CSP and actual browser cookie/CORS verification remain deployment gates.

## Shared limits and safe events

AuthRateLimit stores HMAC-derived bucket identifiers, counters, and expiry, not plaintext email/IP. Atomic increments and duplicate-first-writer retries support multiple instances. Store failure fails closed.

| Policy                   | Limit         |
| ------------------------ | ------------- |
| Register/IP              | 5/hour        |
| Login/IP                 | 20/15 minutes |
| Login/normalized account | 10/15 minutes |
| Refresh/IP               | 60/5 minutes  |
| Refresh/session          | 30/5 minutes  |
| Logout/IP                | 30/5 minutes  |
| Logout-all/user          | 5/15 minutes  |
| Me/session               | 60/minute     |

Limits return safe 429 envelopes and Retry-After. The original general limiter remains an additional per-process guard. Proxy trust remains disabled; trusted AWS forwarding configuration requires deployment approval.

An injectable event sink emits bounded registration/login/reuse/logout events with request ID, outcome, timestamp, and optional opaque user ID. It never includes passwords, cookies, tokens, hashes, raw emails/IPs, configuration, or driver exceptions. Full activity-log persistence/reporting is deferred.

## Index provisioning and data lifecycle

users has auth_user_email_unique. auth_sessions has auth_session_user_revoked and auth_session_expiry. auth_rate_limits has auth_limit_expiry. Session TTL is on absoluteExpiresAt; limiter TTL is on expiresAt. Expiration is checked in application code because TTL deletion is asynchronous.

The operator-only auth:indexes command requires exactly --check or --apply. Its code reads injected runtime configuration; an explicitly authorized Node native environment loader supplied private configuration for the real Atlas operations. --apply creates the declared collections/indexes without dropping or synchronizing indexes, then verifies them. Normal server startup verifies only. Separately approved provisioning and independent --check verification succeeded without creating test users or sessions during provisioning.

After a separate approval and private configuration, the operator command is:

```powershell
npm run build
npm run auth:indexes --workspace @lets-secureride-ai/server -- --check
# --apply requires explicit provisioning approval:
npm run auth:indexes --workspace @lets-secureride-ai/server -- --apply
```

Index conflicts fail safely and require review. Do not drop indexes to resolve a conflict automatically. Neither existing Atlas database user is modified by this step.

## Private configuration

Only variable names and invalid placeholders belong in examples. Required signing/HMAC material must be independently generated and injected privately; base64 format/length checks cannot establish entropy. Never place secrets in commands, browser variables, screenshots, Git, or diagnostic output.

Required: JWT_ACCESS_SECRET, JWT_ACCESS_KEY_ID, JWT_ISSUER, JWT_AUDIENCE, AUTH_RATE_LIMIT_SECRET.
Optional paired previous verification key: JWT_ACCESS_PREVIOUS_SECRET and JWT_ACCESS_PREVIOUS_KEY_ID.
Bounded lifetimes: AUTH_ACCESS_TTL_SECONDS, AUTH_REFRESH_IDLE_SECONDS, AUTH_REFRESH_ABSOLUTE_SECONDS.
Existing CLIENT_ORIGIN and NODE_ENV determine origin and production-cookie policy.
JWT_REFRESH_SECRET is unused because refresh credentials are opaque.

Keys support active/previous verification during a coordinated short overlap. Multi-instance rotation must distribute the accepted keys before switching issuance, retain old verification only for the maximum access lifetime plus tolerance, and then remove it. Emergency revocation also invalidates affected sessions/security versions. Asymmetric verification across independent services is a later architectural choice.

## Dependencies, testing, and release gates

Only argon2 0.45.1, jose 6.2.10, and cookie 2.0.1 were added as direct server dependencies. Existing direct versions remain unchanged. Argon2's bundled native binary was hash/verify tested on Node 24.20.0 Windows without build tools or install-policy changes.

Tests use isolated fake repositories, clocks, mocked fetch, disconnected Mongoose instances, and focused real cryptography. Offline validation passed 258 tests: 45 client and 213 server, with 0 failed and 0 skipped, including all original 49 regression tests. These tests never load private configuration, connect to Atlas, or provision real indexes. Repository contracts and model declarations alone do not prove real MongoDB atomicity, uniqueness, or TTL deletion.

Step 5 preserves these 258 tests and adds 75 isolated RBAC cases across seven test files, producing 333 passing tests. It adds no authentication dependency, schema, collection, index, or migration. Real role-transition acceptance remains pending; see [RBAC architecture](rbac.md).

Separately approved real Atlas API acceptance passed 73 assertions with 0 failures using disposable data. It verified concurrent canonical-email registration, persisted rotation state, replay revocation, logout/logout-all, safe responses, transport controls, and limiter storage. API-run data was removed and cleanup independently verified. Recorded manual-browser observations covered registration, safe errors, sign-in, restoration, protected routing, same-browser cross-tab sign-out, and logout-all across separate browsers. These user-recorded observations are not automated browser capture; their exact scope is listed in [validation evidence](../evidence/README.md).

Subsequent manual-browser cleanup committed one transaction deleting 1 disposable customer, 4 owned sessions, and 2 conclusively attributable limiter records. One unattributed limiter record was retained for natural TTL expiration; its current TTL status remains unverified. Production HTTPS cookie/CORS/CSP behavior, deployment topology, native runtime capacity, real concurrent-refresh race behavior, and TTL deletion observation remain future verification work. No production acceptance or current collection-wide emptiness is claimed.

## AWS, rollback, and deferred scope

Future controlled HTTPS domains can use same-origin /api routing through CloudFront or same-site frontend/API subdomains. Authentication/personalized API responses must bypass cache. Secrets Manager or Systems Manager supplies keys; shared Atlas state supplies sessions and throttles; CloudWatch receives safe events. Native Argon2 loading and capacity must be checked on the selected Linux architecture. No infrastructure, deployment, proxy, or DNS settings are changed here.

Rollback retains account/session collections and the Step 3 checkpoint; no destructive Git or database cleanup is automatic. Returning to an earlier application version must not reactivate revoked sessions. Any data migration, emergency key rotation, or Git rollback needs separate permission.

Deferred: email verification, password recovery/change, MFA, social login, profile editing, device-management UI, full activity logging, admin endpoints, RBAC, cars, bookings, Stripe, polished UI, and AWS deployment. Email ownership must be verified before trusted-email/sensitive business flows. A future private operator command may promote an identified existing account with explicit approval, audit evidence, and session invalidation; no default administrator or public bootstrap endpoint exists.

## References

- [OWASP password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP CSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [RFC 9700 refresh-token security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [MongoDB atomicity](https://www.mongodb.com/docs/manual/core/write-operations-atomicity/)
- [MongoDB TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/)

## Authorization boundary

Authentication continues to load the current user and session and validate status, revocation, expiry, and `authVersion`. Access tokens carry no role claim. Authorization then evaluates the current MongoDB-backed role through fail-closed policy middleware. Role changes atomically increment `authVersion`, so promotion never upgrades an existing customer session and demotion invalidates existing administrator access.

See [RBAC architecture](rbac.md) for the admin access boundary and offline role-management lifecycle.
