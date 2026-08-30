# Environments, Cost and Lebanese Connectivity

## Environment separation

Local development uses mocked/in-memory persistence by default. Staging and production use separate CloudFormation stacks, Cognito pools, databases, buckets, queues, secrets and budgets. No staging identifier or customer record may be reused in production.

## AWS region decision

The repository intentionally leaves the region as a deployment variable. The team must select it using current Amazon Industry Program requirements, service availability, latency from Lebanon, RDS availability and business-continuity considerations at deployment time. A second-region design is not justified for the MVP; backups and an export/restore runbook are.

## Low-connectivity behavior

Phase 2 provides explicit API-unavailable UI, stable skeleton/empty states and a local mocked mode. Later phases may cache bounded reference data and queue driver delivery actions with idempotency keys, but must never claim that an unsynchronized order, payment or cash handover is safely stored on the server.

## Economical controls

Lambda ARM, API Gateway, S3/CloudFront, a small SQL connection pool, reserved Lambda concurrency, SQS redrive, PriceClass 100 and monthly budgets keep the foundation proportionate. The RDS instance class, backup retention and Lambda connection behavior must be chosen after a measured staging load test; the cheapest tier is not automatically the safest choice.
