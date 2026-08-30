# Phase 2 Exit Gate

## Repository gate

- [x] React/TypeScript/Tailwind and Node.js/TypeScript monorepo is runnable.
- [x] Shared contracts and reusable semantic UI components exist.
- [x] Owner, Manager, Employee, Driver and Read-only contexts are represented.
- [x] API permission and tenant boundaries have automated tests.
- [x] Important foundation changes append audit history.
- [x] Local demonstration operation remains usable without external database infrastructure or the internet.
- [x] CI and reviewed staging-deployment workflows are defined.
- [x] AWS cost, logs, queue failure, secrets, storage, Cognito and WAF controls are defined as code.
- [x] Formatting, lint, strict type checks, 10 automated tests and all production builds pass locally.
- [x] Owner/driver role differences, the Tailwind gallery and the 390px mobile layout were verified in the live local application with no browser console warnings or errors.

## External deployment gate

- [ ] AWS account, approved region and GitHub OIDC role supplied by the team.
- [ ] Amazon RDS for SQL Server instance, least-privilege login and backups configured.
- [ ] Staging stack deployed and its budget subscription confirmed.
- [ ] Cognito invitation integration tested with real employee and driver accounts.
- [ ] Keyboard checks against deployed Cognito screens and a staging restore drill recorded.

## Gate result

The Phase 2 repository foundation is implementation-complete when local quality commands pass. Promotion to live staging remains intentionally blocked until the team supplies and approves the external account, region, domain and secret configuration; no document should claim those resources are deployed before that evidence exists.

Phase 3 may begin against the local/test foundation. Production release remains prohibited until the external deployment gate passes.

Local verification recorded on 22 August 2026.
