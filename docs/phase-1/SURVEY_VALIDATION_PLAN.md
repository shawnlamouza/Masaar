# Survey and Pilot Validation Plan

## Evidence status

The attached `Masaar Survey.pdf` is a strong questionnaire but contains no completed responses. It defines what to measure; it does not yet prove demand or rank features.

## Hypothesis map

| Survey topic                                     | Product hypothesis                                                                        | Evidence needed                                         | Product consequence                                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Business type/model/channel/volume               | Social and mixed-channel product businesses are the best initial niche.                   | Counts by segment and order band; follow-up interviews. | Select pilot cohort and representative seed data.                                      |
| Information stored in sheets/chats/paper         | Fragmentation causes duplicate entry and unclear responsibility.                          | Frequency, examples, time/error cost.                   | Prioritize confirmation, lifecycle, search, and audit.                                 |
| Hardest metric / product profit / channel profit | Owners cannot calculate margin and channel contribution reliably.                         | Distribution plus walkthrough of current calculation.   | Validate Profit Leak Explorer and channel attribution.                                 |
| Unexpected profit change                         | Supplier, FX, delivery, discount, or unknown cause drives margin surprise.                | Ranked answers and real recent incident.                | Configure Margin Guard causes and Morning Brief rules.                                 |
| Noticed too late                                 | Low/dead stock, margin, money mismatch, or falling activity needs early warning.          | Frequency, estimated loss, desired warning time.        | Rank Action Center rules.                                                              |
| First money/stock/performance/customer tool      | The named hero tools match immediate willingness to use.                                  | First-choice shares by segment.                         | Adjust P0/P1 backlog without adding scope.                                             |
| Lebanon cost issues                              | Currency/supplier, payments, delivery areas, banking, and outages require local behavior. | Issue ranking plus operational examples.                | Validate explicit currencies, mixed methods, area analytics, and offline driver scope. |
| Payments accepted                                | Cash, Whish, OMT, card, and bank need one entry model.                                    | Method mix and proof/reconciliation practice.           | Configure MVP method defaults and proof requirements.                                  |
| Internet/electricity interruption                | Delivery work must continue through short outages.                                        | Current fallback, outage frequency, data loss examples. | Validate bounded driver offline queue.                                                 |
| Multiple locations                               | Transfers may prevent unnecessary reorder.                                                | Multi-location share and concrete waste.                | Keep transfer suggestions in V2 unless cohort demands MVP.                             |
| Anonymous benchmarks / reliability               | Users may value comparative/reliability data but trust and privacy vary.                  | Consent and trust answers; legal/governance review.     | Do not include cross-business data in MVP.                                             |
| Delivery/payment unresolved                      | Delivery and payment must be separate.                                                    | Frequency and reconciliation examples.                  | Keep payment/custody/reconciliation P0.                                                |
| Open questions                                   | Existing software misses Lebanon-specific realities not in fixed options.                 | Thematic coding of free text.                           | Discover unknown needs without forcing scope.                                          |

## Analysis method

1. Remove duplicates/test submissions and document the retained sample size.
2. Segment results by industry, business model, channel, monthly volume, delivery use, and location count.
3. Report counts and percentages; never present a small convenience sample as representative of all Lebanese businesses.
4. Cross-tab first-choice tools against operating characteristics, especially delivery use and stock sensitivity.
5. Code open responses into themes with representative paraphrases and two reviewers for ambiguous categories.
6. Select 5-8 follow-up interviews covering different segments and ask respondents to demonstrate a recent real incident.
7. Convert evidence into backlog swaps: promote one item only by demoting another item of similar effort.

## Pilot tasks and measures

| Task                           | Measure                                       | Initial target                         |
| ------------------------------ | --------------------------------------------- | -------------------------------------- |
| Create existing-customer order | Median completion time and corrections        | <= 60 seconds; <= 1 correction         |
| Confirm address from phone     | Completion and manual-copy count              | >= 90%; zero retyping after submit     |
| Resolve failed delivery        | Time to identify cause/owner/next action      | <= 30 seconds                          |
| Reconcile driver               | Spreadsheet use and unresolved difference     | No spreadsheet; difference explained   |
| Respond to cost increase       | Correct products identified and decision time | All affected products; <= 3 minutes    |
| Use Morning Brief              | Correct interpretation and chosen action      | 4/5 users identify evidence and action |
| Work during outage simulation  | Lost/duplicate driver updates                 | Zero lost/duplicate commands           |

## Decision gate

The survey and interviews may refine wording, thresholds, and P0/P1 choices. They may not silently expand Masaar into accounting, government filing, a marketplace, or autonomous AI.
