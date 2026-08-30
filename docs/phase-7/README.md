# Phase 7 — Explainable Business Intelligence and Owner Decision Center

Phase 7 turns Masaar's operational source of truth into a decision system for owners, managers and read-only analysts. It is deliberately not a page of decorative charts: every metric has a documented formula, a data-completeness signal, a previous-period comparison and a path back to the operational tool where the user can act.

## Completed intelligence experience

1. **Executive intelligence stage:** the selected 7-, 30- or 90-day window opens with the highest-priority decision, its financial or operational impact, confidence and a direct action.
2. **Business scorecard:** recognized revenue, gross margin, average order value, delivery success, payment completion and repeat-customer rate remain distinct and expose their definitions on demand.
3. **Business pulse:** an interactive Recharts time series separates recognized revenue, gross profit and collected cash while showing order volume as a separate signal.
4. **Money truth:** a working-capital view explains recognized revenue, product cost, gross profit, collections, outstanding balances, cash held by people, cash tied in stock and the current restock estimate.
5. **Ranked decision queue:** rule-based insights prioritize cash custody, stock pressure, delivery failure patterns, channel opportunity and repeat-customer behavior. Each recommendation opens the relevant Masaar workflow.
6. **Channel economics:** sources such as Instagram, WhatsApp, TikTok, Facebook and websites are compared by revenue and gross profit—not vanity order count alone.
7. **Product truth:** products are compared by recognized revenue, profit, margin, availability and stock-cover signals such as Winner, Restock, Watch and Slow.
8. **Lebanon delivery intelligence:** areas and governorates show order value, delivery success and recorded failures, supported by a failed-reason mix and first-attempt success rate.
9. **Customer engine:** active and repeat customers, repeat rate and observed period value are shown without mislabeling an observation as an AI lifetime-value prediction.
10. **Trust layer:** the workspace declares recognition rules, currency boundaries, included costs, demo/live data mode and missing-data limitations.

## Metric integrity rules

- Recognized revenue comes from delivered order snapshots; delivery does not imply payment.
- Collected amount comes only from posted payment entries.
- Gross profit subtracts the snapshotted product cost. It does not silently pretend delivery, packaging, marketing or overhead are zero.
- USD and LBP remain separate unless an owner-approved FX snapshot is explicitly used.
- Payment, delivery, refunds, inventory and cash custody are separate ledgers connected by order identity.
- Every recommendation is explainable and uses High, Medium or Low confidence rather than an opaque AI score.
- A new registered company sees only its live records. Joe's competition workspace includes an explicit `Demo history + live actions` label so multi-period graphs can demonstrate the intended future product honestly.

## Access and actions

- **Owner:** full Business Intelligence and all drill-through actions.
- **Manager:** full Business Intelligence and allowed operational actions.
- **Read-only analyst:** full intelligence visibility with existing read-only controls in destination modules.
- **Employee:** operational Overview only; sensitive business-wide intelligence is not placed in the employee navigation.
- **Driver:** no business intelligence access.

## Technical implementation

- Shared Zod contracts define the entire intelligence response.
- The Fastify intelligence service aggregates tenant-scoped order, delivery, payment, cash, customer and inventory records.
- React and Tailwind render the responsive decision hierarchy.
- Recharts supplies responsive area, line, bar and outcome visualizations.
- The endpoint is protected by `analytics:read`; the existing role/permission model controls access.
- The current calculation is request-time and explainable. Production-scale materialized snapshots can later be added without changing the UI contract.

## Phase boundary

Phase 7 is descriptive and diagnostic intelligence: it explains what happened, where money or performance moved, and which safe operational action is supported by current evidence. Phase 8 will introduce forecasting and AI-assisted capabilities only after sufficient production history exists, including anomaly detection, demand forecasting, reliability prediction, delivery-delay risk, inventory recommendations and the Masaar AI assistant.
