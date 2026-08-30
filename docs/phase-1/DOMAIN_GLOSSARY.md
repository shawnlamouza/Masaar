# Domain Glossary

| Term                           | Canonical definition                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Business / tenant              | One isolated Masaar customer organization. Every owned record includes `tenantId`.                                        |
| Order                          | The commercial intent containing customer, lines, price snapshots, fees, discounts, currency, and totals.                 |
| Order status                   | Preparation/fulfillment progress; never a synonym for payment status.                                                     |
| Delivery                       | Assignment and fulfillment container linked to an order.                                                                  |
| Delivery attempt               | One immutable try to deliver, with outcome, reason, time, actor, and optional proof.                                      |
| Payment entry                  | One recorded monetary event, not a mutable total field.                                                                   |
| Amount due                     | Order total minus valid paid entries and refunds, calculated per currency.                                                |
| Cash custody                   | Explicit record of who currently possesses collected business cash.                                                       |
| Handover                       | Transfer of custody from one person to another, usually driver to owner/employee.                                         |
| Reconciliation batch           | Comparison of expected collections with amounts actually returned for a person, period, and currency.                     |
| Discrepancy                    | Expected amount minus accepted returned amount; positive is shortage and negative is overage.                             |
| Inventory movement             | Append-only stock event such as receipt, reservation, sale, return, damage, or adjustment.                                |
| On hand                        | Physical quantity recorded before subtracting active reservations.                                                        |
| Reserved                       | Quantity committed to qualifying open orders.                                                                             |
| Available                      | `onHand - reserved`; cannot silently mix locations or variants.                                                           |
| Stock cover                    | Estimated days the available stock will last at the selected sales velocity.                                              |
| Dead stock                     | Stock with no qualifying sale for the business-configured number of days.                                                 |
| Supplier lead time             | Expected days between approved reorder and usable receipt.                                                                |
| Selling-price snapshot         | Price and currency copied onto an order line so history cannot be rewritten.                                              |
| Cost snapshot                  | Known direct product cost and currency copied onto an order line.                                                         |
| FX reference snapshot          | Owner-approved reference rate used for a comparison or conversion; not an automatically authoritative market rate.        |
| Revenue                        | Value recognized under the metric dictionary; not cash collected and not profit.                                          |
| Gross margin                   | Revenue minus direct product cost.                                                                                        |
| Contribution margin            | Gross margin minus known variable costs such as delivery subsidy, payment fee, packaging, or attributed acquisition cost. |
| Net profit                     | Not an MVP metric unless all operating costs are captured; Masaar must not label contribution margin as net profit.       |
| Channel                        | The origin of demand, such as Instagram, WhatsApp, TikTok, Facebook, phone, store, website, or Masaar Order Link.         |
| Action Center item             | Rule-generated operational task tied to source records and a resolution condition.                                        |
| Morning Brief card             | Ranked owner-facing explanation of change, impact, evidence, confidence, and proposed action.                             |
| Customer reliability indicator | Neutral caution based only on explainable history; never a blacklist or automatic refusal.                                |
| Audit event                    | Immutable record of actor, action, entity, timestamp, previous/new values, reason, and correlation ID.                    |
