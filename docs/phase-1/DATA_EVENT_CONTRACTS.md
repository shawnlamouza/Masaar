# Data and Event Contracts

## Core entity boundaries

| Module       | Owned records                                            | Required integrity                                        |
| ------------ | -------------------------------------------------------- | --------------------------------------------------------- |
| Tenancy      | business, membership, role, settings                     | Tenant context required; owner cannot remove final owner. |
| Catalog      | category, product, variant, supplier, price/cost history | SKU unique per tenant; currency explicit.                 |
| Customer     | customer, address, consent/contact preferences           | Normalized phone candidate; merges reviewed and audited.  |
| Order        | order, line snapshots, status timeline, notes/tags       | Server-calculated totals; versioned legal transitions.    |
| Delivery     | provider, driver, zone, assignment, manifest, attempt    | Attempt history immutable; assignment auditable.          |
| Payment      | payment/refund entry, proof reference                    | Amount/currency/method/status explicit; idempotent.       |
| Custody      | custody movement, reconciliation batch/item              | Append-only; current holder derived; approval thresholds. |
| Inventory    | location, movement, reservation, stock projection        | Variant/location scoped; last-unit concurrency protected. |
| Intelligence | metric snapshot, action item, rule definition            | Rule/formula version, freshness, sources, currency.       |
| Audit        | audit event                                              | Append-only actor/action/before/after/reason/correlation. |

## Standard event envelope

```json
{
  "eventId": "evt_...",
  "eventType": "order.customer_confirmed.v1",
  "occurredAt": "2026-08-22T10:00:00Z",
  "tenantId": "tenant_demo",
  "actor": { "type": "user|customer_link|system", "id": "..." },
  "entity": { "type": "order", "id": "ord_...", "version": 3 },
  "correlationId": "cor_...",
  "causationId": "cmd_...",
  "data": {},
  "privacy": { "containsPii": false }
}
```

## MVP event catalog

### Catalog and commercial

- `product.created.v1`
- `product.price_changed.v1`
- `product.cost_changed.v1`
- `supplier.lead_time_changed.v1`
- `customer.created.v1`
- `customer.address_confirmed.v1`

### Order operations

- `order.created.v1`
- `order.confirmation_sent.v1`
- `order.customer_confirmed.v1`
- `order.status_changed.v1`
- `order.cancelled.v1`
- `order.return_opened.v1`

### Delivery

- `delivery.assigned.v1`
- `delivery.attempt_started.v1`
- `delivery.attempt_succeeded.v1`
- `delivery.attempt_failed.v1`
- `delivery.reassigned.v1`

### Payment and custody

- `payment.recorded.v1`
- `payment.failed.v1`
- `refund.recorded.v1`
- `cash.collected.v1`
- `cash.handover_accepted.v1`
- `reconciliation.submitted.v1`
- `reconciliation.discrepancy_detected.v1`
- `reconciliation.closed.v1`

### Inventory and intelligence

- `inventory.movement_recorded.v1`
- `inventory.reservation_created.v1`
- `inventory.reservation_released.v1`
- `metric.snapshot_completed.v1`
- `action_item.opened.v1`
- `action_item.resolved.v1`

## Event data rule

Events contain identifiers, snapshots required for the business fact, and non-sensitive analytical dimensions. Phone numbers, full addresses, payment proofs, and free-form notes remain in access-controlled source records unless an event consumer has a documented need.
