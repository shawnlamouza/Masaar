# Phase 3 Data and Integrity Rules

## Money

Every amount contains both an integer storage value and `USD` or `LBP`. USD uses cents; LBP uses whole pounds. No route accepts a floating storage amount, an unapproved currency or a currency inferred from the business default.

An FX snapshot states how many LBP equal one USD, its effective time, owner note and recorder. Existing costs, prices and future orders reference the snapshot used at the time; a later FX reference never rewrites earlier economics.

## Catalog

A product must have at least one valid variant. SKUs use uppercase letters, numbers, `_` or `-` and are unique within the tenant. Each variant has current selling price and cost plus at least one historical snapshot of each. Controlled changes append history rather than replacing it.

Stock is optional. If tracking is enabled, a negative value is invalid. Phase 3 stores the opening/current quantity for catalog context; append-only inventory movements begin in the inventory phase.

## Lebanese phones

Masaar removes spaces and punctuation, recognizes `00961`, `+961`, `961` and common local leading-zero forms, then stores `+961` plus seven or eight national digits. Customer creation rejects an existing canonical number. Duplicate review also checks the final six digits as a cautious possible-match signal, but never merges records automatically.

## Addresses

The structured address captures governorate, area, locality, street, building, floor, landmark and optional map URL. `originalWording` is mandatory so employees and drivers can compare the cleaned address with what the customer actually sent. Standardization never discards the source wording.

## Tenant and audit requirements

Every commerce query contains tenant context. SQL Server unique indexes combine tenant ownership with entity, SKU or phone identity where appropriate. Catalog, customer, supplier, FX, supplier-cost and selling-price changes append actor/correlation audit evidence. Cross-tenant and forbidden-role tests remain release blockers.
