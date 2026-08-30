# Phase 3 Demonstration Runbook

1. Start Masaar with `pnpm dev` and open `http://localhost:5173`.
2. Open **Catalog** and show Linen Shirt variants, USD selling price/cost history, supplier and low-stock size M.
3. Open **Customers**, check `70 123 456`, and show that Masaar resolves it to the existing `+96170123456` profile before a duplicate is created.
4. Inspect Maya's standardized Achrafieh address, landmark and preserved original wording.
5. Open **Suppliers** and explain Cedar Textiles' six-day lead time, 12-unit minimum and linked variants.
6. Open **Price Studio**, select Cedar Textiles, enter a new unit cost of `$23.00`, target margin `40%`, then choose **Record cost & preview impact**.
7. Show that both variants' margin falls while their customer prices remain `$35.00`.
8. Select only one recommendation and approve it. Reopen Catalog: both variants have the new cost snapshot, only the selected variant has a second price snapshot.
9. Change the preview role to Employee or Read-only and show that price-changing controls are blocked.

Restarting the local API returns the in-memory demonstration tenant to its opening seed. SQL Server-backed environments persist changes normally.
