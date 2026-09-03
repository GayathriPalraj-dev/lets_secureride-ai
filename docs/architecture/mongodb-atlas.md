# MongoDB Atlas foundation

Step 3 adds connection lifecycle management only. No schemas, collections, seed data, or database writes are implemented. This guide describes actions for the developer to perform manually; the implementation agent has not created Atlas resources. Subsequent explicitly approved runtime verification may connect to the existing cluster without creating application data.

## Manual setup

1. Open MongoDB Atlas and select or create your project privately. Select AWS as the cloud provider, preferably Mumbai when supported by your chosen tier. Verify current tier availability and any charges in the Atlas console before creation; no fixed pricing is assumed here.
2. Select an available free or learning-appropriate deployment. Review the configuration before creating it.
3. Use `lets_secureride_ai` as the intended application database name. Connecting alone does not materialize an empty database. Do not create a dummy collection to make it appear in the console; database materialization belongs to a later approved schema/write step.
4. Create a dedicated application database user, separate from your Atlas account. Scope its role to `readWrite` on `lets_secureride_ai` only; do not grant cluster administration or access to every database. This prepares for later application operations; Step 3 performs no writes.
5. Add your current public development IP to the project's IP access list, preferably as a temporary entry when available. Do not use `0.0.0.0/0` for normal development. Update the entry when your public IP changes.
6. Obtain the Atlas application connection string privately. Replace its database component with the intended database name. Percent-encode special characters in credential components individually; do not encode the entire connection string and do not paste credentials into an online encoder.
7. In a private editor, create your own ignored `apps/server/.env` based on the server example. Replace the fake database placeholder privately. Never place database configuration in the client or a `VITE_*` variable. The agent does not create or inspect this file.
8. Keep TLS enabled. Do not disable certificate validation to work around connection failures. Production validation requires TLS; SRV connections must retain TLS.

## Windows verification

After privately completing setup, use PowerShell from the project root:

```powershell
npm run dev:server
```

The server workspace script loads its optional local environment file with Node's native loader. Existing process environment values take precedence. Restart the process after editing environment configuration.

In a second terminal:

```powershell
Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/health'
Invoke-RestMethod -Uri 'http://localhost:5000/api/v1/health/ready'
```

Expected: liveness returns `ok`; readiness returns `ready` once connected. Initial database failure prevents HTTP startup. Later loss of connectivity makes readiness unavailable while liveness remains independent. Readiness reflects driver-observed state, not a fresh query per request, so network-failure detection is not instantaneous.

Press Ctrl+C to stop the server. Expect safe shutdown lifecycle events. To use the compiled server locally:

```powershell
npm run build
npm run start:local --workspace @lets-secureride-ai/server
```

The ordinary production `start` script reads injected process environment only; it does not load a file. Tests never load the local environment file or connect to Atlas.

## Troubleshooting without disclosure

- A configuration failure identifies `MONGODB_URI` without showing its value. Check the intended database name, protocol, placeholder replacement, encoding, and TLS options privately.
- For connection failure, privately verify the Atlas deployment status, database-user permissions, public-IP allowlist, DNS/network access, and credential validity.
- Do not enable verbose driver debugging or print full environment/configuration objects to troubleshoot.
- Evidence may contain command names, fixed lifecycle event codes, safe health envelopes, and pass/fail results only. Never include connection strings, credentials, database hostnames, or screenshots containing them.
- If credentials are exposed, rotate the database-user password immediately, update private local/runtime configuration, restart the service, and remove the disclosure from shared material. Deleting a screenshot or message alone does not revoke the old credential.

## Runtime design and AWS compatibility

Environment validation occurs before constructing services. An isolated Mongoose instance supplies the connection adapter. The manager coalesces concurrent operations, tracks safe state, owns event listeners, and closes resources even after a disconnect event. Startup awaits the database before listening. Shutdown marks readiness unavailable, drains HTTP, then disconnects the database within a ten-second total deadline. Deadline expiry attempts force-close and exits non-zero.

Connection settings use a 30-second server-selection timeout, 10-second connect timeout, pool size 0–10, and disabled buffering, automatic collection creation, and automatic indexing. Initial failure is fatal; driver events handle later disconnect/reconnect state. No custom endless connection retry loop is present.

Later EC2 deployment can receive the database configuration from Secrets Manager or Parameter Store at runtime. Allowlist the EC2 Elastic IP only when it is the actual outbound address; private-subnet deployment may instead use NAT egress or private networking. Replace the development access entry as appropriate. Keep secrets out of GitHub Actions logs. CloudWatch can receive the safe structured lifecycle events. No AWS configuration is created in Step 3.

## Official references

- [Mongoose connections](https://mongoosejs.com/docs/connections.html)
- [MongoDB connection-string formats](https://www.mongodb.com/docs/manual/reference/connection-string/)
- [Atlas AWS region availability](https://www.mongodb.com/docs/atlas/reference/amazon-aws/)
- [Atlas database users](https://www.mongodb.com/docs/atlas/security-add-mongodb-users/)
- [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/add-ip-address-to-list/)
- [Node 24 native environment loading](https://nodejs.org/download/release/v24.20.0/docs/api/cli.html#--env-file-if-existsfile)

## Windows DNS runtime correction

Use Node.js 24.20.0 LTS with bundled npm 11.19.0 and c-ares 1.34.8. On this Windows machine, the previous Node 22.23.1 runtime incorrectly discovered a loopback DNS resolver. The staged Node 24 runtime discovered the configured router resolver and resolved both SRV and TXT records without an override. Application DNS settings and connection configuration remain unchanged.

The upstream Windows resolver fix is described in [Node PR 64110](https://github.com/nodejs/node/pull/64110) and the [c-ares changelog](https://c-ares.org/changelog.html). The selected [official Node 24.20.0 release](https://nodejs.org/en/blog/release/v24.20.0) includes c-ares 1.34.8. Keep using normal system resolver discovery; do not hard-code development DNS servers into application startup. Future EC2 runtime configuration should use the same supported Node major and its normal network resolver.

Verify the runtime in a fresh PowerShell terminal:

```powershell
node --version
npm --version
node -p "process.versions.ares"
node -p "process.execPath"
where.exe node
where.exe npm
```

Expected versions: Node v24.20.0, npm 11.19.0, c-ares 1.34.8. Then use the health checks above. Do not print DNS records, connection configuration, or raw driver errors in shared evidence.

## Controlled runtime rollback

The migration stages official installers and exact pre-migration copies of the six approved files under `%TEMP%\lets-secureride-ai-node24-migration`. If migration validation fails, stop its temporary server, uninstall the newly installed Node 24 runtime with its official MSI, and reinstall the checksum-verified Node 22.23.1 MSI. Verify Node v22.23.1 and bundled npm 10.9.8 and their executable paths in a fresh terminal.

Restore only migration changes to `.nvmrc`, root `package.json`, root `package-lock.json`, `README.md`, this guide, and `docs/evidence/README.md` from those backups, preserving pre-existing and intervening user edits. Do not use Git reset or restore. Run `npm ci` with the restored lockfile and repeat the quality gates. Returning to the old runtime also returns its observed Windows DNS limitation; do not silently apply a DNS override. Keep temporary backups until the migration is accepted.
