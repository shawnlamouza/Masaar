# MVP Metric Dictionary

## Global rules

1. Every metric is tenant-scoped and displays its data-freshness timestamp.
2. USD and LBP are reported separately by default. A combined view requires an explicit owner-approved FX reference and labels the converted result.
3. Historical values use order/payment/cost snapshots; current catalog values never rewrite history.
4. Cancelled test orders and deleted seed records are excluded by documented flags, not by hidden query logic.
5. Every dashboard result must drill through to its source records.
6. Missing cost data must produce `unknown/incomplete margin`, not a zero cost.

| Metric                          | MVP formula                                                                                                                              | Time basis / source                                     | Required warning                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| Recognized revenue              | Sum of order-line net value plus retained delivery revenue for orders meeting the configured recognition event, less recognized refunds. | Recognition-event date; order snapshots and refunds.    | Label recognition policy.                             |
| Collected amount                | Sum of successful payment entries.                                                                                                       | Payment-entry date.                                     | Never infer from Delivered.                           |
| Outstanding amount              | Order total - successful payments + valid reversals/refunds owed.                                                                        | Current balance by order/currency.                      | Exclude disputed amounts only through explicit state. |
| Gross margin                    | Recognized revenue - direct cost of recognized units.                                                                                    | Order cost snapshots.                                   | Incomplete when any material cost is missing.         |
| Contribution margin             | Gross margin - known variable delivery, transaction, packaging, and attributed acquisition costs.                                        | Snapshot/allocated costs.                               | Display included/excluded cost categories.            |
| Average order value             | Recognized revenue / count of recognized orders.                                                                                         | Selected period.                                        | Do not mix currencies implicitly.                     |
| Payment completion rate         | Orders with zero valid amount due / orders expected to be paid.                                                                          | Selected cohort/period.                                 | Separate prepaid, partial, failed, and refunded.      |
| Delivery success rate           | Successful final deliveries / delivery cases attempted.                                                                                  | First-attempt cohort and final outcome views.           | Show attempt count and failed-reason mix.             |
| First-attempt success           | Deliveries successful on attempt 1 / deliveries with attempt 1.                                                                          | Attempt date.                                           | Separate from eventual success.                       |
| Reconciliation discrepancy rate | Absolute unresolved discrepancy / expected collection amount.                                                                            | Batch close date and current open view.                 | Show by holder and currency.                          |
| Cash held                       | Sum of open cash-custody balances by current holder and currency.                                                                        | Current ledger projection.                              | Alert after configurable age/shift close.             |
| Inventory turnover              | Recognized direct cost of goods / average inventory cost for the period.                                                                 | Movement/cost snapshots.                                | Mark unavailable when cost coverage is insufficient.  |
| Stock cover days                | Available quantity / trailing average daily sold quantity.                                                                               | Current stock plus selected 7/30/90-day velocity.       | Show chosen velocity window and zero-sales behavior.  |
| Dead-stock value                | On-hand quantity x latest approved cost for variants with no qualifying sale inside threshold.                                           | Current snapshot.                                       | Clearly label estimated value.                        |
| Restock suggestion              | `max(0, avgDailySales x leadTime + safetyStock - available - inboundConfirmed)`.                                                         | Current inventory and configurable velocity.            | Show every input and require owner approval.          |
| Repeat-customer rate            | Customers with 2+ recognized orders in cohort / customers with recognized orders.                                                        | Customer/order cohort.                                  | Deduplicate by reviewed customer identity.            |
| Lapsed regular customers        | Previously repeat customers with no recognized order after their expected reorder interval plus tolerance.                               | Customer history.                                       | Treat as suggestion, not proof of churn.              |
| Channel contribution            | Contribution margin attributed to each source channel.                                                                                   | Order source and cost attribution.                      | Unknown when channel or cost is missing.              |
| Area contribution               | Contribution margin grouped by confirmed delivery area.                                                                                  | Address snapshot, delivery fees/costs, order economics. | Preserve small-sample count and failure rate.         |

## Morning Brief ranking

Each candidate card receives transparent components rather than an opaque AI score:

- urgency: deadline/age and operational blocking;
- money at risk: explicit amount or estimated range;
- scope: number of affected orders/products/customers;
- confidence: complete, partial, or insufficient evidence;
- actionability: whether Masaar can link a safe next action.

The MVP sorts by a documented weighted rule configured centrally. The UI shows the underlying reason and never presents the score itself as business truth.
