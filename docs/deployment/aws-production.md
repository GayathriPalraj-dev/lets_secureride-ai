# SecureRide AWS Lambda production deployment

Validate and review the infrastructure template before any AWS creation or
update command. AWS deployment and Atlas changes require separate approval.

## Architecture

CloudFront provides one HTTPS origin. Its default behavior serves the React
build from a private S3 bucket. `/api/*` is forwarded unchanged to a regional
API Gateway HTTP API using Lambda proxy payload format 2.0. The API invokes the
Node.js 24 x86-64 Lambda handler. A separate private S3 bucket stores car media;
MongoDB Atlas remains external.

Nginx, systemd, EC2, EBS, Elastic IPs, NAT Gateway, Secrets Manager, provisioned
concurrency, API caching, WAF, ECR, and customer-managed KMS keys are not part of
the active Lambda design. Their existing files remain historical references.

## Runtime configuration

The Lambda receives only the name of one pre-existing SSM Standard SecureString
and the expected HTTPS client origin. Its strict JSON configuration must be no
larger than 3,800 UTF-8 bytes (below AWS's 4,096-byte Standard limit), contain no
unknown or missing fields, and pass all production validators. The execution
role grants only `ssm:GetParameter` on that exact parameter ARN and uses the
AWS-managed SSM encryption key.

Configuration, SDK responses, raw exceptions, credentials, cookies, signed
bodies, and secret-bearing objects must never be logged. A failed configuration
or database initialization is cleared so a later invocation can retry.

## Runtime behavior

Lambda uses 1,024 MB memory, a 29-second timeout, reserved concurrency 2, no
provisioned concurrency, and a seven-day log retention. Each warm execution
environment reuses one configuration, Express application, adapter, MongoDB
connection and initialization promise. MongoDB uses `maxPoolSize=2`,
`minPoolSize=0`, `serverSelectionTimeoutMS=7000`, and `connectTimeoutMS=5000`.

Lambda initialization does not create or verify indexes. Run every repository
index-verification command as an explicit pre-deployment gate. Do not retry
arbitrary HTTP mutations in the handler.

## CloudFront API behavior

The `/api/*` behavior uses the regional API Gateway origin over HTTPS, redirects
viewers from HTTP to HTTPS, allows all API methods, disables caching, preserves
the path and request body, and forwards all cookies and query strings. It omits
the viewer `Host` header and forwards authentication, content, origin, Stripe
signature, car-image signature, CSRF, conditional-request and CORS-preflight
headers. Express remains responsible for CORS response headers.

Stripe webhook and car-image scan-event routes remain before `express.json()`.
The API Gateway adapter must decode the payload exactly once and deliver a
Buffer containing the original bytes. Compressed signed requests are rejected.
Binary image responses are base64 encoded by the adapter for API Gateway.

## Packaging and validation

Build only with `infrastructure/production/package-lambda.ps1` using the official
Node.js 24 Lambda image for linux/amd64. The build must run from the lockfile,
compile required workspaces, prune development packages, verify Linux x86-64
`argon2` and `sharp`, enforce Lambda ZIP limits, reopen the ZIP in a clean
compatible container, scan for secret patterns without printing values, and
record the image digest and ZIP SHA-256.

Before deployment, pass formatting, lint, type checking, focused Lambda tests,
the complete regression suite, production build, offline CloudFormation checks,
PowerShell parsing, native-module packaging checks, and explicit database index
verification.

## Acceptance and rollback

Verify `/api/v1/health` and `/api/v1/health/ready`, registration, login/refresh,
RBAC, all six demo cars, filters, booking, coupons, Stripe payment, pay at
pickup, image upload/scan, booking history, secure cookies, raw webhook bytes,
and image-event HMAC through CloudFront.

Rollback must select the prior immutable Lambda artifact, SSM parameter version,
and CloudFront configuration. Review retained S3 objects, log groups and
artifacts separately because free-tier allowances are not hard spending limits.
