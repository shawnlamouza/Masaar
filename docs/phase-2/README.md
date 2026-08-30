# Phase 2 - AWS Foundation, Identity and Tailwind Experience System

## Outcome

Phase 2 turns the Phase 1 contracts into a working, reusable delivery platform. It creates the application shell and engineering controls that every catalog, order, payment, delivery and intelligence feature will depend on; it does **not** fabricate those later business modules.

## Delivered foundation

- pnpm monorepo with React/TypeScript/Vite/Tailwind, Node.js/TypeScript/Fastify, Zod contracts and shared UI components;
- responsive owner, manager, employee, driver and read-only shells with permission-aware actions;
- a component gallery at `/foundation/components` for actions, status states, forms, warnings, loading and empty states;
- local development identities and a production Cognito verification path;
- server-enforced role permissions, mandatory tenant context and cross-tenant tests;
- append-only audit events with actor, tenant, action, entity, time, correlation ID and before/after values;
- tenant-safe business settings and a Microsoft SQL Server adapter, with deterministic in-memory demo repositories for local competition demonstrations;
- AWS SAM definitions for Lambda/API Gateway, Cognito, Secrets Manager, S3, CloudFront, SQS/DLQ, CloudWatch, X-Ray, WAF and Budgets;
- CI checks and a manual, environment-protected staging deployment workflow.

## Important routes

| Route                          | Purpose                                          | Guard             |
| ------------------------------ | ------------------------------------------------ | ----------------- |
| `GET /health`                  | Service health and environment                   | Public            |
| `GET /api/session`             | Resolved user, tenant, role and permissions      | Signed in         |
| `GET /api/audit`               | Tenant audit history                             | `audit:read`      |
| `POST /api/admin/invitations`  | Validated membership invitation contract         | `users:manage`    |
| `GET /api/foundation/settings` | Tenant business defaults                         | Signed in         |
| `PUT /api/foundation/settings` | Change tenant business settings and append audit | `business:manage` |

## Boundaries

Phase 3 implements catalog, customers, currencies and suppliers on this foundation. The numbers and warnings visible in the Phase 2 shell are explicitly labelled demonstration data; they prove the experience contract and offline behavior, not production analytics.

## Documents

- [Local and deployment runbook](RUNBOOK.md)
- [Security and tenancy model](SECURITY_MODEL.md)
- [Environment and resilience decisions](ENVIRONMENTS_AND_RESILIENCE.md)
- [Exit gate](PHASE_2_EXIT_GATE.md)
