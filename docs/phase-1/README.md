# Phase 1 - Product Contract, Metrics and Architecture

## Objective

Freeze Masaar's niche, MVP promise, business definitions, lifecycle rules, and technical direction before feature implementation begins.

## Phase outputs

| Artifact                                                  | Purpose                                                                                   |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Product contract](PRODUCT_CONTRACT.md)                   | Defines the target business, promise, boundary, users, golden path, and success measures. |
| [MVP backlog](MVP_BACKLOG.md)                             | Converts the product into prioritized, testable epics and stories.                        |
| [Domain glossary](DOMAIN_GLOSSARY.md)                     | Prevents the team from using conflicting operational and financial language.              |
| [Metric dictionary](METRIC_DICTIONARY.md)                 | Defines every MVP number, its formula, source, currency behavior, and limitations.        |
| [State and ownership model](STATE_AND_OWNERSHIP_MODEL.md) | Controls order, delivery, payment, reconciliation, inventory, and warning transitions.    |
| [Architecture decisions](ARCHITECTURE_DECISIONS.md)       | Records the chosen stack and major engineering constraints.                               |
| [Data and event contracts](DATA_EVENT_CONTRACTS.md)       | Establishes entity boundaries and analytics-ready domain events.                          |
| [Survey validation plan](SURVEY_VALIDATION_PLAN.md)       | Converts the attached survey questions into testable product hypotheses.                  |
| [Demo journeys](DEMO_JOURNEYS.md)                         | Defines the competition and acceptance-test stories.                                      |
| [Demo seed data](seed/phase-1-demo-data.json)             | Supplies realistic, anonymized Lebanese scenarios.                                        |
| [Exit gate](PHASE_1_EXIT_GATE.md)                         | Determines whether Phase 2 may begin.                                                     |

## Phase rule

Phase 1 produces decisions and contracts, not production features. Any prototype code created during this phase is disposable unless it conforms to the approved contracts.
