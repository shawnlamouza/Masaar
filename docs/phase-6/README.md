# Phase 6 — Inventory Movements, Returns and Exchanges

Phase 6 turns the catalog's opening quantities into an accountable inventory system. Stock is no longer treated as one editable number: Masaar derives physical on-hand, active reservations and safe-to-sell availability from append-only movements connected to orders, supplier receipts, approved corrections and inspected returns.

## Completed operating loop

1. A tracked product creates one opening movement from its catalog quantity.
2. Customer confirmation reserves the exact variants and rejects confirmation when the remaining availability is insufficient.
3. Cancellation releases that order's reservation.
4. Delivery finalizes the sale, decreases on-hand and consumes the reservation.
5. Supplier receipts increase on-hand with a date, reference, supplier check and audit record.
6. Physical corrections require an Owner or Manager and a reason; the old ledger is never rewritten.
7. A return starts from the original delivered/failed order and cannot exceed the quantity bought or already returned.
8. The employee receives and inspects the item before choosing Restock, Quarantine, Damaged Write-off or Return to Supplier.
9. An Owner or Manager resolves the financial effect. Refunds become payment entries; cash refunds become custody movements.
10. An exchange creates a linked confirmed replacement order, reserves its replacement stock and follows the normal preparation and delivery workflow.

## Role experience

- **Employee:** reads on-hand/reserved/available, records supplier receipts, opens return/exchange cases and receives/inspects returned items.
- **Owner / Manager:** receives stock and performs employee actions, approves reasoned physical corrections, refunds and replacement orders.
- **Read-only analyst:** sees stock, movements, supplier exposure and return history without mutation controls.
- **Driver:** has no inventory screens; delivery actions update inventory automatically when appropriate.

## Visual completion and interaction hierarchy

Phase 6 also establishes a consistent visual hierarchy across the operating workspace. Dark command stages identify the current decision, raised metric cards surface the numbers that require attention, and quieter tables and timelines hold supporting evidence below them. Interactive surfaces visibly lift on hover, depress on activation and retain keyboard focus rings, while non-interactive information stays visually still; this makes it immediately clear what can be acted on without adding instructional clutter.

The gold Quick Order action is the single primary shortcut in the Orders command stage. Its gradient, border and shadow remain stable across hover and touch states, avoiding the previous pale flash while preserving a clear pressed response. Stock Control and Returns use the same hierarchy so owners can move from warning, to decision, to audit trail without searching through equally weighted panels.

## Stock & Supplier Radar

The radar intentionally remains explainable and feasible. For each variant it combines:

- sellable availability (`on hand - active reservations`);
- units sold during the previous 30 days;
- estimated stock-cover days;
- supplier lead time and minimum order quantity;
- current recorded unit cost;
- an editable suggested restock quantity and cash requirement.

The suggestion never creates a purchase or changes stock. Its purpose is to help a Lebanese owner avoid both an unexpected stockout and excessive cash trapped in inventory while supplier prices and lead times remain volatile.

## Persistence and integrity

- Inventory movements and return cases are tenant-scoped and stored in SQL Server when configured.
- Movement idempotency keys prevent a repeated order/delivery command from applying the same stock effect twice.
- SQL Server indexes and unique keys protect movement keys, return identifiers and common variant/order queries.
- The local demonstration uses the same contracts and workflows through in-memory repositories; restarting an unconfigured local API resets local demonstration activity.

## Honest production boundary

The current implementation prevents double application and competing final-unit confirmation inside the running Masaar service. Before multi-instance AWS production, SQL Server inventory updates must run within an explicit transaction using row-version or locking guarantees for cross-instance reservation atomicity, and that behavior must pass a deliberate concurrent staging test. This is an infrastructure release gate—not a reason to expose a confusing workaround to users.
