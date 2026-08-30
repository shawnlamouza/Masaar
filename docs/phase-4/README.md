# Phase 4 — Orders, Customer Links and Employee Operations

## Outcome

Phase 4 turns an Instagram, WhatsApp, Facebook, TikTok, phone, store or website sale into one controlled Masaar order. The employee captures the products once, Masaar calculates the commercial totals from catalog snapshots, the customer confirms a structured Lebanese delivery address through an expiring no-account link, and the team moves the order across a visible operating board.

## Functional scope delivered

- Role-resolved local sign-in with Joe as the owner demo and separate owner, manager, employee, driver and analyst identities.
- Quick Order with source channel, catalog variants, quantity, fixed discount, delivery fee, prepaid amount, Cash/Whish preference, internal note and server-authoritative totals.
- Mixed-currency protection, unavailable/insufficient-stock validation, normalized Lebanese phone numbers and possible-duplicate warnings with an explicit override reason.
- Secure 256-bit confirmation tokens whose hashes—not raw tokens—are stored; links expire after seven days and can be rotated by copying a new confirmation/reminder template.
- No-account customer page for governorate, area, locality, street, building, floor, landmark, Google Maps link and delivery notes.
- Automatic transition from Pending Customer Confirmation to Confirmed and automatic creation/reuse of the matching customer profile.
- Controlled order lifecycle from customer confirmation through preparation, packing, dispatch, delivery, failure, cancellation, return and refund.
- Employee Kanban with global order search, selection, legal bulk advancement, order detail, internal notes, tags in the domain model and a complete actor/time/status timeline.
- WhatsApp confirmation, reminder and status templates with copy history; Masaar does not claim that a message was sent.
- Responsive Masaar visual system using the supplied logo/posters, Manrope, Space Grotesk, Tailwind, technical lighting and accessible reduced-motion behavior.

## Demo credentials

All demo accounts use `masaar-demo`:

- Owner: `joe@masaar.demo`
- Manager: `manager@masaar.demo`
- Employee: `employee@masaar.demo`
- Driver: `driver@masaar.demo`
- Analyst: `analyst@masaar.demo`

These credentials exist only when `AUTH_MODE=dev`. Production keeps the existing Cognito verification path.

## Deliberate boundaries

Phase 4 prepares `READY_FOR_DISPATCH` as the clean handoff to Phase 5. It defines the complete status vocabulary but does not pretend that driver assignment, delivery attempts, payment settlement or cash reconciliation are complete. Official WhatsApp sending is also deferred; this phase supplies copyable templates and an honest copy audit.

## Evidence

- Workspace production build passes.
- 24 automated tests pass across contracts, API and web.
- Browser verification covers Joe sign-in, the owner dashboard, Kanban rendering, Quick Order creation, copied secure link, customer confirmation, responsive mobile rendering and the confirmed order returning to operations.
- Browser console verification reports no errors or warnings in the tested owner and customer journeys.
