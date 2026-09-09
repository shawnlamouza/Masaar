# Masaar

Public repository: https://github.com/shawnlamouza/Masaar

Live application: https://masaar.azurewebsites.net

Masaar is a Lebanon-tailored operations and decision-intelligence platform for small businesses that sell through Instagram, WhatsApp, TikTok, Facebook, phone, physical stores, or simple websites.

The product captures what happens after a customer decides to order, protects delivery/payment/stock accountability, and converts those records into explainable owner actions.

Each order can follow delivery, customer-pickup, or in-store fulfillment. Only delivery orders request an address and create driver/courier records; pickup and in-store handovers still update payment, cash custody, inventory, customer history, returns, and business intelligence from the same auditable order record.

## Current delivery status

- Phase 1 complete: Product Contract, Metrics and Architecture
- Phase 2 complete locally: AWS Foundation, Identity and Tailwind Experience System
- Phase 3 complete locally: Lebanese Commerce Foundations
- Phase 4 complete locally: order capture, secure customer confirmation and accountable employee processing
- Phase 5 complete locally: delivery resources/zones, driver mobile workflow, payment separation, custody and reconciliation
- Phase 6 complete locally: inventory movements, reservations, Stock & Supplier Radar, returns and exchanges
- Phase 7 complete locally: explainable business intelligence, interactive graphs and owner decision center
- Phase 8 complete locally: governed forecasting, anomaly detection, scenario planning and grounded Masaar assistance
- Phase 9 complete locally: launch readiness, Lebanese administration organizer, integration truth, customer growth, installable/mobile continuity and final experience polish
- Product-readiness corrections: [`docs/product-readiness/README.md`](docs/product-readiness/README.md)
- Phase 1 source of truth: [`docs/phase-1/README.md`](docs/phase-1/README.md)
- Phase 2 source of truth: [`docs/phase-2/README.md`](docs/phase-2/README.md)
- Phase 3 source of truth: [`docs/phase-3/README.md`](docs/phase-3/README.md)
- Phase 4 source of truth: [`docs/phase-4/README.md`](docs/phase-4/README.md)
- Phase 5 source of truth: [`docs/phase-5/README.md`](docs/phase-5/README.md)
- Phase 6 source of truth: [`docs/phase-6/README.md`](docs/phase-6/README.md)
- Phase 6 exit gate: [`docs/phase-6/PHASE_6_EXIT_GATE.md`](docs/phase-6/PHASE_6_EXIT_GATE.md)
- Phase 7 source of truth: [`docs/phase-7/README.md`](docs/phase-7/README.md)
- Phase 7 exit gate: [`docs/phase-7/PHASE_7_EXIT_GATE.md`](docs/phase-7/PHASE_7_EXIT_GATE.md)
- Phase 8 source of truth: [`docs/phase-8/README.md`](docs/phase-8/README.md)
- Phase 8 exit gate: [`docs/phase-8/PHASE_8_EXIT_GATE.md`](docs/phase-8/PHASE_8_EXIT_GATE.md)
- Phase 9 source of truth: [`docs/phase-9/README.md`](docs/phase-9/README.md)
- Phase 9 exit gate: [`docs/phase-9/PHASE_9_EXIT_GATE.md`](docs/phase-9/PHASE_9_EXIT_GATE.md)

## Run locally

1. Install Node.js 22+ and pnpm 11.
2. Run `pnpm install`.
3. Copy `.env.example` to the relevant app environment files if custom values are needed.
4. Run `pnpm dev` and open `http://localhost:5173`.

Development authentication is deliberately local-only. Sign in with `joe@masaar.demo` and `Masaar-Demo1!` for Joe's owner workspace; manager, employee and driver demonstration identities are available on the sign-in page. The live competition environment uses an explicit staging-only demo mode with the same role boundaries and persistent SQL records. Production configuration fails closed unless Cognito is enabled.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Node.js, TypeScript, Fastify, Zod
- Database: Microsoft SQL Server, with SSMS-compatible schema scripts; the live environment uses Azure SQL Database and the repository retains its Amazon RDS deployment path
- Cloud: Azure App Service and Azure SQL Database for the live application, with the documented AWS SAM architecture retained for Amazon-program portability
- Visualization: Recharts

Phase 5 connects ready orders to internal drivers, freelancers or delivery companies, preserves every attempt and failed-delivery reason, and keeps delivery, payment and cash custody separate. Phase 6 connects the same orders to stock reservations, sale finalization, supplier receipts, controlled corrections, inspected returns and linked replacement orders. Phase 7 turns these records into trusted revenue, margin, cash, customer, product, delivery, area and inventory decisions without hiding definitions or confidence. Phase 8 adds bounded forecasts, anomaly detection, planning scenarios, explainable caution indicators and a tenant-grounded assistant while keeping authorized people responsible for every business change. Phase 9 closes the release with measurable launch checks, Lebanese administrative accountability, honest integration states, customer growth segments, secure customer tracking, installable mobile behavior and a clearer role-scoped information architecture.

Email, WhatsApp, courier and payment provider APIs are not falsely presented as live. In-app operational notifications are live; the Launch Center shows the exact external configuration and provider-approval gates required before each integration is enabled.

## Final documents package

- Functional specification and product vision
- Implementation and release plan
- Final submission report
- User manual
- SQL Server schema and SSMS reporting views
- Limited two-minute demo guide (due to the video's time limit)
- Architecture diagram

## Quality gates

Run `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm build` before every release. The final local audit passed 59 automated tests, TypeScript checks, lint, a production build, and responsive owner/employee/driver browser workflows. Development credentials remain loopback-only, the public judge experience uses the separately constrained staging-demo mode, and production configuration fails closed unless Cognito is enabled. A production pilot additionally requires identity, backup/restore, provider and custom-domain gates in the release checklist.
