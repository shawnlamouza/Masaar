# Architecture Decision Records

## ADR-001 - TypeScript monorepo

**Decision:** Use a pnpm workspace with `apps/web`, `apps/api`, `packages/contracts`, `packages/ui`, `packages/config`, and `packages/testing`.

**Why:** One team can share types, validation contracts, Tailwind tokens, lint/test configuration, and release checks without duplicating packages.

**Constraint:** Domain rules belong in the API/domain packages, not React components or database hooks.

## ADR-002 - React, Vite, and Tailwind CSS

**Decision:** Build the web/PWA client with React + TypeScript + Vite and Tailwind CSS using semantic CSS-variable-backed tokens.

**Why:** Fast development, strong ecosystem, simple static deployment, and a consistent responsive system for owner, employee, driver, confirmation, and tracking experiences.

**Constraint:** Feature code may not introduce raw brand-color literals or one-off status semantics when a shared token/component exists.

## ADR-003 - Node.js Fastify API with Zod contracts

**Decision:** Use Node.js + TypeScript + Fastify. Define request/response and domain-command schemas with Zod in the shared contracts package.

**Why:** Fastify is lightweight for AWS serverless/container options, has explicit plugin boundaries, strong schema support, and less framework overhead for a competition team.

**Constraint:** Frontend-generated totals and role claims are untrusted; the API recalculates and authorizes every mutation.

## ADR-004 - Modular monolith first

**Decision:** Deploy one API with modules for identity/tenancy, catalog, customers, orders, delivery, payments/custody, inventory, intelligence, files, and audit.

**Why:** Masaar needs transactional consistency and fast iteration more than microservice independence. Modules and events preserve future extraction boundaries.

**Constraint:** Modules communicate through defined services/events and cannot query another module's collections directly.

## ADR-005 - Microsoft SQL Server on AWS

**Decision:** Use Microsoft SQL Server with tenant-scoped relational tables, unique and covering indexes, validated JSON snapshots for complex aggregates, optimistic concurrency, and database transactions for financial/inventory invariants. Use Amazon RDS for SQL Server in AWS and keep the schema directly inspectable through SQL Server Management Studio.

**Why:** Relational tables make orders, payments, custody and reconciliation easy for operators and judges to inspect, while validated JSON snapshots preserve complex timelines and product variants without losing schema safety. RDS supplies managed backups and monitoring.

**Constraint:** Every tenant-owned query includes `tenantId`; repository APIs require tenant context; cross-tenant tests are release blockers.

## ADR-006 - AWS managed deployment

**Decision:** Host the frontend with AWS Amplify Hosting or S3/CloudFront; expose the API through API Gateway and Lambda initially; use Cognito, S3, SQS/EventBridge, CloudWatch, Secrets Manager, WAF, and AWS Budgets.

**Why:** This is economical, competition-aligned, and minimizes infrastructure operation. The API remains portable to App Runner/ECS if measured connection or workload behavior requires it.

**Constraint:** Select the AWS region during Phase 2 using current program requirements, service availability, latency, data, and contingency considerations; do not hard-code an unverified regional assumption in Phase 1.

## ADR-007 - Explicit event and audit model

**Decision:** Every important command writes the domain change and an outbox event atomically. A worker publishes queued events to analytics/notification consumers.

**Why:** Reliable events support reminders, projections, intelligence, and audit without fragile dual writes.

**Constraint:** Consumers are idempotent; event versions are immutable; personally identifying fields are minimized.

## ADR-008 - Append-only money and stock ledgers

**Decision:** Payments, refunds, custody, reconciliation adjustments, and inventory movements are append-only entries. Current balances are projections.

**Why:** Overwriting totals would destroy accountability and make discrepancies impossible to explain.

**Constraint:** Corrections create linked reversal/adjustment entries with actor, reason, and approval.

## ADR-009 - Offline scope is bounded

**Decision:** MVP offline support covers the driver's assigned manifest and queued delivery actions; the broader owner/employee app shows stale data and retry states but is not fully offline.

**Why:** This solves the highest-risk Lebanese connectivity interruption without attempting complex multi-user offline replication.

**Constraint:** Offline commands include device-generated idempotency keys and expected versions; conflicts require explicit resolution.

## ADR-010 - Rule-first intelligence

**Decision:** MVP intelligence uses versioned formulas, thresholds, indexed SQL queries/views, scheduled snapshots, and Recharts. ML is prohibited from the MVP critical path.

**Why:** Masaar can deliver novel decision experiences with explainable, testable logic before it owns representative training data.

**Constraint:** Every insight exposes source records, freshness, formula/rule version, currency treatment, missing data, and safe action.

## ADR-011 - Privacy and retention

**Decision:** Minimize customer data, use signed short-lived file URLs, encrypt in transit/at rest, redact logs, and configure retention for tokens/proofs/audits by data category.

**Why:** Customer phone, address, payment proof, and behavioral history require proportional protection.

**Constraint:** Reliability indicators use only explainable business history and never become cross-business blacklists without a separate legal, consent, and governance decision.
