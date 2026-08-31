# Masaar production and competition release checklist

## Required before the competition submission

- [x] Final React/TypeScript/Tailwind interface and role-specific navigation.
- [x] Node.js/Fastify API, shared Zod contracts and tenant-scoped permissions.
- [x] Order, confirmation, delivery, payment, cash custody, stock, returns and intelligence workflows.
- [x] Microsoft SQL Server repositories, idempotent schema and SSMS operational views.
- [x] Automated tests, type checks, lint, production build and responsive role workflow review.
- [x] Functional specification, implementation plan, rebuilt final submission Word/PDF, architecture diagram and 1:50 demo video.
- [ ] Add every team member name and contribution to `output/pdf/Masaar_Final_Submission.pdf`.
- [ ] Replace the four honest team-name placeholders with the real names.
- [ ] Add the public GitHub, deployed application and uploaded demo video URLs.

## SQL Server and SSMS gate

- [ ] In SSMS, create/select the target `Masaar` database.
- [ ] Run `infra/sql/001_masaar_schema.sql`, then `002_operator_views.sql`.
- [ ] Create a least-privilege SQL-authenticated application login; do not commit its password.
- [ ] Set `SQLSERVER_CONNECTION_STRING` and confirm the API starts without the in-memory fallback.
- [ ] Verify all tables plus `vw_order_operations`, `vw_cash_custody`, `vw_delivery_performance`, `vw_payment_completion`, `vw_product_variants`, `vw_order_lines`, and `vw_customer_addresses`.
- [ ] Create an order, update it, restart the API and prove persistence in SSMS.
- [ ] Test backup and restore before a real pilot.

The current Windows SQL Server service advertises encryption but rejects command-line clients before authentication. Resolve its certificate/Force Encryption configuration in SQL Server Configuration Manager or use a correctly configured RDS instance; this project deliberately does not change machine-wide SQL security settings automatically.

## AWS gate

- [ ] Provision a private Amazon RDS for SQL Server instance and security groups.
- [ ] Store the SQL connection string in Secrets Manager and pass it to the API securely.
- [ ] Deploy API Gateway/Lambda and the web application with HTTPS.
- [x] Route `/api/*` and `/health` through CloudFront to API Gateway with caching disabled.
- [ ] Configure Cognito attributes `custom:tenantId` and `custom:role`; exercise registration, sign-in and invitation paths.
- [x] Fail closed when staging/production is not using Cognito; restrict development authentication to loopback hosts and origins.
- [ ] Configure CloudWatch alarms, log retention, AWS Budgets, WAF/rate limiting and an RDS restore drill.
- [ ] Measure the chosen AWS Region from Lebanon instead of relying on unverified outage claims.

## External integrations gate

- [ ] Keep the manual WhatsApp copy/share path until an approved WhatsApp Business provider is configured.
- [ ] Configure sender domain/provider, consent and bounce handling before enabling email notifications.
- [ ] Add courier/payment providers only with official APIs, idempotency, signature verification, failure handling and a visible manual fallback.
- [ ] Never present an integration as connected merely because a template or launch card exists.

## Final smoke test

1. Register a business and invite an employee and driver.
2. Add/edit a product, customer, supplier, delivery partner and fee zone; verify each change appears immediately.
3. Create and confirm an order; process it to Ready for Dispatch.
4. Assign it, complete the driver action, post collection and reconcile the holder cash.
5. Confirm inventory, customer history, audit timeline, notifications and intelligence all update from the same events.
6. Test owner, employee, driver and read-only access, mobile width, offline queue state, invalid forms and restart persistence.
