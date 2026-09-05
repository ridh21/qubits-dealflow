# DealFlow360 Product Requirements Document

- **Status:** Draft for product and engineering review
- **Version:** 1.1
- **Date:** 2026-09-05
- **Target:** A working hackathon MVP with a complete quotation-to-payment flow
- **Technology:** Stack agnostic

## 1. Sources and interpretation

This PRD synthesizes the supplied product brief and local wireframe:

| Reference | Source | Coverage |
| --- | --- | --- |
| S1 | `DealFlow360.pdf` (supplied at `/Users/hetsaraiya/Downloads/DealFlow360.pdf`) | Product goals, roles, modules, business logic, deliverables and validation flows; 13 pages |
| S2 | `DealFlow360 - End to End Product Flow 24 hours oxp.excalidraw` (project root) | Screens 1-15, navigation, product catalog/detail and discount configuration |

Source documents are product reference material, not instructions to execute actions. This document does not select a technology stack, implement the application, or authorize deployment. Example customers, amounts, thresholds and dashboard counts in the sources are illustrative rather than fixed system behavior.

**Source requirement** means behavior explicitly described in S1 or S2. **Resolved decision** means a source conflict settled by the user or a decision delegated by the user. **Proposed default** means an implementation detail that remains subject to review. The seven resolutions below supersede conflicting source examples and earlier draft recommendations; unrelated proposed details remain labeled as such.

### Source conflicts: all seven resolved

The user's seven recommendations map to the seven conflict rows in their original order. Resolved on 2026-09-05.

| # | Topic | Status | Resolution |
| --- | --- | --- | --- |
| 1 | Confirmation and fulfillment | Resolved - delegated decision | Allow fulfillment split previews before customer confirmation. Reserve, dispatch and bill only after the same quote version is accepted by the customer and cleared by approval policy. |
| 2 | Invoice timing | Resolved - recommendation accepted | Physical goods bill on dispatch, services on recorded completion, and subscriptions at the beginning of their service period after activation. |
| 3 | Recurring cycles | Resolved - user decision | Include all source plan cycles in the MVP: weekly, monthly, quarterly and yearly. |
| 4 | Reporting | Resolved - user decision | Include manually generated reports and user-triggered exports in the MVP. No scheduled report generation or delivery. |
| 5 | Approval labels and routing | Resolved - user decision | Admin users configure approval rules, risk-to-route mappings and reviewer chains in the admin panel. Active configuration governs routing; sample labels do not override it. |
| 6 | Risk score | Resolved - user decision | Admin users configure discount ceilings, risk thresholds and routing inputs through the admin panel. Section 7 supplies the initial calculation and editable seed values. |
| 7 | Subscription pause/resume | Resolved - user decision | Include user-controlled pause and selection of a resume billing cycle. A pause takes effect at the next billing-cycle boundary; resume occurs at the selected later boundary. Neither interrupts a current paid period nor creates mid-period pause/resume proration. |

The manual-only reporting decision applies to reports and exports. Recurring billing, timed subscription transitions and deal-health evaluation retain their operational scheduling.

## 2. Problem and product outcome

B2B sales teams need to negotiate discounts, protect margin, coordinate stock across warehouses, and sell hardware and subscriptions together. Basic quote-to-invoice tools leave approvals, customer negotiation and delivery exceptions disconnected, making deals harder to progress and reconcile.

DealFlow360 connects these activities around one versioned quotation and its resulting order. It should enforce pricing policy, explain approval decisions, suggest profitable additions, plan fulfillment against available stock, generate correct billing, and surface deals that need attention.

### Goals

1. Route every quotation to the correct approval chain automatically.
2. Let reps build and revise quotes with immediate pricing, margin and recommendation feedback.
3. Let customers review, negotiate and accept terms in a restricted portal.
4. Allocate physical products across warehouses without overselling and track shortages as backorders.
5. Reconcile one-time charges, recurring schedules, prorations, credit notes and recorded payments.
6. Give managers actionable visibility into stalled deals, unusual discounts and delivery risk.

### Success criteria

These are proposed acceptance targets, not measured results or promised business outcomes:

| Measure | MVP target |
| --- | --- |
| Core workflow | Scenarios A-C in section 12 pass with persisted data |
| Approval correctness | Every policy test routes to the expected highest required approval level under the active or snapshotted admin configuration |
| Financial correctness | Invoice, proration, credit and payment fixtures reconcile to the currency minor unit |
| Inventory correctness | No negative available stock or duplicate reservations in concurrent allocation tests |
| Portal isolation | Cross-customer and internal-only access attempts are denied |
| Auditability | Every submitted revision, approval decision and consequential mutation has actor, time and reason |
| Demo readiness | Two complete flows demonstrated in five minutes using seed data |

## 3. Users and permissions

Access must be enforced by the backend as well as the interface. The following ownership boundaries are proposed defaults; source roles come from S1 pages 2-3.

| Role | Required capabilities | Boundaries |
| --- | --- | --- |
| Sales Rep | Create and revise assigned quotes, view suggestions, submit approvals, respond to negotiations, track orders | Cannot approve own discounts, alter stock or record finance actions |
| Sales Manager / Approver | Review assigned approvals, configure discount policy and chains, monitor team deals | Cannot bypass a required Finance step |
| Finance / Operations | Complete Finance approvals, manage stock/splits/backorders, manage subscription changes, invoices, credits and payments | Cannot alter approved commercial terms without a new quote revision |
| Customer | View own quotes, comment on lines, propose changes, accept the current version, and pause/resume own subscriptions at billing-cycle boundaries | No access to costs, margins, internal risk notes, other customers or configuration |
| Admin | Manage users, catalog, price lists, warehouses, plans, discount/risk rules, approval mappings/chains and manual reporting through the admin panel | Administrative access does not silently bypass approval policy |

Internal signup creates an unprivileged or pending account; an authorized administrator assigns roles. Customer identity must be linked to a customer account and authorized quotation. Public signup must not grant privileged access.

## 4. Scope and delivery priorities

### P0: Core MVP

- Credential login, basic signup and role-based access; separate customer portal.
- Minimum configuration for customers/tiers, products and variants, price lists, discount rules, approval chains, warehouses/stock and recurring plans.
- Quotation list/table and pipeline; quotation builder with line and order discounts and live margin.
- Ranked upsell/cross-sell suggestions using seeded relationships, promotions and margin rules.
- Sequential approvals with explanations, revision handling and audit history.
- Portal comments, counterproposals, acceptance and reapproval.
- Warehouse split suggestions, valid manual overrides, backorders and restock consolidation.
- Hybrid orders, delivery-based one-time invoicing, weekly/monthly/quarterly/yearly recurring plans, modifications, cancellation, proration and credits.
- Subscription pause from the next billing cycle and user-selected resumption at a later billing-cycle boundary.
- Admin-panel configuration of discount/risk thresholds and approval routing, with validation, preview, versioning and audit history.
- Manual reports with full filters and user-triggered PDF/XLS-compatible exports; no report scheduler.
- Invoice list/detail, manual payment recording and payment status reconciliation.
- Basic deal health alerts and in-app nudge/escalation actions.
- Seed data, two working demo flows and essential correctness/security tests.

### P1: After the core workflow

- Rich configuration UX for recommendation rules and replenishment policies.
- More detailed sales trends, approval bottleneck and usage analytics.
- Password recovery and production email or magic-link delivery, depending on the authentication approach.

### Deferred / non-goals

- Multi-company operation, currency conversion and mixed-currency orders. Store a currency on records and use one configured currency for the MVP; broader currency support remains a source bonus.
- Machine-learning recommendation training; deterministic rules satisfy initial suggestions.
- Live payment processing, bank reconciliation, carrier integrations, tax engines and accounting-system sync.
- Scheduled report generation/delivery, dunning and complex usage-based billing.
- Production-scale deployment, procurement automation and a general-purpose CRM.

Manual payment recording is a real persisted business action; it does not imply funds were collected by an integrated payment gateway.

## 5. Navigation and screen requirements

Each major entity has a list and a record detail view. Clicking a row/card opens that record and preserves context. Show role-appropriate navigation, clear active tabs, loading/empty/error states and actionable validation.

| Source screen | Screen | Required content and actions |
| --- | --- | --- |
| S2 1 | Login / Signup | Email/password validation; route internal users to dashboard and customers to authorized portal |
| S2 2 | Sales Dashboard | Open quotations, pending approvals, at-risk deals, recent activity; New Quotation and View Approvals |
| S2 3 | Quotations | Pipeline by stage and table view; customer, amount, stage; create and open quote |
| S2 4 | Quotation Detail | Customer, tier/price list, products/variants, quantities, discounts, limits, totals, margin, suggestions; Save Draft and Submit |
| S2 5 | Approvals | Quote, customer, risk, current step, assignee and status; pending filter |
| S2 6 | Approval Detail | Line violations, blended score, required steps and audit history; Approve, Reject, Return for Revision |
| S2 7 | Fulfillment and Stock | On-hand, reserved and available stock per SKU/warehouse; orders waiting for allocation or backorder |
| S2 8 | Fulfillment Detail | Per-line warehouse allocations, shortages, shipment estimate and cost; Accept Split, Manual Override, consolidate after restock |
| S2 9 | Subscriptions | Customer, plan, weekly/monthly/quarterly/yearly cycle, next bill, pause effective date, resume date and status; open subscription; authorized plan creation |
| S2 10 | Billing Detail | Originating order, separate one-time and recurring sections, schedule and proration history; Modify, Cancel, Pause and Select Resume Cycle; preview effective dates |
| S2 11 | Customer Portal | Current quote/status, line comments, counter discount, requested delivery date; Submit Request and Confirm Quotation; access own subscriptions to pause and choose a resume cycle |
| S2 12 | Invoices | Number, customer, amount, due date and payment status; open invoice |
| S2 13 | Invoice Detail | Order/delivery references, charge lines, credits, balance and payment history; Record Payment and Download Summary |
| S2 14 | Deal Health | Stalled quotes, discount anomalies and delivery slippage; open related record, Nudge Rep and Escalate |
| S2 15 | Manual Reports | Period, rep/team, approval status and product/category filters; Generate Report, Export PDF and Export XLS-compatible file; no schedule controls |
| S2 unnumbered | Products and Product Detail | Catalog, active/archive status, general info, variants, price lists, subscription indicator and cycle |
| S2 unnumbered / S1 A3-A5 | Configuration | Admin-editable discount tiers/category ceilings, risk thresholds, approval mappings/chains, warehouses/stock, shipping weighting and subscription policies |

Workspace actions from S1: **Reload Data** refreshes price, stock and approval information; **Go to Back-end** opens permitted configuration; **Close Workspace** exits the workspace view. Leaving a dirty form prompts to save or discard. Closing the workspace does not imply logout.

## 6. Functional requirements

| ID | Requirement and acceptance behavior | Basis |
| --- | --- | --- |
| AUTH-01 | Authenticate users and enforce role and record ownership on every read/write; customers cannot reach internal records by changing URLs or IDs | S1 A1, S2 1; ownership is a proposed detail |
| CFG-01 | Manage product name, category, price, unit, tax, description, variants and surcharges; archived products remain visible on historical records | S1 A2, S2 product screens |
| CFG-02 | Resolve tier-based price lists, store currency, and snapshot prices/taxes on each quote revision; later catalog edits do not silently change it | S1 A2; snapshots proposed |
| CFG-03 | Admin panel lets authorized admins edit tier/category ceilings, worst-line/blended/overall thresholds, risk-to-route mappings and ordered approvers; validate ranges and preview routing before saving a versioned, audited policy | S1 A3; resolved decisions 5-6 |
| CFG-04 | Manage warehouse stock, replenishment settings and shipping weights; subscription/service lines do not consume physical inventory | S1 A4; inventory classification proposed |
| CFG-05 | Attach weekly, monthly, quarterly or yearly plans to products and configure proration/cancellation/credit policies | S1 A5, S2 product detail; resolved decision 3 |
| QUO-01 | Create a draft for a customer; add/remove lines and adjust quantities, variants and discounts; persist and reopen the same values | S1 B2-B3, S2 3-4 |
| QUO-02 | Recompute line totals, effective discounts, taxes, quote total, margin and violations after every pricing edit; backend validates the same calculations | S1 B3, S2 4 |
| QUO-03 | Submission automatically evaluates policy and creates the required approval steps or records that none are required | S1 B3-B4 |
| REC-01 | Show ranked relevant suggestions, incremental margin and promotion tags; Add updates the quote immediately; Dismiss removes the suggestion for that revision | S1 B5 |
| APR-01 | Explain every violation and routing decision; follow the admin-configured reviewer sequence (initial default: Manager before Finance); only the current assigned step can act | S1 A3/B4, S2 6 |
| APR-02 | Persist approve/reject/return actions with actor, timestamp, reason and version; returned quotes can be revised and resubmitted | S1 A3/B4 |
| POR-01 | Show customer-safe terms and current status; accept line comments, counter discounts and requested delivery changes as proposals | S1 B8, S2 11 |
| POR-02 | A rep applying a proposal creates a revision and triggers reevaluation; acceptance binds to an exact revision and cannot bypass approval | S1 B8; version semantics proposed |
| FUL-01 | Suggest a feasible split using current available stock and shipping weights; show allocated and backordered quantities with estimated shipments/cost | S1 B6 |
| FUL-02 | Validate overrides against availability and ordered quantities; atomically reserve stock only when confirming an eligible order | S1 B6; transaction behavior proposed |
| FUL-03 | Record partial dispatch; after restock, show a consolidation proposal for unfulfilled backorders without changing shipped allocations | S1 B6 |
| BIL-01 | A single order retains one-time and recurring lines; create linked, distinguishable charge records and show the upcoming recurring schedule | S1 B7, S2 10 |
| BIL-02 | Subscription modification previews the effective date, proration and next bill; cancellation applies configured credits and prevents future charges | S1 A5/B7 |
| BIL-03 | Users can pause authorized subscriptions from the next billing boundary and choose a later resume cycle; preview dates, skip paused-period charges, resume automatically at the selected boundary, and audit each action | Resolved decision 7 |
| INV-01 | Generate invoices from eligible delivery/service events and recurring periods; retain source links and prevent duplicate charges on retry | S1 quick test, S2 13; retry behavior proposed |
| PAY-01 | Record a payment with amount, date, method and reference; update outstanding balance and payment status; retain history | S1 page 11, S2 13 |
| HLT-01 | Detect configurable inactivity, unusual discounts and delivery slippage; alerts link to the quote/order and support an audited nudge or escalation | S1 B9, S2 14 |
| RPT-01 | Generate reports only on a user action; use period, rep/team, approval status and product/category filters consistently for display and user-triggered exports. Do not offer scheduled generation or delivery | S1 A7, S2 15; resolved decision 4 |

## 7. Business rules and configurable defaults

### 7.1 Pricing and margin

- A quote has one customer, currency and selected price list. A product's resolved unit price includes its applicable variant surcharge.
- Use decimal money arithmetic. Round monetary postings to the currency minor unit; distribute allocation rounding residuals deterministically so sums reconcile.
- Require quantity greater than zero, non-negative prices, and discounts between 0% and 100%. Physical SKU quantities are integers in the MVP.
- Apply line discounts first. Allocate an order-level percentage discount proportionally across the post-line-discount amounts. An amount discount, if supported later, follows the same allocation principle.
- For line `i`, `base_i = quantity_i * resolved_unit_price_i`; `net_i` is its pre-tax amount after both discounts; `effective_discount_i = 100 * (base_i - net_i) / base_i`.
- Zero-price lines have no percentage-based risk denominator and must be explicitly supported as free items or rejected; proposed MVP default is to reject them on submission.
- Calculate configured line taxes on the discounted net amount. Display subtotal, discounts, tax and total separately. Shipping estimates are separate until confirmed as a charge.
- Maintain unit cost for margin calculations, although the sources do not list it as a catalog field. `margin_amount = net_revenue - cost`; `margin_percent = margin_amount / net_revenue * 100`, or N/A when net revenue is zero.
- Show one-time margin and recurring margin per billing period separately; do not sum monthly and yearly values into a misleading total. A recurring quote summary is labeled as the initial-period charge, not lifetime contract value.

### 7.2 Discount governance and blended risk

The sources require both individual-line protection and an aggregate signal. Admin configurability is resolved. Use the following transparent calculation as the initial implementation default; administrators can edit its ceilings, thresholds and routing mappings through the admin panel without a code change. Seed cutoffs are editable defaults, not fixed policy. A formula-expression editor is not required.

1. `limit_i = min(customer_tier_ceiling, category_ceiling)`.
2. `excess_i = max(0, effective_discount_i - limit_i)` in percentage points.
3. `worst_excess = max(excess_i)`.
4. `blended_excess = sum(base_i * excess_i) / sum(base_i)`.
5. `overall_discount = 100 * (sum(base_i) - sum(net_i)) / sum(base_i)`.
6. Map worst-line excess, blended excess and any configured overall quote ceiling to approval levels; choose the highest level required by any rule.

For mixed recurring cycles, evaluate recurring lines in separate cycle buckets and one-time lines in their own bucket, then take the highest route across buckets and individual lines. This avoids comparing annual charges directly with monthly charges. Any alternative normalization basis must be explicitly configured.

Initial admin-editable seed policy:

| Condition | Required route |
| --- | --- |
| No line exceeds its limit and no configured aggregate ceiling is breached | No approval required |
| Any positive excess or overall-ceiling breach below the high-risk cutoff | Sales Manager |
| Worst excess at least 8 points, blended excess at least 5 points, or overall discount at least 5 points above its configured ceiling | Sales Manager, then Finance |

- Tier seed ceilings: Bronze 5%, Silver 10%, Gold 15%; category examples: Hardware 15%, Services 10%.
- A Gold customer's hardware at 12% against 15% passes; services at 18% against 10% have 8 points excess and require both reviewers under this initial seed policy.
- Several small violations still trigger approval because every positive excess is evaluated. The weighted signal can additionally escalate broad discounting.
- A stricter configured overall ceiling can flag a quote even when all individual lines pass. Without such a configured rule, the system must not invent an aggregate violation.
- Missing required policy or cost data blocks submission with a specific configuration error rather than silently treating risk or margin as safe.
- Only admins or users explicitly granted policy-configuration permission may publish rules. Reject overlapping/gapped routing ranges, missing reviewers and invalid thresholds. Preview representative outcomes, record actor/time/reason and preserve prior policy versions. New submissions use the active version; pending reviews retain their snapshot until a revision is resubmitted.
- Snapshot the evaluated policy version and its explanation. Changes to customer, products, quantities, prices, discounts, billing terms or promised dates create a new revision, invalidate prior approvals/acceptance, and recalculate the route.

### 7.3 Recommendations

Use seeded co-purchase/product pair relationships for the MVP. Filter unavailable/inactive or below-minimum-margin suggestions, rank eligible items by relationship strength and promotion boost, and break ties consistently. Show the incremental margin for adding the suggested quantity at the current customer's price. Adding an item reruns pricing and approval evaluation; promotion tags do not exempt discounts from governance.

### 7.4 Inventory and fulfillment

- `available = on_hand - reserved` per warehouse and SKU.
- Proposed selection order: maximize fulfillable quantity, minimize estimated shipping cost plus a configurable shipment-count penalty, then use a deterministic warehouse tie-breaker. A simple greedy allocator is acceptable if its limitations are documented; do not claim a globally optimal solution without proving it.
- `ordered_quantity = shipped_quantity + reserved_unshipped_quantity + backorder_quantity` for an active order without cancellations.
- Split previews do not reserve stock. Confirming the order revalidates availability transactionally; stale suggestions are refreshed before commitment.
- Overrides cannot exceed available stock, double-allocate a unit, alter delivered quantities or hide shortages.
- Dispatch reduces both on-hand stock and the associated reservation exactly once. Backorders do not reduce available stock until allocated.
- Restock triggers a new proposal for remaining quantities. Consolidation requires an Operations action and preserves delivered history.

### 7.5 Billing, proration and payment

- Physical goods become invoiceable for the quantity actually dispatched; services become invoiceable when completion is recorded. This invoice timing is resolved by the user's acceptance of the recommendation.
- Recurring billing starts on an explicit service activation date, after accepted and approved terms, and bills at the beginning of each service period.
- Keep one-time and recurring invoices separately identifiable under the same order. Never invoice the same delivery quantity or subscription period twice.
- Proposed proration uses actual calendar days in a half-open period `[start, next_start)`: `adjustment = (new_period_price - old_period_price) * remaining_days / period_days`.
- Example: a $60 monthly plan changed to $90 with 15 of 30 days remaining creates a $15 pre-tax debit. A decrease from $90 to $60 creates a $15 pre-tax credit. Applicable tax must be adjusted consistently.
- For different cycle lengths, credit the unused old period and charge the new period from the effective date, resetting the billing anchor. Show a preview before applying.
- Proposed cancellation options: end of current period with no unused-time credit, or immediate with a prorated credit when the configured plan permits it. Stop future billing in either case at the effective end date.
- Credit notes reduce outstanding receivables; a paid-invoice credit creates a customer credit/refund-due record. Recording a credit does not claim an external cash refund occurred.
- Store due dates. `balance = invoice_total - applied_credits - recorded_payments`; derive Unpaid, Partially Paid or Paid, with an Overdue indicator when a positive balance passes its due date.
- Reject non-positive and over-balance payments in the MVP. Protect repeated submissions with idempotency and auditable references.

### 7.6 Subscription pause and resume (resolved)

- Customers can manage their own subscriptions; Finance/Operations can act on authorized customer subscriptions. All actions are permission-checked and audited.
- A pause requested during an active paid period takes effect at its end, which is the next billing-cycle boundary. Service and charges for the current period remain unchanged.
- The user selects a resume cycle from future billing boundaries. Require it to be later than the pause boundary so that at least one whole cycle is paused. Display the exact pause and resume dates before confirmation.
- Preserve the original billing anchor. Weekly boundaries recur every seven days; monthly, quarterly and yearly boundaries follow the original calendar anchor, clamped to the last valid day of a month when necessary, without drifting the original anchor.
- Example: for a monthly subscription anchored on the first, a pause requested September 15 takes effect October 1. Selecting December 1 as the resume date skips October and November charges, then resumes service and normal full-period billing December 1.
- If a user initially enters a non-boundary date, show the first eligible boundary on or after it and require confirmation of that effective date. Do not resume midway through a billing period.
- Before the pause starts, the user may withdraw it. While paused, the user may change the resume selection to a future eligible boundary; no immediate mid-cycle resumption.
- Process pause/resume transitions before generating charges for that boundary. Paused periods create no recurring invoice, no arrears and no pause-related prorated credit. Existing invoices remain payable.
- Resume automatically on the selected boundary, issuing one full-period charge. Repeated transition/billing attempts must not duplicate charges. Cancellation supersedes any pending resume action.
- Ordinary quantity/plan modifications and cancellation retain the separate policies in section 7.5; the cycle-boundary restriction here applies specifically to pause/resume.

### 7.7 Deal health

- **Stalled:** Open quote exceeds a configurable inactivity window; seed default seven days. Meaningful activity includes revisions, customer messages and reviewer decisions, not passive page views.
- **Discount anomaly:** Compare effective discount with the rep's historical submitted quotes. Proposed seed rule: more than 10 percentage points above the mean of at least five prior quotes in 90 days; otherwise show insufficient history.
- **Delivery slippage:** Promised date has passed with unfulfilled quantity, or a known replenishment date makes the promise unattainable. Show the reason rather than implying predictive certainty.
- Reevaluate after relevant events and a periodic scheduled scan. Deduplicate open alerts by record and rule; resolve them when the condition clears.
- Nudge/escalation creates an in-app notification and audit entry in the MVP. External email delivery is a separate integration.

## 8. Lifecycle and workflow gates

Use distinct quote, approval, fulfillment and billing states rather than one overloaded status field.

| Entity | Proposed states |
| --- | --- |
| Quote | Draft, Pending Approval, Revision Requested, Rejected, Approved, Sent, Under Negotiation, Confirmed |
| Approval step | Waiting, Pending, Approved, Rejected, Returned, Superseded |
| Order fulfillment | Unallocated, Reserved, Partially Fulfilled, Backordered, Fulfilled; show shortages separately when partially fulfilled |
| Subscription | Scheduled, Active, Pause Scheduled, Paused, Cancelled; a paused subscription stores its selected resume date |
| Invoice | Draft, Issued; payment status derived as Unpaid, Partially Paid or Paid |

1. Rep saves a draft and submits a specific version for policy evaluation.
2. No-approval quotes become internally approved; otherwise sequential reviewers approve, reject or return the version.
3. Approved terms can be sent to the customer. A rejected quote cannot progress; a revised quote starts a fresh evaluation.
4. Customer requests are proposals. Applying a request creates a new version and rechecks approval; old approvals and acceptance do not transfer.
5. Customer acceptance records identity, timestamp and version. If that version still requires review, display pending internal approval and prevent fulfillment.
6. When the same version is both accepted and policy-cleared, create exactly one order and mark the quote Confirmed.
7. Operations confirms allocations and records dispatch/completion; subscriptions activate on their agreed dates.
8. Eligible events generate invoices. Recorded payments update balances and reports.

After order creation, the accepted quote is immutable. Post-order commercial amendments are outside the MVP except for the explicitly supported subscription modification, cancellation and pause/resume flows.

## 9. Minimum data model

This is a logical model, not a prescribed database schema.

| Entity | Minimum data / relationships |
| --- | --- |
| User / Role | Identity, credentials/provider reference, role, team and active status |
| Customer | Name, tier, contacts, portal-user associations, currency |
| Product / Variant | SKU, category, unit, base price, cost, tax, attributes, surcharge, product type, active status |
| PriceList / Rule | Tier, currency, product/category applicability, adjustment and version |
| DiscountPolicy / ApprovalRule | Tier/category ceilings, risk cutoffs, aggregate ceiling, ordered reviewer assignments and version |
| Quote / QuoteVersion / QuoteLine | Customer/owner, status, version, price/cost/tax snapshots, quantities, discounts, totals, policy result and promised date |
| Approval / ApprovalStep | Quote version, sequence, assigned reviewer/role, decision, reason and timestamps |
| NegotiationRequest / Comment / Acceptance | Quote version, customer, line reference, proposed changes, response and acceptance identity/time |
| Order / OrderLine | Unique accepted quote version, commercial snapshots, physical/service/recurring line classification |
| Warehouse / Stock / StockMovement | SKU, on-hand/reserved quantities, warehouse, replenishment ETA and movement history |
| Allocation / Shipment / ServiceCompletion | Order line, warehouse, reserved/dispatched quantity or completed service, status and timestamp |
| SubscriptionPlan / Subscription | Product/order line, cycle, rate, quantity, activation, billing anchor, cancellation/proration rules, pause request/effective dates, selected resume boundary, transition history and status |
| BillingEvent / Invoice / InvoiceLine | Source delivery/period, charge type, dates, net/tax/total, due date and currency |
| Payment / CreditNote | Invoice/customer, amount, date, reference, reason, application and idempotency key |
| RecommendationRule | Source/target products, relationship weight, promotion and margin threshold |
| Alert / Notification / AuditEvent | Related record, rule/action, actor, event time, reason and before/after or version reference |

Required constraints include unique order per accepted quote version, unique recurring charge per subscription/period, bounded invoiced delivery quantities, and immutable approval/audit history. Store timestamps consistently and display them in the user's timezone. Historical records must survive product archival.

## 10. Non-functional requirements

- **Correctness:** Authoritative server-side calculations and transition guards; UI validation alone is insufficient.
- **Consistency:** Atomic reservation, approval and payment mutations; reject conflicting edits with a clear refresh/retry action.
- **Reliability:** Persist workflows across refresh/restart; retries must not duplicate orders, charges, stock movements or payments.
- **Security:** Hash passwords with a supported authentication library, secure sessions, validate inputs, and enforce customer/role boundaries on endpoints and exports. Portal links, if chosen, expire and cannot expose internal financial data.
- **Audit:** Record actor, timestamp, reason and affected version for pricing edits, approvals, negotiations, inventory changes, subscription changes, credits and payments. Do not log passwords or access tokens.
- **Responsiveness:** Proposed seeded-demo targets: pricing feedback within 500 ms, typical list/detail requests within two seconds, event-driven dashboard updates within five seconds; benchmark on documented demo hardware/data.
- **Usability:** Keyboard-operable controls, labeled inputs, readable errors, text as well as color for risk/status, and no loss of saved work during navigation.
- **Observability:** Log failed business operations with record/correlation IDs and show actionable user errors. A failed billing run remains retryable and visible.

## 11. Implementation sequence and dependencies

This is a proposed sequence for the hackathon context suggested by the sources, not a committed 24-hour estimate.

1. **Foundation:** Authentication, authorization, logical schema and seed customers/catalog/policies/stock/plans.
2. **Quote and governance:** Pricing, discounts, margin, recommendations, versioning and sequential approval screens.
3. **Customer agreement:** Restricted portal, negotiation proposals, acceptance and exactly-once order creation.
4. **Fulfillment and cash:** Allocation/backorders, delivery events, all four subscription cycles, pause/resume transitions, schedules/proration, invoices, credits and payments.
5. **Visibility and validation:** Manual reports/exports, deal-health actions, end-to-end flows, failure/security tests, architecture diagram and demo preparation.
6. **If capacity remains:** Advanced analytics and richer recommendation/replenishment configuration UX.

Critical dependencies: costs for margin, customer tiers and category ceilings for routing, current stock and shipping estimates for allocation, and explicit service dates/cancellation rules for billing. Use deterministic seed data when external integrations are absent; calculations and state transitions must remain real application logic as required by S1 page 10.

## 12. Acceptance scenarios

### A. Governed hybrid order with negotiation and payment

1. Log in with seeded rep, manager, Finance/Operations and customer identities; configure Gold at 15%, Hardware at 15%, Services at 10%, two warehouses and a monthly plan.
2. Build a quote with two $1,200 laptops at 12% discount and one $450 setup service at 18%. Before tax and any upsell, net is `$2,112 + $369 = $2,481`.
3. Verify the service violation is eight percentage points and routes Manager then Finance under the proposed seed policy.
4. Add an eligible upsell. Verify totals, margin and risk recompute from the added product's actual price and cost.
5. Approve the current version through both steps; open the authorized customer portal and request a larger discount.
6. Rep applies the request. Verify a new version, invalidated old approvals and automatically recalculated routing. Approve the new terms and accept that exact version as the customer.
7. Confirm that one order is created. Fulfill physical quantities, complete the service and activate its recurring line; verify delivery-based and recurring invoices remain distinguishable and reconciled.
8. Record invoice payments. Verify balance and Paid status update once, including after a duplicate submission attempt.

### B. Automatic clearance, split delivery, backorder and subscription credit

1. Create an in-policy quote for 24 physical units and a $60 monthly subscription. Verify no human approval is required.
2. Obtain customer acceptance. With 18 available units in Main and four in East, verify allocations total 22 and backorder quantity is two.
3. Attempt an override exceeding stock; verify rejection. Accept a valid allocation and dispatch the 22 units.
4. Verify one-time invoices include only those 22 units, while the subscription bills according to its activation date and period.
5. Restock East by two units. Verify a consolidation prompt for the remaining backorder, then allocate/dispatch and invoice only those two additional units.
6. Change the monthly subscription from $60 to $90 with 15 of 30 days remaining. Verify a $15 pre-tax adjustment and the revised next bill.
7. Apply an immediate cancellation under a prorated-credit policy; verify the credit uses the applicable rate/remaining interval, future billing stops, and a retry creates no duplicate credit.

### C. Cycle-boundary pause/resume, configuration and manual reports

1. Create and activate weekly, monthly, quarterly and yearly subscriptions; verify each next billing date follows its own cycle.
2. On a monthly subscription anchored to the first, request pause on September 15 and select December 1 to resume. Verify pause effective October 1, unchanged September charges, no October/November charges, and one full-period charge on December 1.
3. Enter November 15 as a requested resume date. Verify the UI presents December 1 for confirmation, never a mid-cycle restart. Retry the transition and verify no duplicate invoice.
4. Verify another customer cannot pause or resume this subscription. Cancel a paused subscription and verify its scheduled resume never activates.
5. As Admin, edit the seeded high-risk cutoff and route mapping, preview, and publish. Submit a fresh quote and verify the new route, policy version and audit entry; an existing pending review retains its original policy snapshot.
6. Manually generate a filtered report and export it. Verify matching filters/totals and that no scheduled report generation or delivery exists.

### Required edge cases

| Case | Expected result |
| --- | --- |
| Discount exactly at the allowed limit | No line violation |
| Small excesses across several lines | At least Manager review; blended rule can escalate |
| Order discount pushes an otherwise valid line above its limit | Effective discount detects the breach |
| Finance acts before Manager on a two-step chain | Action denied |
| Reviewer/customer acts on an obsolete version | Conflict shown; no state mutation |
| Same quote confirmation submitted twice | One order only |
| Two orders reserve the last units concurrently | No oversell; losing request receives refreshed availability |
| Billing generation retried for the same period/delivery | No duplicate charge |
| Customer accesses another customer's quote or internal costs | Access denied / sensitive fields absent |
| Missing price, cost, stock policy or approval configuration | Explicit actionable error; no silent unsafe default |
| Subscription changes at a period boundary | No charge for elapsed time; correct new period and rounding |
| Pause becomes effective at an invoice boundary | Transition is processed first; no charge for the paused cycle |
| Selected resume is on/before pause boundary or in the past | Reject with an eligible future-cycle choice |
| Month-end/leap-day billing anchor | Clamp to valid boundary dates without permanently drifting the original anchor |
| Credit plus partial payment | Correct remaining balance and payment status |
| Stalled quote receives a meaningful update | Alert clears on reevaluation |

## 13. Deliverables and definition of done

Source deliverables from S1 page 10:

- Working backend and frontend with representative seed data.
- Five-minute live demo showing at least two full quotation-to-fulfillment or billing flows.
- One-page architecture diagram showing the data model and module connections.
- Short note describing what to build next.

Proposed completion gate: P0 acceptance scenarios and required edge cases pass; no mock approval, allocation or proration outcomes; customer portal isolation is verified; core records survive refresh; remaining P1/deferred items and known limitations are documented. This PRD defines these deliverables; creating them is separate implementation work.

## 14. Decision register and remaining implementation questions

All seven source conflicts are resolved in section 1. Remaining implementation questions below do not reopen those decisions.

| Decision | Proposed default / outstanding choice | Suggested owner |
| --- | --- | --- |
| Risk policy - resolved | Admin-configurable ceilings, thresholds and mappings; section 7.2 supplies initial defaults | Admin |
| Price-list governance | Evaluate discretionary discounts against resolved tier price; confirm whether price-list reductions also count toward policy | Finance |
| Order/billing gate - resolved | Require accepted and approved version; goods on dispatch, services on completion, subscriptions at period start after activation | Sales + Operations + Finance |
| Tax and accounting | Simple configured tax rates and one currency; confirm rounding and credit treatment | Finance |
| Subscription cycles and pause/resume - resolved | Weekly, monthly, quarterly and yearly; pause/resume at billing boundaries with user-selected resume cycle | Product + Finance |
| Other subscription policies | Actual-day proration and configurable cancellation remain proposed defaults for changes other than pause/resume | Finance |
| Access and onboarding | Admin-assigned internal roles and customer-linked identities; choose credentials or magic links | Product + Engineering |
| Approval routing - resolved | Admin-configured risk mappings and reviewer chains are authoritative; absence/delegation UX remains an implementation detail | Admin |
| Reporting - resolved | Manual generation and user-triggered exports included in P0; scheduled report generation/delivery excluded | Product |
| Shipping and delivery | Seeded shipping estimates and promised dates; confirm weighting and service completion evidence | Operations |
| MVP time budget | Hackathon framing is source context; confirm actual deadline and available team capacity | Product |

## 15. Source traceability

| PRD area | Source location |
| --- | --- |
| Problem, goals and roles | S1 pages 1-3 |
| Authentication, catalog, discount/warehouse/plan configuration | S1 pages 3-5; S2 screen 1 and unnumbered configuration screens |
| Workspace, quote builder and approvals | S1 pages 5-6; S2 screens 2-6 |
| Recommendations and fulfillment | S1 pages 6-7; S2 screens 4, 7-8 |
| Subscriptions and portal | S1 pages 7-8; S2 screens 9-11 |
| Invoices and payments | S1 page 11; S2 screens 12-13 |
| Deal health and reports | S1 pages 5, 8-9; S2 screens 14-15 |
| End-to-end flow and deliverables | S1 pages 9-11 |
| Blended-risk rationale | S1 pages 11-12; S2 screens 4, 6 and discount configuration |

The seven resolved decisions in section 1 come from the user's follow-up and delegated choice. Initial risk formulas, data constraints, metrics and other explicitly proposed details are implementation defaults, not verbatim requirements from the source documents.
