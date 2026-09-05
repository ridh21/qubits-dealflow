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

### Stakeholder analytics increment

- Added `/analytics` with server-validated role views (personal sales, team performance, finance, operations, platform), shared period/team filters, and shadcn Chart/Recharts visualisations. Navigation and apply actions use the shadcn sidebar with Phosphor icons.
- Includes pipeline stage distribution, cohort conversion, upsell quote outcomes, weighted discounts, confirmed value by owner, discount/margin scatter, approval workload/turnaround, excess histogram, policy routes, stalled links, invoice/cash trends, current AR/MRR, settlement and subscription transitions, dispatch percentiles, warehouse/stock/backorder charts, audited activity, pending users, email status and entitlement notices. Current snapshots and metric limitations are labelled explicitly.
- Four aggregation/access unit tests and one isolated PostgreSQL integration test passed. Integration proves forbidden view rejection, own-record scope, currency separation and payment-date cash reporting for older invoices with a half-open period boundary.
- Latest complete suite: 111 tests passed, 21 database tests skipped in the default run. Typecheck, lint and production build passed. Manager chart/table switch and mobile sidebar verified in-browser. Automated WCAG 2 A/AA scan: zero violations after correcting chart container roles; contrast checks remain manual.
- Task 4 is **not yet complete**: recorded-milestone funnel, anonymised team discount benchmark, recommendation acceptance instrumentation, manager alert heatmap, historical MRR reconstruction, credit/DSO charts, consolidation events and remaining browser/data-volume checks still need work. Home dashboard work is proceeding separately.

### Finance semantics and home dashboard follow-up

- Added period-end gross-invoice DSO (radial gauge) and dated backorder consolidation activity. DSO uses payments and credit applications before the exclusive period end, with no value for a zero sales denominator.
- Manual reports now share invoice access rules with analytics and count cash by payment date, including payments on older invoices. Standalone invoices are limited to finance/admin and excluded when quotation-only dimensions are selected.
- Five analytics unit tests, report access tests and two isolated PostgreSQL report/analytics integration tests pass, including DSO and cash date boundaries. The home dashboard was committed separately (`32967d1`); a schema-qualification review fix is in progress.
- The latest full workspace typecheck is currently blocked by concurrent edits in `prisma/seed/demo.ts`; do not interpret the earlier successful build as verification of those later seed edits.
- Credit currency snapshot migration (`bd4e531`) passed six isolated integration tests and was applied to the configured application database after confirming it was the only pending migration and that credit sources were resolvable. The established integration schema was updated separately. No existing credit application repairs were performed.
- Added per-currency credit/proration charts after the currency snapshot became available. Analytics/report integration now covers credit totals as well as old-invoice payments and DSO.
- Session authorization now rechecks current active user role/team/customer state for both staff and portal actions. Portal magic tokens use an atomic delete-count winner to prevent concurrent replay. Four guard tests and one isolated concurrent-token test passed; targeted ESLint passed. No email was sent by verification.
- Dashboard raw SQL now qualifies every table with the configured schema (`f63766d`), matching Prisma model query isolation.

### Billing, analytics and accessibility verification follow-up

- Fixed audit findings F01–F09 across subscription cycle entitlements, deferred schedules, exact accepted recurring amounts, proposal revisions, warehouse reservation/deactivation races, bounded consolidation, receipt suggestions, stale allocations and policy-controlled portal credential lifetime. These fixes do not establish full phase completion.
- Exact recurring basis (`9231487`) preserves immutable accepted order-line allocation cents in invoices, schedules, quantity/cycle changes and cancellation. Three unit tests and a real PostgreSQL recurring-invoice/quantity integration test passed. All four isolated cycle-change regression tests also passed after this change.
- Historical MRR (`8cf733f`) replays effective subscription transitions from immutable accepted terms. Missing or inconsistent history produces an explicit unavailable explanation. Current MRR and historical MRR share the exact recurring basis. Added cumulative pipeline milestones, an anonymised team discount benchmark and a UTC alert heatmap; integration verifies own/team scope, currencies, cash/DSO cutoffs and historical MRR.
- Fulfillment F05–F08 passed nine isolated database regression tests. Dashboard schema isolation is fixed in `f63766d`. Portal revision proposals passed three integration tests; token lifetime passed four unit tests.
- Latest default suite: 213 passed, 44 database tests skipped (database suites are run separately). Typecheck, targeted ESLint and production build passed. The earlier concurrent seed type errors are resolved; seed changes remain separately owned.
- Sidebar actions now precede configuration, its landmark is labelled, shared primary controls use a darker orange, and the unused Lucide dependency is removed (`db3bb4d`). Manager dashboard axe scan reports zero violations; SVG chart contrast remains a manual-review item. Heatmap visual review exposed omitted empty weekdays and verified the corrected seven-day axis.
- Still open: quotation builder/list acceptance details, full role/mobile/portal browser journeys, recommendation instrumentation, persistent report pagination, job observability/retry, comprehensive end-to-end acceptance and remaining phase 12–13 hardening. Earlier open items above are historical audit scope; use the latest evidence here for fixes already verified.
