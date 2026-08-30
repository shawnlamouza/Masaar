# Phase 6 Exit Gate

| Acceptance condition | Result | Evidence |
| --- | --- | --- |
| Stock is derived from append-only movements | Pass | Opening, receipt, reservation, release, sale, return and adjustment ledger |
| Confirmed orders reserve exact variants | Pass | Order/customer-confirmation integration and final-unit API test |
| Cancellation releases reserved units | Pass | Lifecycle integration and reservation-release test |
| Delivery finalizes stock exactly once | Pass | Driver command idempotency plus sale movement key |
| Employees can receive supplier stock | Pass | Role-scoped receipt API and Stock Control form |
| Corrections require accountable approval | Pass | Owner/Manager API guard, reason and before/after audit event |
| Returns begin from the original order | Pass | Quantity validation against order lines and earlier active cases |
| Returned stock requires inspection | Pass | Condition and Restock/Quarantine/Damage/Supplier disposition workflow |
| Refunds remain separate financial events | Pass | Return resolution creates payment and cash-custody entries |
| Exchanges reuse normal operations | Pass | Linked confirmed replacement order with immediate stock reservation |
| Supplier decision support remains explainable | Pass | 30-day sales, cover, lead time, MOQ, cost and editable restock suggestion |
| Role-focused web experience passes | Pass | Employee and Owner browser walkthrough plus 5 web tests |
| Automated checks pass | Pass | 22 API tests, 6 contract tests and 5 web tests |

**Passed locally on 24 August 2026.** The remaining external gate is distributed SQL Server reservation atomicity under the final AWS topology; it must be proven in staging before a production claim.
