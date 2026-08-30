# Phase 3 - Lebanese Commerce Foundations

## Outcome

Phase 3 gives Masaar trustworthy structured inputs for every later order, stock and business-intelligence calculation. It replaces product descriptions, customer addresses, supplier facts and price decisions scattered across chats or memory with tenant-safe records that preserve their economic history.

## Delivered tools

### Catalog

- products with category, availability and optional stock tracking;
- one or more variants with size, color and strictly validated unique SKU;
- explicit USD or LBP selling price and unit cost;
- supplier association and append-only price/cost histories;
- low-stock and gross-margin context using a locked FX snapshot.

### Customers and Lebanese addresses

- Lebanese phone normalization into canonical `+961` form;
- pre-creation duplicate review and exact-duplicate prevention;
- preferred Cash, Whish, OMT, Card, Bank or Other payment method;
- structured governorate, area, locality, street, building, floor, landmark and optional map link;
- preservation of the customer's original address wording;
- order-behavior placeholders consumed by Phase 4 rather than fabricated behavior.

### Suppliers

- supplier identity and contact;
- lead time, minimum order quantity and last confirmed purchase cost;
- visibility into linked catalog variants;
- lightweight inputs for the later Stock & Supplier Radar, without pretending to be procurement software.

### Currency and Price Studio

- immutable owner-entered USD/LBP reference snapshots;
- supplier-cost recording that appends cost history immediately;
- per-variant before/after gross-margin comparison;
- recommended selling price in the variant's existing currency;
- selective price approval: rejected or unselected customer prices remain unchanged;
- complete audit events for costs, FX references and selling-price approvals.

## Main routes

| Route                                          | Purpose                                      | Permission             |
| ---------------------------------------------- | -------------------------------------------- | ---------------------- |
| `GET /api/commerce/summary`                    | Counts, low stock, margin risk and latest FX | `catalog:read`         |
| `GET/POST /api/commerce/products`              | List or create structured catalog products   | `catalog:read/write`   |
| `GET/POST /api/commerce/customers`             | List or create normalized customer records   | `customers:read/write` |
| `GET /api/commerce/customers/duplicate-review` | Check local/canonical phone before creation  | `customers:read`       |
| `GET/POST /api/commerce/suppliers`             | List or create lightweight supplier records  | `suppliers:read/write` |
| `GET/POST /api/commerce/fx-snapshots`          | Read or record owner FX references           | `pricing:read/manage`  |
| `GET/POST /api/commerce/price-reviews`         | Read or record supplier-cost impact reviews  | `pricing:read/manage`  |
| `POST /api/commerce/price-reviews/:id/approve` | Approve selected recommended prices          | `pricing:manage`       |

## Deliberate limits

- There is no unofficial automatic exchange-rate scraping. The owner controls the reference and Masaar records exactly which snapshot was used.
- Supplier cost recording is not procurement, accounts payable or inventory receiving.
- Customer order statistics are not edited manually; Phase 4 will update them from real order events.
- Order creation remains Phase 4 so it can consume these validated products, customers, addresses and money contracts.

## Supporting documents

- [Data and integrity rules](DATA_AND_INTEGRITY_RULES.md)
- [Price Studio functional rules](PRICE_STUDIO_RULES.md)
- [Demonstration runbook](DEMO_RUNBOOK.md)
- [Phase 3 exit gate](PHASE_3_EXIT_GATE.md)
