# Phase 5 — Delivery, Mixed Payments, Cash Custody and Offline Work

Phase 5 controls the Lebanese last mile and the money handoff that follows it. Ready orders can be assigned to an internal driver, freelancer or delivery company with a priced delivery zone. Each assignment creates an explicit attempt; failure requires a standardized reason, and retrying creates another attempt instead of erasing the first.

## Implemented workflows

- Dispatch console for ready and failed orders, active delivery resources, Lebanese fee zones, collection amounts, courier costs and retry attempts.
- Driver workspace with address, call/map actions, amount still due, Out for Delivery, Delivered and Failed controls.
- Offline driver outbox with unique command IDs. Queued actions are replayed in order and an identical command is accepted only once.
- Independent payment ledger for Cash, Whish, OMT, Card, Bank and Other, including partial payments, failed records, refunds, references and optional proof URLs.
- Append-only cash custody movements identifying who holds each currency after collection and after a handover.
- Reconciliation engine comparing expected versus returned cash by holder and currency. Shortage/overage explanations are mandatory and approval is restricted to owners/managers.
- Daily close with delivered value, collections by method, outstanding payment count, cash positions, refunds and open discrepancies.
- SQL Server tables, constraints and indexes for deliveries, payment entries, custody movements, reconciliations and idempotent driver commands, with in-memory demo data for local competition demos.

## Operational rules

1. `Delivered` never means `Paid`. A driver may deliver with no payment or a partial payment, and the payment projection remains pending or partial.
2. A posted cash collection must have a holder. Electronic collections do not create physical cash custody.
3. Failed delivery attempts require a reason. Reassignment creates a new attempt number and retains the earlier evidence.
4. Cash does not leave a holder merely because a count was submitted. An owner or manager must approve the handover before custody moves to Business cash.
5. Every offline driver command carries a stable command ID, preventing reconnection from duplicating a status change or cash collection.

## Role behavior

- **Owner/Manager:** full dispatch and payment visibility, daily close, cash custody and reconciliation approval.
- **Employee:** assign deliveries, post real payments and submit cash counts, but cannot approve a discrepancy or cash handover.
- **Driver:** sees only assigned active stops and their own wallet; can update delivery attempts and record collection at delivery.
- **Read-only:** can inspect operational and money truth without mutation.

## Local demo

Run `pnpm dev`, open `http://localhost:5173`, and sign in with the shared demo password `Masaar-Demo1!`.

- Joe: `joe@masaar.demo`
- Rami: `employee@masaar.demo`
- Karim: `driver@masaar.demo`

For the offline proof, sign in as Karim, choose **Connected** to enter Offline demo mode, mark a stop Out for Delivery, then complete it with a Cash or Whish amount. Return to Connected and press Sync; the two commands are sent in order and the wallet/payment state updates once.
