# Phase 9 — Governed Expansion and Release Completion

Phase 9 completes the locally runnable Masaar product without turning it into a generic all-in-one suite. The expansion stays tied to Masaar's core promise: trusted operations, accountable money and stock, clear Lebanese context, and decisions that an authorized person can understand and approve.

## Completed capabilities

1. **Launch Center:** a new owner, manager and analyst workspace calculates pilot readiness from actual tenant records and the active environment. Catalog, customers, orders, delivery resources, zones, payment evidence, persistent data and production identity each show an explicit pass or gap and open the exact corrective module.
2. **Lebanon Admin Organizer:** owners can create, assign, complete and reopen reminders for registration, tax, NSSF, licenses, documents and continuity work. Dates and changes are persisted and audited. The tool stores responsibility and evidence; it never interprets law, files forms or replaces an accountant.
3. **Integration truth registry:** Amazon Cognito, Amazon RDS for SQL Server, Amazon SES, WhatsApp Business, delivery providers and payment providers are labeled `Connected`, `Sandbox`, `Ready to configure` or `Manual fallback`. Masaar accepts official APIs only and never claims that an unconfigured message, delivery or settlement was synchronized.
4. **Customer Growth Map:** transparent rules identify Champions, Repeat, New, At-risk and Delivery-recovery groups from the business's own customer history. Each group includes the reason, recorded spend, customer names and a human next action. Groups are not hidden scores or blacklists.
5. **Governed export:** the customer-growth summary can be exported as a plain CSV with the segment rule and recommended action visible.
6. **Installable web app:** the production frontend includes a web-app manifest, application metadata and an offline app-shell service worker. The API is never cached as if it were current.
7. **Driver continuity:** the phone workspace persists the last route/cash snapshot and exact-once command outbox on the device. It distinguishes real disconnection from an explicit offline simulation and shows when the route was last saved.
8. **Customer tracking:** the same secure customer link becomes a no-account tracking page after confirmation. It shows the current lifecycle, refreshes active orders and handles failed, cancelled, returned and refunded exceptions honestly.
9. **Final information architecture:** navigation is grouped into Today, Operate, Fulfill, Control and Business. A role-scoped `Ctrl+K` command palette locates tools and transfers order searches; mobile owner/employee navigation uses a compact bottom bar.
10. **Final visual and interaction pass:** the Launch Center uses the established navy, teal and gold system with deliberate depth, motion cues and hierarchy. Module changes reset page position, fixed/mobile surfaces avoid clipped poster artwork, and clickable surfaces consistently expose hover, focus and press states.

## Role boundaries

- **Owner:** reads every Phase 9 surface and manages administrative reminders.
- **Manager:** reads launch, integration and growth evidence, but cannot change owner-level business administration.
- **Read-only Analyst:** reads the Launch Center and exports governed summaries; underlying destination modules preserve read-only permissions.
- **Employee and Driver:** do not receive company launch configuration, administrative deadlines or company-wide customer segmentation.

## Persistence and audit

Administrative reminders use the expansion repository. Local development uses the deterministic in-memory repository; configured environments use the tenant-scoped `admin_tasks` SQL Server table and indexes. Creating, editing and completing a reminder records an audit event with actor, tenant, time, previous state and new state.

## Honest provider boundary

Email, WhatsApp, courier and payment APIs require approved provider accounts, credentials, consent and production webhook/reconciliation tests. Phase 9 delivers the provider contract and visible fallback behavior; it does not fabricate external connectivity. In-app notifications are live today. Amazon SES remains `Ready to configure`, WhatsApp/courier/payment adapters remain `Manual fallback`, and local identity/database remain `Sandbox` until Cognito and RDS for SQL Server are configured.

## Deferred by design

- **Multi-location transfers:** Masaar's selected first customer is a small, single-location social-commerce business. Transfer optimization becomes justified only after a pilot proves a real multi-location need.
- **Public Masaar Order Link/storefront:** the existing employee-created secure confirmation link remains the safe MVP. A public acquisition link needs abuse protection, availability rules and real pilot evidence before it can create trusted orders automatically.
- **Automatic loyalty points:** transparent customer segments and owner-approved outreach were selected over a generic points system. Loyalty mechanics should be added only when merchants confirm the reward and margin model.
- **Live external sending:** provider adapters remain gated until approved accounts, webhooks, consent and reconciliation can be tested end to end.

## PWA and low-connectivity boundary

The production service worker caches the application shell and static brand assets only. `/api` responses and mutations stay network-bound so Masaar never displays cached financial or operational records as current. The driver workflow separately maintains a visible device cache and idempotent outbox because that offline scope is explicit, bounded and operationally necessary.

## Verification summary

- ESLint: clean.
- TypeScript: contracts, UI, API and web pass.
- Automated tests: 46 pass across contracts, API and web.
- Production web build: 2,406 modules transformed successfully.
- Browser QA: desktop sign-in, owner overview, Launch Center tabs, command search, 390 px owner navigation and 390 px driver route inspected; no browser console warnings or errors.
