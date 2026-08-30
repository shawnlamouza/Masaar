# Security, Identity and Tenant Model

## Authentication modes

`dev` accepts only documented local bearer identities and requires `x-tenant-id`. It exists for local work and deterministic tests. `cognito` verifies a Cognito ID token and derives immutable tenant context plus the role from signed custom claims; callers cannot select their tenant through a request header.

## Authorization

The shared contract maps Owner, Manager, Employee, Driver and Read-only to explicit permissions. Every protected API route uses a session or permission guard. Hiding a button is user experience only; the API remains the enforcement boundary.

## Tenant isolation

Every tenant-owned repository method requires `tenantId`, every audit record stores it and SQL Server keys/indexes start with it where relevant. Cross-tenant tests are release blockers. Domain repositories must never expose an unscoped query, update or aggregation method to route handlers.

## Audit and accountability

Important commands append an immutable audit event containing actor, role, tenant, action, entity, timestamp, correlation ID and optional before/after values. Logs use correlation IDs but must not contain payment proofs, access tokens, full addresses or unnecessary phone data.

## Baseline controls

- short Cognito token lifetimes, token revocation and optional TOTP MFA;
- Secrets Manager for production configuration;
- S3 encryption, versioning and public-access blocking;
- WAF managed rules and rate limiting;
- API/Lambda error alarm, X-Ray traces and cost budget;
- least-privilege AWS roles and GitHub OIDC instead of long-lived AWS keys.
