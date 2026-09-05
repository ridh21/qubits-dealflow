# Implementation verification ledger

The phase plans in the repository root `docs/plans` remain the acceptance criteria.
This ledger records evidence, not a declaration that every phase is complete.

## Verified on 2026-09-05

- Policy, quotation pricing/versioning, sequential approval, sidebar work: prior implementation commits and integration tests.
- Fulfillment integration: order idempotency, reservation/dispatch conservation, one shipment invoice, concurrent duplicate payment and overpayment rejection (1 real PostgreSQL test).
- Subscription integration: scheduled activation, exactly-once period invoicing, quantity proration, cancellation retry, boundary pause/resume and skipped periods (2 real PostgreSQL tests).
- Plan catalog/entitlements: draft separation, selective notices/recipients, unchanged current snapshots, stale/concurrent publication, missing recipient rollback, semantic definition validation, price copying, active-holder protection and additive seed (6 real PostgreSQL tests).
- Portal negotiation: cross-customer/obsolete acceptance rejection, concurrent confirmation creates one order, proposals do not edit terms, open proposal prevents acceptance, withdrawal allows acceptance (2 real PostgreSQL tests).
- Unit suite: 95 tests passed with Phase 10; six additional report KPI tests passed separately.
- Deal-health integration: concurrent scoped scans deduplicate, nudge audits, and meaningful activity auto-resolves (1 real PostgreSQL test).
- Phase 10 production build, typecheck and lint passed.
- Production build passed with all added portal routes. Browser verification remains outstanding for those routes.

Integration runs use the isolated `dealflow_test_20260905` schema. Never run test fixtures against the default application schema. Database credentials must not be printed or committed.

## Open acceptance work

- Finish the requirement-by-requirement audit of phases 03–09; broad phase completion is not yet proven.
- Quotation: live preview, complete filters/version diffs, customer switch UI, upsell dismissal persistence, edit lifecycle and duplicate-content browser regression.
- Approval: pending customer acceptance and final approval integration test; SLA handling and notification UI.
- Fulfillment: full manual warehouse editor, replenishment-driven consolidation suggestions, promised-date action, reservation races and stock invariants.
- Billing: invoice void/reissue policy, credits across repeated cycle/quantity changes, payload-bound idempotency, job observations, all list filters/pagination.
- Entitlements: browser QA, publication volume/transaction performance and next-boundary snapshot integration.
- Portal: all new routes browser/tenant leakage checks, proposal apply/decline and auto-apply routing tests, secure login/share journey, pagination beyond quotations. Share route currently returns to portal home after magic-link verification.
- Phase 10 implementation exists: detectors, scan service, scoped event hooks, filters/actions UI, daily job and dashboard card. Still verify browser behavior, large scan performance, complete activity hooks, database-enforced nullable-key uniqueness and historical anomaly cases.
- Phase 11 manual report query/UI and PDF/XLSX exports implemented with shared filters and role scope. Report integration test passed; workbook readback and PDF rendering tests passed; all four report pages and invoice layout inspected. Latest suite: 107 unit/export tests passed; typecheck, lint and production build passed. Stakeholder analytics breadth, report browser QA, historical financial semantics, persistent table pagination and final home dashboard remain.
- Phase 12: design-system/landing/auth polish, accessibility, responsive QA, sidebar action consolidation.
- Phase 13: demo scenarios, CI, full security/concurrency/acceptance audit, operational documentation and final logical commits.

User-authored root README, moved PRD, plans and fonts must be preserved. Do not stage the entire worktree.
