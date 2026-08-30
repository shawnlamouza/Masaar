# Phase 2 Runbook

## Local development

Requirements are Node.js 22+ and pnpm 11. From the repository root:

```text
pnpm install
pnpm dev
```

The web application runs on `http://localhost:5173` and proxies API requests to `http://localhost:3001`. Without `SQLSERVER_CONNECTION_STRING`, the API deliberately uses process-local demo repositories so demonstrations can continue without external infrastructure. Restarting the API clears that local demonstration data.

Development bearer identities are `dev.owner`, `dev.manager`, `dev.employee`, `dev.driver` and `dev.readonly`. The web role selector uses these identities against the fixed demo tenant `tenant_cedar_thread`. These identities are rejected when `AUTH_MODE=cognito`.

## Quality gate

Run before every merge:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Tests must include an unauthenticated request, forbidden role action and cross-tenant isolation. A green interface is not authorization evidence; API guards are authoritative.

## Staging prerequisites

1. Confirm the AWS Industry Program account and allowed region; do not infer the region from old screenshots or news.
2. Create a GitHub OIDC deployment role limited to the staging stack and artifact buckets.
3. Configure GitHub environment `staging` with reviewer approval, secret `AWS_DEPLOY_ROLE_ARN`, secret `SQLSERVER_CONNECTION_STRING`, and variables `AWS_REGION`, `WEB_ORIGIN`, `BUDGET_EMAIL`, `MONTHLY_BUDGET_USD`.
4. Create an Amazon RDS for SQL Server instance in private subnets, restrict its security group, create a least-privilege application login and enable automated backups.
5. Run the manual **Deploy Masaar staging** workflow and review the CloudFormation change set.

The template stores the supplied SQL Server connection string in Secrets Manager, but passing a secret as a CloudFormation parameter can expose it to authorized deployment metadata. For a production hardening pass, create/update the secret outside CloudFormation and pass only its ARN.

## After deployment

- open the `WebUrl` stack output and verify desktop and narrow mobile layouts;
- call the `ApiUrl/health` output and confirm `staging`;
- invite one employee and one driver through the application integration once Cognito invitation UI is connected;
- confirm forbidden role calls return 403 and tenant-isolation integration tests pass;
- confirm the API error alarm, WAF metrics, X-Ray traces and budget subscriber are active;
- test the RDS snapshot/restore procedure with a disposable staging database.

## Rollback

CloudFormation provides infrastructure rollback. For application rollback, redeploy the previous green commit; do not delete retained evidence or backup data. Database schema changes in later phases require forward-compatible migrations and their own rollback notes.
