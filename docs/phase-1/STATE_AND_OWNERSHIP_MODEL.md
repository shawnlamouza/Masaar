# State and Ownership Model

## Order lifecycle

| Status                        | Accountable role              | Allowed next states                             | Required evidence / rule                                            |
| ----------------------------- | ----------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| Pending Customer Confirmation | Employee                      | Confirmed, Cancelled                            | Signed link or authorized manual confirmation; cancellation reason. |
| Confirmed                     | Employee                      | Preparing, Cancelled                            | Valid customer/address snapshot and sellable lines.                 |
| Preparing                     | Employee                      | Packed, Cancelled                               | Assignee and start audit event.                                     |
| Packed                        | Employee / Manager            | Ready for Dispatch, Preparing                   | Packed confirmation; reopening requires reason.                     |
| Ready for Dispatch            | Dispatcher / Manager          | Assigned to Delivery, Cancelled                 | Complete address and amount-to-collect.                             |
| Assigned to Delivery          | Dispatcher                    | Out for Delivery, Ready for Dispatch, Cancelled | Active driver/company assignment.                                   |
| Out for Delivery              | Driver                        | Delivered, Failed                               | Delivery attempt must be created.                                   |
| Delivered                     | Driver                        | Returned, Refunded                              | Successful attempt evidence; payment remains independent.           |
| Failed                        | Driver / Dispatcher           | Assigned to Delivery, Cancelled, Returned       | Failed reason and attempt notes; retry creates a new attempt.       |
| Cancelled                     | Authorized Employee / Manager | None in MVP                                     | Reason; stock reservation released; payment handled separately.     |
| Returned                      | Manager / Employee            | Refunded                                        | Return case and explicit stock disposition.                         |
| Refunded                      | Owner / Manager               | None                                            | Approved refund entries; never automatically implies restock.       |

Illegal jumps are rejected by the API. Repeated or concurrent commands use an idempotency key and expected entity version.

## Delivery case and attempts

- Delivery case: `Unassigned -> Assigned -> In Progress -> Completed | Failed | Cancelled`.
- Each attempt: `Scheduled -> Out for Delivery -> Delivered | Failed`.
- A failed attempt is immutable. A retry creates a new attempt number.
- Reassignment preserves the previous assignment history.
- Required failed reasons: unreachable, customer unavailable, refused, incorrect/incomplete address, access/weather issue, damaged parcel, driver/courier issue, other with note.

## Payment state

Payment is a projection from append-only entries:

- Pending: no successful payment covers the total.
- Partially Paid: successful payments are greater than zero and less than amount due.
- Paid: valid successful payments cover the payable balance.
- Failed: latest attempted payment failed and a balance remains.
- Partially Refunded: valid refund is greater than zero and less than paid amount.
- Refunded: valid refunds equal the refundable paid amount.

Only Owner/Manager may approve refunds above the configured threshold. Proof/reference requirements are method-configurable.

## Cash custody and reconciliation

Custody movement types: driver collection, handover initiated, handover accepted, deposit, approved adjustment, refund payout.

Reconciliation batch states:

`Draft -> Submitted -> Matched | Discrepancy Review -> Approved -> Closed`

- Driver/collector submits actual returned totals by currency.
- System calculates expected totals from custody/payment events.
- Any discrepancy above tolerance requires reason and evidence.
- Only Owner/Manager approves a discrepancy or adjustment.
- Closed batches are immutable; correction uses a linked adjustment batch.

## Inventory rules

Movement types: opening, receipt, reservation, reservation release, sale, customer return, supplier return, exchange in, exchange out, damage, loss, transfer, adjustment.

- Movements are append-only and idempotent.
- `available = onHand - activeReservations` by tenant, location, product variant.
- Reservation milestone is a business setting; recommended MVP default is Confirmed.
- Sale finalization milestone is configurable; recommended default is Delivered.
- Negative available stock is denied unless the owner explicitly enables overselling.
- Manual adjustment requires reason; material adjustments require Owner/Manager approval.

## Action Center lifecycle

`Open -> Acknowledged | Snoozed -> Resolved | Dismissed`

Every action item stores its rule version, source records, first/last detected time, severity, monetary exposure when known, and resolution condition. Resolution occurs automatically when the source condition is fixed; dismissal requires a reason and never deletes evidence.
