# Phases 03–09 acceptance and security audit

Audit date: 2026-09-05. Reviewed the current shared working tree, including `code/AGENTS.md`, against `docs/plans/03` through `09` and the overview constraints. Findings describe inspected source, not a clean release build. Other agents were changing and committing unrelated files during review.

**Disposition: phase acceptance remains incomplete.** Nine new findings: one P1 and eight P2. P1 means fix before production use of the affected flow; P2 means a concrete correctness, security-policy, or acceptance gap with a bounded trigger. Ordering below is the recommended fix order, not implementation chronology.

**Explicit exclusions:** credit currency, dashboard raw-SQL schema, parent analytics, stale-JWT authorization in `server/auth/guards.ts`, and atomic magic-token consumption in `server/auth/config.ts`. These are assigned in-progress work, not new findings here. No code, seed, configuration, or migration changes were made. No database connection, database mutation, integration test, application action, or external message was executed. Only this document is authored and committed.

## Findings

### F01 · P1 · A cycle change charges a new period but retains the previous plan's entitlements

**Requirement:** Phase 07 Tasks 2/5 require a different-cycle change to start and charge a full new period immediately; Phase 08 Task 5 requires the effective tier/cycle entitlements to be snapshotted for each new period. Phase 09 Task 5 displays current versus next-cycle entitlements. See [docs/plans/07-billing-invoices-proration-payments.md:65](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/07-billing-invoices-proration-payments.md:65>) and [docs/plans/08-subscription-plans-tiers-entitlements-pause-resume.md:83](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/08-subscription-plans-tiers-entitlements-pause-resume.md:83>).

**Evidence:** [code/src/server/services/subscription-billing.service.ts:355](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/subscription-billing.service.ts:355>) creates the full new-period proration invoice. Lines 378–396 change `planId`, anchor, period start/end and next billing date but never change `entitlementsSnapshot` or create the new current-period schedule snapshot. Entitlements are refreshed only by `issuePeriod` at lines 128–176. `regenerateSchedule` starts at the already-advanced next billing date (lines 75–79), so it cannot repair the new current period. The portal consumes the stored snapshot in [code/src/server/queries/portal.ts:209](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/queries/portal.ts:209>).

**Verified trigger/result:** An in-memory execution of the actual `changeSubscription` service changed a monthly subscription with 5 photos/day to a yearly tier with 20 photos/day on 2030-09-16. It charged 12,000 minor units and set the current period end to 2031-09-16, while the snapshot remained 5. Thus a paid upgrade can show/retain the old allowance for a year; a downgrade can retain a higher allowance. The code audit establishes the stored and displayed mismatch; it does not claim an external quota-enforcement system was tested.

**Fix:** Make starting the new period an atomic operation that also records its effective entitlements and schedule item, while keeping the existing invoice source key/idempotency semantics. Keep catalogue entitlement publications deferred within an existing period. Verify immediate monthly→yearly tier upgrade and downgrade, with retry, across invoice, subscription, schedule and portal.

### F02 · P2 · Recurring invoices reconstruct accepted amounts from a lossy discount percentage

**Requirement:** Phase 04 Task 1 / QUO-01 and PRD §7.1 specify exact minor-unit pricing with deterministic discount allocation; Phase 07 Tasks 3/4 / BIL-01 carry those terms into period invoices. See [docs/plans/04-quotation-builder-pricing-upsell.md:32](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/04-quotation-builder-pricing-upsell.md:32>) and [docs/plans/07-billing-invoices-proration-payments.md:55](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/07-billing-invoices-proration-payments.md:55>).

**Evidence:** [code/src/server/services/order.service.ts:49](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/order.service.ts:49>) copies the original unit price but assigns the rounded `effectiveDiscountBp` to the order line at line 56. [code/src/server/services/subscription-billing.service.ts:53](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/subscription-billing.service.ts:53>) copies these into the subscription. `issuePeriod` recalculates `periodAmount(qty, unitPriceMinor, discountBp)` at line 128 instead of preserving the accepted line net. The effective percentage is rounded in [code/src/domain/pricing/price-quotation.ts:63](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/domain/pricing/price-quotation.ts:63>).

**Verified trigger/result:** Executed the actual pure pricing and period functions with one monthly line: qty 1,000; unit price 123,456 minor; line discount 1,234 bp; order discount 1,234 bp; no tax. Accepted net = **94,866,993**; stored effective discount = **2,316 bp**; reconstructed recurring charge = **94,863,590**. Difference = **−3,403 minor units per period**. Both discounts and amounts are within existing validators. This is amount quantization, independent of the excluded credit-currency work.

**Fix:** Preserve an exact recurring charge basis from accepted pricing, including allocated order-discount residuals, and define how that basis scales for later quantity changes. Verify first and subsequent invoices equal the accepted initial-period net/tax for stacked discounts and multi-line residuals.

### F03 · P2 · Applying one proposal strands other open proposals from the same quote version

**Requirement:** Phase 09 Task 3 / POR-02 requires reps to apply or decline proposals and customers to withdraw or wait on open proposals before acceptance. See [docs/plans/09-customer-portal.md:35](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/09-customer-portal.md:35>).

**Evidence:** [code/src/server/services/negotiation.service.ts:57](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/negotiation.service.ts:57>) requires the message version to equal the current quote version before either APPLY or DECLINE. APPLY calls `reviseInTx` at line 68, then `evaluateAndRoute` at line 94; those advance the quote version ([code/src/server/services/quotation.service.ts:405](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/quotation.service.ts:405>), [code/src/server/services/approval.service.ts:66](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/approval.service.ts:66>)). Only the chosen message is resolved at lines 110–115. Withdrawal also requires the old message version at negotiation lines 348–353. Acceptance counts only OPEN messages on the *new* version at lines 313–319.

**Verified source trace:** Submit two line proposals on version N. Apply the first. The second remains OPEN on N; applying, declining, or withdrawing it now fails the version guard. After clearance, the new version can be accepted despite that unresolved request; the portal also excludes the old request from its acceptance blocker and withdrawal controls ([code/src/app/(portal)/portal/_components/quote-workspace.tsx:52](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/app/(portal)/portal/_components/quote-workspace.tsx:52>), lines 222–223). This is stranded negotiation state, not an obsolete-version approval bypass.

**Fix:** Apply a selected proposal batch in one revision, or explicitly resolve/rebase outstanding proposals when advancing versions. Preserve history and require deliberate review before applying old terms. Verify two proposals, first apply, second apply/decline/withdraw, and acceptance behavior.

### F04 · P2 · Deferred cycle changes leave misleading previews and an incorrect invoiced schedule period

**Requirement:** Phase 07 Tasks 2/5/8 require NONE changes to apply next period, a regenerated schedule and accurate previews. See [docs/plans/07-billing-invoices-proration-payments.md:65](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/07-billing-invoices-proration-payments.md:65>).

**Evidence:** [code/src/server/services/subscription-billing.service.ts:330](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/subscription-billing.service.ts:330>) stores NONE changes only in pending transition detail. `regenerateSchedule` at lines 69–114 reads the unchanged subscription quantity/plan and ignores pending transitions, so future rows still display the old price/cycle. At the boundary, [code/src/server/services/billing-job.ts:81](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/billing-job.ts:81>) applies the pending plan before `issuePeriod`. The schedule upsert's update branch in [code/src/server/services/subscription-billing.service.ts:163](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/subscription-billing.service.ts:163>) updates amount, status, invoice and entitlements but **omits `periodEnd`**. The final regeneration deletes only upcoming/skipped rows, preserving that incorrect INVOICED row.

**Verified trigger/result:** For a monthly→yearly NONE change at Oct 1, the pre-existing upcoming row ends Nov 1. An in-memory execution of actual `issuePeriod` after switching to the yearly plan produced an invoice and subscription ending Oct 1 of the following year, but the INVOICED schedule row still ended Nov 1. Before execution, the projected rows also use the old monthly amount.

**Fix:** Build projections by folding in pending transitions at their effective boundaries, and update all period fields when marking an existing schedule row invoiced. Verify the preview before the boundary and the persisted invoice/schedule/subscription agreement after it.

### F05 · P2 · Suggested plans can reserve and dispatch from a deactivated warehouse

**Requirement:** Phase 06 Tasks 3/5 require acceptance to revalidate availability and warehouse allocation eligibility. Planning uses active warehouses. See [docs/plans/06-fulfillment-warehouse-splitting.md:68](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/06-fulfillment-warehouse-splitting.md:68>).

**Evidence:** [code/src/server/services/admin/warehouse.service.ts:61](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/admin/warehouse.service.ts:61>) permits deactivation when reserved stock is zero, which is true for SUGGESTED allocations. [code/src/server/services/fulfillment.service.ts:133](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/fulfillment.service.ts:133>) loads an existing suggestion and reserves its allocations without checking warehouse activity. [code/src/server/services/stock.service.ts:30](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/stock.service.ts:30>) reads only stock levels and verifies quantity, not warehouse eligibility. `markShipped` likewise does not reject inactive warehouses. In contrast, consolidation explicitly checks `warehouse.isActive` at fulfillment lines 492–496.

**Verified source trace:** Propose a split at active warehouse W; deactivate W before acceptance, with no reservations; accept the old suggestion. All acceptance checks can pass and create reserved allocations and shipments at W. No concurrent interleaving is required.

**Fix:** Revalidate warehouse eligibility alongside stock when accepting a suggestion, with a lock strategy coordinated with deactivation. Reject and refresh stale suggestions. Verify deactivation between proposal and acceptance prevents reservations and shipment creation.

### F06 · P2 · Partial backorders cannot be consolidated through the shipped UI

**Requirement:** Phase 06 Tasks 2/5 explicitly allow partial consolidation (`min(available, backorder.qty)`), and Task 6 exposes Ops controls. See [docs/plans/06-fulfillment-warehouse-splitting.md:49](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/06-fulfillment-warehouse-splitting.md:49>) and [docs/plans/06-fulfillment-warehouse-splitting.md:84](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/06-fulfillment-warehouse-splitting.md:84>).

**Evidence:** [code/src/app/(internal)/fulfillment/_components/order-workspace.tsx:235](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/app/(internal)/fulfillment/_components/order-workspace.tsx:235>) always sends `qty: b.qty` to `consolidateAction`; the section has a warehouse selector but no quantity input. The service supports a smaller positive quantity ([code/src/server/services/fulfillment.service.ts:480](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/fulfillment.service.ts:480>)) and preserves the remainder at lines 521–526.

**Verified source trace:** With backorder 5 and warehouse stock 2, the UI always requests 5 and reservation rejects it. Even if another warehouse holds the remaining 3, neither can be used through this control. Accepted plans cannot be manually overridden (`overridePlan` only accepts SUGGESTED plans).

**Fix:** Add a bounded consolidation quantity defaulting to available stock, or actionable per-warehouse partial suggestions. Verify reserving 2 of 5, retaining 3 open, then shipping/billing only those 2.

### F07 · P2 · Restock never creates the required consolidation proposal or Ops notification

**Requirement:** Phase 06 Task 5 / FUL-03 and scenario B require receiving stock to create a consolidation suggestion and notify FINANCE; Ops then accepts or declines. See [docs/plans/06-fulfillment-warehouse-splitting.md:68](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/06-fulfillment-warehouse-splitting.md:68>).

**Evidence:** [code/src/server/services/admin/warehouse.service.ts:139](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/admin/warehouse.service.ts:139>) emits `stock.received`, but the registered handler is only `console.info` ([code/src/server/events.register.ts:21](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/events.register.ts:21>)). Searching `code/src` for `suggestConsolidation`, `suggestedWarehouseId`, `suggestedQty`, and `CONSOLIDATION_SUGGESTED` found no suggestion implementation or writer; references to the status are readers/guards. The UI at [code/src/app/(internal)/fulfillment/_components/order-workspace.tsx:218](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/app/(internal)/fulfillment/_components/order-workspace.tsx:218>) offers manual reservation, not receipt-triggered proposals or decline handling.

**Impact:** Receipt succeeds while affected backorders remain OPEN without the promised Ops alert. Staff must discover replenishment and manually revisit every order. The receipt→prompt→accept/decline acceptance sequence is missing; manual full consolidation does exist.

**Fix:** Wire receipt to bounded, non-reserving suggestions that prefer already-used warehouses, with Ops notification and explicit acceptance/decline. Verify receipt alone creates no reservation, a duplicate event does not duplicate actionable proposals, and acceptance rechecks stock.

### F08 · P2 · Stale allocation suggestions cannot be recomputed by retrying proposal generation

**Requirement:** Phase 06 Task 5 says availability changes at acceptance refresh the proposed plan and report conflict. See [docs/plans/06-fulfillment-warehouse-splitting.md:68](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/06-fulfillment-warehouse-splitting.md:68>).

**Evidence:** [code/src/server/services/stock.service.ts:43](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/stock.service.ts:43>) throws when another order has consumed availability. Acceptance propagates the error without a refresh. [code/src/server/services/fulfillment.service.ts:74](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/fulfillment.service.ts:74>) returns any existing plan unchanged, including SUGGESTED; re-running `proposePlan` cannot recompute it. The corresponding action calls this same service ([code/src/server/actions/fulfillment.ts:9](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/actions/fulfillment.ts:9>)).

**Verified source trace:** Suggest W1:5; another order reserves W1's last units while W2 has 5. Acceptance fails safely. Refresh/re-propose still returns W1:5 and fails again despite fulfillable stock at W2. Manual override is a workaround, so this is not a total fulfillment deadlock or oversell claim.

**Fix:** Provide an explicit recompute operation for unreserved suggestions, preserving decided/shipped history. Commit the refreshed proposal separately from any transaction intentionally rolled back on conflict; return its new identity/version. Verify the W1→W2 recovery and renewed confirmation.

### F09 · P2 · Published magic-link lifetime has no effect on issued credentials

**Requirement:** Phase 03 Tasks 1/7 / CFG-03 define editable `PORTAL.magicLinkMinutes`; Phase 09's AUTH-01 portal login must consume that policy. See [docs/plans/03-policy-center.md:34](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/03-policy-center.md:34>) and [docs/plans/03-policy-center.md:103](</Users/harshdodiya/personal/hackathon/qubits-dealflow/docs/plans/03-policy-center.md:103>).

**Evidence:** The field validates at [code/src/domain/policy/schemas.ts:67](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/domain/policy/schemas.ts:67>) and is exposed as “Magic link lifetime (minutes)” in [code/src/app/(internal)/admin/policy/_components/simple-editor.tsx:27](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/app/(internal)/admin/policy/_components/simple-editor.tsx:27>). Issuance instead uses a hardcoded 15 minutes at [code/src/server/auth/portal-links.ts:7](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/auth/portal-links.ts:7>), calculates expiry from it at line 37, and repeats it in the email at line 48. It never loads the PORTAL policy.

**Verified source trace:** Publishing a 1-minute lifetime still issues a token whose stored expiry is 15 minutes after issuance. This extends newly issued credential validity beyond the configured security setting. It is separate from the parent's single-use token-consumption fix.

**Fix:** Resolve the active PORTAL policy when issuing a token and use the same lifetime in stored expiry and email. Verify 1-minute and 30-minute policies and missing-policy behavior using a controlled clock.

## Coverage, exclusions and limits

| Phase | Acceptance/security trace covered | Result relevant to this audit |
|---|---|---|
| 03 | Policy schema/publish/history, active policy consumers | F09; inspected publish authorization, validation and version creation |
| 04 | Editable states, version snapshots, accepted price propagation | F02; latent customer-reassignment concern below |
| 05 | Risk buckets, current-step/current-version checks, stored request policy, final approval→order | F03 integration; no additional verified bypass in the inspected path |
| 06 | Quote acceptance→unique order, stock locks, accept/override/dispatch, receipt/backorder controls | F05–F08 |
| 07 | Invoice sources, activation, period advance, immediate/deferred changes and cancellation | F01/F02/F04; excluded credit work kept separate |
| 08 | Tier catalogue, draft publication/notices, current snapshots, pause/resume transitions | F01/F04; publication itself leaves current snapshots unchanged |
| 09 | Restricted selects, ownership-scoped reads/actions, proposal and acceptance versioning, subscription portal | F03/F09; assigned auth fixes excluded |

**Not promoted to an exposed vulnerability:** `setCustomer` changes the customer of an editable revision without clearing `sentAt`, portal token, or historical negotiation messages ([code/src/server/services/quotation.service.ts:483](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/services/quotation.service.ts:483>)). `listMyMessages` scopes those messages through the quote's *current* customer ([code/src/server/queries/portal.ts:222](</Users/harshdodiya/personal/hackathon/qubits-dealflow/code/src/server/queries/portal.ts:222>)). However, a repository-wide call-site search found **no caller** of `setCustomer`, and quotation server actions do not expose it. This is a latent service-level isolation defect to address before implementing the planned customer switcher, not a demonstrated attack through the current application.

**Validation performed:** Read-only source/call-site inspection and three in-memory executions: actual pure quotation/period amount functions (F02); actual `changeSubscription` with mocked transaction, invoice, credit, audit and policy dependencies (F01); actual `issuePeriod` with an existing schedule row and mocked persistence (F04). TypeScript was transpiled in memory; no test or script file was created. The mocks prove application payload/state behavior, not PostgreSQL constraints, locking or a browser workflow. Other findings are verified source traces with explicit inputs/preconditions, not live reproductions. Existing integration suites were inspected but not run because they create database records. No build, seed, migration or full test-suite pass is claimed.

**Prioritized work:** F01 first; F02 and F03 next; F04–F06 before completing billing/fulfillment acceptance; F07/F08 to complete replenishment recovery; F09 before relying on portal lifetime policy. These are proposed fixes only. None authorizes or requires a broad migration as part of this audit.

## Evidence snapshot

HEAD observed before writing: `f63766dddb89ae031e5e5ffff676d4a5f503a4bd`. Working-tree SHA-256 values identify the inspected implementation independently of concurrent commits:

```text
67fe14c530c9462fcbc54ef771698dcd8b36a755fa26964d39d6d463a088cdda  code/src/server/services/quotation.service.ts
e13fe4bcc3dde9d035ca2d43d9770c1e2c4d43361951b57fc41532cc588f039a  code/src/server/services/approval.service.ts
e556cd5a99ac43dab5d0bc38fd39809cb5455fba0502c2415fd5622346d38ef4  code/src/server/services/negotiation.service.ts
590f986f7ce21d875002b9fab75d3800415dfe3fe5fd3a4c0308efa4799e6100  code/src/server/services/order.service.ts
e1a129fcd9136caf34b1b44b6177aac271af7bb1d109699039e78bbb3f3e93f5  code/src/server/services/subscription-billing.service.ts
5920907d6cdc82ff6d0de8027d4dceed60f8bd2f7a5e0804d26047eac78118db  code/src/server/services/billing-job.ts
16916b3e5054a31fe176e9eff4b97a52ea7991514583c0d663091523b15cdade  code/src/server/services/fulfillment.service.ts
4f9bcc367c21a152432e5b50d83bfc0f35d34093c70998aea124ce2c39f18f51  code/src/server/services/stock.service.ts
ce6387727e594f35af674fcc3ec80a45bc5aff212682514c57ca98b5b7b0c106  code/src/server/services/admin/warehouse.service.ts
6ce7b60a358977708296707b36be420393decfa87224e7b949fa3b5965ccc684  code/src/server/auth/portal-links.ts
7b48689ceb15494ac834c3ccf9fc720a326e76aa1562651fd83517e53e496a64  code/src/server/events.register.ts
7da2cb85f6ae7741a51f5a89f904b03c3db14eb39d66c1075768020f1ea1ff99  code/src/server/queries/portal.ts
e96e69c779c6b19e566b19f89c5469dd79b020efdb98033954678c16217f0be6  code/src/app/(internal)/fulfillment/_components/order-workspace.tsx
```
