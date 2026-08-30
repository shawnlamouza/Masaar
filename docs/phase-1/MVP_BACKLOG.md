# Prioritized MVP Backlog

Priorities: **P0** is required for the coherent competition MVP; **P1** strengthens the pilot but may be reduced before a P0 item; **Later** is outside the MVP release gate.

## Epic E1 - Platform foundation

- **P0 E1-S1:** As a team member, I can run, test, seed, and build the monorepo from documented commands.
- **P0 E1-S2:** As a release owner, I can deploy reviewed builds to isolated development and staging environments.
- **P0 E1-S3:** As an operator, I can see redacted logs, alarms, backup status, and AWS budget alerts.
- **P0 E1-S4:** As a developer, I reuse shared API contracts and Tailwind tokens/components.

## Epic E2 - Identity, tenancy, roles, and audit

- **P0 E2-S1:** An owner can invite employees and drivers and assign a supported role.
- **P0 E2-S2:** Every API and file request is tenant- and permission-scoped.
- **P0 E2-S3:** Every high-risk mutation records actor, time, before/after, reason, and correlation ID.
- **P0 E2-S4:** Duplicate commands are idempotent and concurrent changes surface a conflict.

## Epic E3 - Lebanese commercial master data

- **P0 E3-S1:** Employees manage products, images, variants, SKUs, availability, selling prices, and optional stock.
- **P0 E3-S2:** Owners record unit cost, supplier, lead time, and explicit USD/LBP currency.
- **P0 E3-S3:** Owners preview margin impact before approving selected price changes.
- **P0 E3-S4:** Employees find/create customers by normalized phone and reuse reviewed addresses.
- **P0 E3-S5:** Addresses capture area, street, building, floor, landmark, map pin, and original wording.

## Epic E4 - Order capture and lifecycle

- **P0 E4-S1:** Employees create a server-priced order with variants, quantity, fee, discount, prepayment, method, and channel.
- **P0 E4-S2:** Masaar warns about likely duplicate orders and records reasoned overrides.
- **P0 E4-S3:** Customers confirm details through an expiring no-account link.
- **P0 E4-S4:** Employees process legal lifecycle transitions from the Kanban/list and order detail.
- **P0 E4-S5:** Users see the immutable timeline, notes, tags, assignee, aging, and next action.
- **P1 E4-S6:** Users copy approved WhatsApp templates and see manual send history.
- **Later E4-S7:** Customers submit order requests through the constrained Masaar Order Link.

## Epic E5 - Delivery and offline driver workflow

- **P0 E5-S1:** Dispatchers manage drivers/providers, zones, fees, assignments, and manifests.
- **P0 E5-S2:** Drivers see only assigned stops, contact/address, notes, and amount/currency to collect.
- **P0 E5-S3:** Drivers record Out for Delivery, Delivered, or Failed with a new immutable attempt.
- **P0 E5-S4:** Driver commands queue offline and synchronize exactly once with visible conflict handling.
- **P1 E5-S5:** Owners analyze standardized failed-delivery reasons by area/provider.

## Epic E6 - Payments, custody, and reconciliation

- **P0 E6-S1:** Users record Cash, Whish, OMT, Card, Bank, or Other payment entries separately from delivery.
- **P0 E6-S2:** Partial, failed, paid, and refunded balances are calculated by currency.
- **P0 E6-S3:** Cash collection assigns custody to a collector; accepted handover changes the holder.
- **P0 E6-S4:** Masaar compares expected and returned money by driver/currency and opens discrepancies.
- **P0 E6-S5:** Authorized owners approve explained adjustments and close reconciliation without rewriting history.
- **P0 E6-S6:** Daily close shows collections, cash held, unresolved payments, refunds, and discrepancies.

## Epic E7 - Inventory and supply decisions

- **P0 E7-S1:** Stock changes only through append-only movements and reservations.
- **P0 E7-S2:** Concurrent orders cannot reserve the same final unit.
- **P0 E7-S3:** Owners see on-hand, reserved, available, low stock, dead stock, and stock cover.
- **P0 E7-S4:** Stock & Supplier Radar explains cost/lead-time exposure and suggests editable restock quantity/budget.
- **P0 E7-S5:** Returns/exchanges link item condition, stock disposition, delivery, and money effects.
- **Later E7-S6:** Multiple locations receive transfer suggestions before reordering.

## Epic E8 - Masaar Decision Engine

- **P0 E8-S1:** Morning Brief ranks five explainable actions with impact, evidence, confidence, and resolution.
- **P0 E8-S2:** Profit Leak Explorer separates cost, FX, discount, delivery, failure, refund, and known variable-cost effects.
- **P0 E8-S3:** Cash Map shows method, status, currency, holder, age, and discrepancy.
- **P0 E8-S4:** Price & Stock Radar connects margin, stock cover, supplier risk, and restock cash.
- **P0 E8-S5:** Lebanon Delivery Map compares success, failure, fee, delay, and contribution by area.
- **P0 E8-S6:** Channel & Customer Pulse compares channel/product value, AOV, repeat rate, and lapsed regular customers.
- **P1 E8-S7:** Scenario Mode previews owner-entered cost, FX, price, discount, and delivery-fee changes.
- **P0 E8-S8:** Every metric and warning shows freshness, formula/rule version, currency, missing data, and source records.

## Epic E9 - Release quality

- **P0 E9-S1:** Automated tests cover tenant/role denial, financial invariants, stock concurrency, lifecycle, idempotency, and offline sync.
- **P0 E9-S2:** Responsive and accessibility review covers owner, employee, driver, confirmation, and tracking experiences.
- **P0 E9-S3:** Backup/restore, rollback, monitoring, security, cost, and low-connectivity runbooks pass rehearsal.
- **P0 E9-S4:** Golden-path demo runs from clean seed data on laptop and phone with a recorded fallback.

## Deferred expansion

- Lebanon Admin Organizer: deadline checklist, document vault, reminders, and official links only.
- Official messaging/storefront/courier/payment integrations.
- Multi-location transfer optimization and broader cash-flow planning.
- Forecasting, anomaly detection, delivery-risk models, and governed AI assistant.
