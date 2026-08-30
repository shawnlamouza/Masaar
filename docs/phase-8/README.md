# Phase 8 — Governed Forecasting and Masaar Assistant

Phase 8 adds a predictive layer without weakening Masaar's source-of-truth principles. Predictions are ranges, cautions and planning aids; they never become silent facts or autonomous decisions. Every output exposes its method, inputs, confidence and limitations and links back to the operational workflow where an authorized person remains responsible.

## Completed capabilities

1. **Fourteen-day revenue and order forecast:** a recency-weighted forecast uses the selected 7-, 30- or 90-day history, observed volatility and weekday adjustment. The UI shows expected, conservative and upper planning ranges rather than false precision.
2. **Exception Radar:** revenue pattern changes, cash-custody exceptions, area delivery risk and inventory pressure become explainable anomalies with observed/expected values and a drill-through target.
3. **Forecast-aware restocking:** each recommendation combines forecast demand, available units, safety units, supplier lead time and unit cost. The owner sees required cash before approving any supplier action.
4. **Lebanese area delivery risk:** Masaar estimates caution by area from delivery success, failures and sample size. It recommends stronger address/availability confirmation where evidence supports it.
5. **Customer Reliability Indicator:** the private indicator uses completed, cancelled and failed-delivery history. It can suggest normal handling, caution or extra confirmation, but never blocks an order, shares data across businesses or creates a blacklist.
6. **Founder Scenario Lab:** owners can explore sales change, monthly fixed costs and marketing assumptions. Masaar recalculates projected revenue, gross profit, operating result and break-even order volume without rewriting accounting records.
7. **Masaar Assistant:** the assistant answers questions about forecasts, stock, cash, deliveries and customers from the tenant's own Masaar data. It returns cited facts, an operational action and an explicit caveat.
8. **Governance cards:** the product states that forecasts are not promises, no recommendation acts autonomously, reliability is not a blacklist and cross-business data is never used.

## Assistant boundary

The current assistant mode is `GROUNDED_RULE_ENGINE`. This is intentional for feasibility, competition reliability and privacy: it creates useful natural-language answers from governed formulas without requiring an external AI provider, sending business data outside Masaar or risking hallucinated financial advice. A future AWS Bedrock integration may add broader natural-language understanding, but the same evidence, permission and audit contract must remain mandatory.

## Roles

- **Owner and Manager:** access forecasts, scenario planning, assistant questions and operational drill-through actions.
- **Read-only Analyst:** sees the complete predictive workspace but destination modules preserve read-only permissions.
- **Employee and Driver:** do not receive company-wide forecasts, customer reliability indicators or founder planning assumptions.

## Technical implementation

- Shared Zod contracts define forecasts, anomalies, restock predictions, delivery risks, reliability indicators and assistant responses.
- Fastify aggregates tenant-scoped Phase 7 intelligence and Phase 6 operational data.
- Forecasts use deterministic recency weighting, volatility ranges and weekday factors so results remain reproducible and testable.
- React, Tailwind and Recharts deliver a separately loaded `Forecast & AI` workspace, keeping the normal application bundle focused.
- Both predictive endpoints require `analytics:read`.

## Honest production boundary

Forecast quality depends on clean, sufficiently long business history. Masaar labels Low, Medium or High confidence and disables the claim of readiness when evidence is insufficient. Before adding an external generative model, production requires tenant-isolated retrieval, prompt-injection controls, response citations, cost limits, audit logging and an explicit rule that the model cannot mutate orders, prices, stock, customer indicators, payments or reconciliation.
