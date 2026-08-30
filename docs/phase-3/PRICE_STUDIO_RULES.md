# Price Studio Functional Rules

## Why this exists

Lebanese businesses frequently buy in USD, sell in USD or LBP and receive supplier changes without a formal pricing process. Automatically changing customer prices would be dangerous; ignoring the change hides shrinking or negative margins. Price Studio separates recording facts from making a selling decision.

## Workflow

1. An Owner or Manager records an operating USD/LBP reference. Masaar creates an immutable snapshot and does not claim it is an official or live market rate.
2. The user selects a supplier, records its newly confirmed unit cost, effective time and reason, and chooses a target margin.
3. Masaar updates the affected variants' current supplier cost and appends their cost histories. Their selling prices do not change.
4. For each affected variant, Masaar converts cost and selling price using the selected FX snapshot, shows old and new gross margin, and calculates a recommended price in the existing selling currency.
5. The owner selects zero, some or all recommendations. Only selected prices are applied and appended to price history.
6. The review becomes `PARTIALLY_APPROVED` or `APPROVED`; unselected recommendations remain visible and current customer prices remain unchanged.

## Formula

`gross margin = (selling price in USD - unit cost in USD) / selling price in USD`

`recommended USD price = unit cost in USD / (1 - target margin)`

USD recommendations round up to cents. LBP recommendations round upward to a practical 10,000 or 50,000 LBP step depending on amount. The rule is deterministic and explainable, not predictive AI.

## Permissions

Owners and Managers may record FX/cost facts and approve recommendations. Employees and Read-only users may inspect the workspace but cannot change these values. Drivers have no access.
