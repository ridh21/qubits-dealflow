<p align="center">
  <img src="./public/brand/dealflow-mark.png" alt="DealFlow360 — Qubits" width="150" />
</p>

<h1 align="center">DealFlow360</h1>

<p align="center">
  <em>What you quote is what gets approved, shipped and invoiced.</em>
</p>

<p align="center">
  <strong>A production-grade, full-stack B2B Quote-to-Cash platform where one published policy drives discount ceilings, approval routing, multi-warehouse fulfillment and hybrid one-time + recurring billing — so a deal never drifts between the quote and the invoice.</strong>
</p>

<p align="center">
  <a href="https://github.com/ridh21/qubits-dealflow"><img src="https://img.shields.io/badge/📦_Repository-qubits--dealflow-EA580C?style=for-the-badge&logo=github&logoColor=white" alt="Repository" /></a>
  <a href="./PRD.md"><img src="https://img.shields.io/badge/📄_Product_Requirements-PRD.md-1F2937?style=for-the-badge" alt="PRD" /></a>
  <a href="./docs/assistant.md"><img src="https://img.shields.io/badge/🤖_Read--only_Assistant-docs-6E56CF?style=for-the-badge" alt="Assistant docs" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js" alt="Next.js 16.3" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19.2" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript 5" />
  <img src="https://img.shields.io/badge/PostgreSQL-Prisma_6-3ECF8E?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL + Prisma" />
  <img src="https://img.shields.io/badge/Tailwind-v4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind v4" />
  <img src="https://img.shields.io/badge/Assistant-FastAPI_+_LangGraph-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI assistant" />
  <img src="https://img.shields.io/badge/Currency-INR_·_GST-EA580C?style=for-the-badge" alt="INR + GST" />
</p>

---

## 👥 Meet the Team — Qubits

Built with ❤️ by team Qubits. Every layer of this platform — the policy engine, the allocation solver, the billing scheduler, the portal and the landing page — was designed, coded and shipped by:

<table align="center">
  <tr>
    <td align="center" width="33%">
      <strong>🧑‍💻 Ridham Patel</strong><br />
      <sub>Full-Stack · Architecture · Cloud · DevOps</sub>
    </td>
    <td align="center" width="33%">
      <strong>🧑‍💻 Harsh Dodiya</strong><br />
      <sub>Full-Stack · Schema · Billing & Fulfillment</sub>
    </td>
    <td align="center" width="33%">
      <strong>🧑‍💻 Het Saraiya</strong><br />
      <sub>Full-Stack · Policy Engine · AI Assistant</sub>
    </td>
  </tr>
</table>

---

## 📋 Table of Contents

- [Meet the Team](#-meet-the-team--qubits)
- [Problem Statement](#-problem-statement)
- [What DealFlow360 Does](#-what-dealflow360-does)
- [Architecture](#️-architecture)
- [Libraries & Tech Stack](#️-libraries--tech-stack)
- [Data Model](#️-data-model)
- [User Roles & Permissions](#-user-roles--permissions)
- [Complete User Workflow](#-complete-user-workflow)
  - [Sales Rep](#41-sales-rep)
  - [Sales Manager / Approver](#42-sales-manager--approver)
  - [Finance / Operations](#43-finance--operations)
  - [Customer (Portal)](#44-customer--portal)
  - [Admin](#45-admin)
- [Screens & Features](#-screens--features)
- [Project Structure](#-project-structure)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [Database Seeding](#-database-seeding)
- [End-to-End Demo Script](#-end-to-end-demo-script)
- [Cross-Cutting Features](#️-cross-cutting-features)
- [The Read-Only Assistant](#-the-read-only-assistant)
- [API Guide](#-api-guide)
- [Testing & Validation](#-testing--validation)
- [Deployment](#-deployment)

---

## 🎯 Problem Statement

B2B sales teams negotiate discounts, protect margin, coordinate stock across warehouses, and sell hardware and subscriptions on the same deal. Basic quote-to-invoice tools leave the interesting parts disconnected:

- 🧾 **The quote drifts.** What the rep discounted, what the manager approved and what finance billed are three different numbers.
- 🕵️ **Approvals are opinions.** Nobody can say *why* a deal needed Finance sign-off, or what the ceiling was on the day it was approved.
- 📦 **Stock is a guess.** Splitting an order across warehouses is a spreadsheet exercise, and overselling is discovered at dispatch.
- 🔁 **Hybrid deals break billing.** One-time hardware plus a quarterly subscription means manual prorations, manual credits, manual everything.
- 💬 **Customers negotiate off-platform.** Email threads become the source of truth, and acceptance is never bound to a specific quote version.
- 🚨 **Stalled deals are invisible.** Nobody notices the ₹18L quote that has not moved in three weeks.

**DealFlow360** connects all of it around **one versioned quotation and its resulting order**. A published policy version decides ceilings and routing; the accepted version is hash-bound so terms cannot shift underneath an acceptance; allocation never oversells; billing reconciles to the paisa; and every consequential mutation lands in an append-only audit log with actor, time and reason.

---

## ✨ What DealFlow360 Does

> One platform. Ten modules. One source of truth per deal.

| # | Module | What It Does |
|---|--------|-------------|
| 📝 | **Versioned Quotation Builder** | Multi-line quotes with live pricing, margin and discount feedback. Every submission snapshots an immutable version with a SHA-256 terms hash |
| ⚖️ | **Discount & Risk Engine** | Tier/category/overall ceilings in basis points, excess computed per line and per recurring-cycle bucket, producing a `LOW`/`MEDIUM`/`HIGH` band and a required approval level |
| ✅ | **Sequential Approval Chains** | Admin-configured reviewer chains (`SALES_MANAGER → FINANCE`) with per-role SLA hours, return-for-revision, and a hard block on approving your own quote |
| 🛡️ | **Policy Center** | Six versioned policy kinds — discount/risk, fulfillment, billing, deal health, portal, recommendations — with draft, diff, publish, history and one-click restore |
| 🌐 | **Customer Portal** | Magic-link login, quote review, line-level negotiation proposals, version-bound acceptance, invoices, orders and self-service subscription pause/resume |
| 🚚 | **Multi-Warehouse Fulfillment** | Cost-aware split planner with a shipment-count penalty, warehouse caps, deterministic tie-breaks, reservations, backorders and consolidation suggestions |
| 🔁 | **Subscriptions & Entitlements** | Weekly/monthly/quarterly/yearly plans, tiers, entitlement definitions and overrides, plan-change notices, boundary-safe pause/resume |
| 💰 | **Hybrid Billing Engine** | One-time on dispatch, services on completion, subscriptions per period — plus daily proration, credit notes, auto-applied credits and payment settlement |
| 🚨 | **Deal Health Detectors** | Stalled deals, discount anomalies vs. a 90-day baseline, delivery slippage and approval-SLA breaches, scanned nightly and actionable in-app |
| 📊 | **Reports & Analytics** | Role-scoped analytics views (rep, manager, finance, ops, admin) plus manually generated reports exportable to PDF and XLSX |

Plus a **read-only AI assistant** that turns *"how many quotations are pending approval?"* into SQL, runs it as a `SELECT`-only Postgres role, and answers in a sentence.

---

## 🏗️ Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│            🖥️  Client — Next.js 16.3 (App Router) + React 19          │
│   Internal shell · Customer portal · Marketing site                   │
│   shadcn/ui + Radix · Tailwind v4 · Phosphor icons · Recharts         │
└───────┬────────────────────────┬─────────────────────┬───────────────┘
        │ Server Actions (RSC)   │ Route Handlers      │ POST /api/assistant/query
        ▼                        ▼                     ▼
┌────────────────────────────────────────────┐   ┌──────────────────────────┐
│  ⚙️  Next.js Server                         │   │  🤖 assistant-api        │
│  ├─ runAction()  auth → zod → mutate → rev │   │  FastAPI + LangGraph     │
│  ├─ NextAuth v5  (internal + portal realms)│──▶│  ReAct agent → SQL       │
│  ├─ src/domain/  pure business rules        │   │  statement guard         │
│  ├─ src/server/services/  transactions      │   └───────────┬──────────────┘
│  ├─ Prisma 6 + soft-delete extension        │               │ dealflow_readonly
│  ├─ Append-only AuditLog + Notifications    │               │ (SELECT only)
│  ├─ @react-pdf/renderer · ExcelJS exports   │               │
│  └─ Nodemailer outbox (queued, retried)     │               │
└────────────────────┬───────────────────────┘               │
                     │                                        │
                     ▼                                        ▼
┌──────────────────────────────────────────────────────────────────────┐
│   💾 PostgreSQL 16 — 50 models · 34 enums · 11 migrations             │
│   Local: docker compose (127.0.0.1:55432)  ·  Hosted: Neon / any PG   │
└──────────────────────────────────────────────────────────────────────┘
                     ▲
                     │ Vercel Cron (daily)
        ┌────────────┴────────────────────────────────┐
        │ /api/jobs/billing  · /api/jobs/emails       │
        │ /api/jobs/deal-health                       │
        │ /api/jobs/subscription-transitions          │
        └─────────────────────────────────────────────┘
```

### End-to-End Quote-to-Cash Flow

```
  ┌───────────┐  ┌────────────┐  ┌───────────┐  ┌────────────┐  ┌────────┐
  │ Sales Rep │  │  Manager   │  │  Finance  │  │  Customer  │  │ Admin  │
  └─────┬─────┘  └─────┬──────┘  └─────┬─────┘  └─────┬──────┘  └───┬────┘
        │              │               │              │             │
        │              │               │              │  Publishes  │
        │              │               │              │  policy ────┤
        │              │               │              │  versions   │
        │ 1. Build     │               │              │             │
        │    quote     │               │              │             │
        │    (lines,   │               │              │             │
        │    discounts,│               │              │             │
        │    upsells)  │               │              │             │
        │              │               │              │             │
        │ 2. Submit ──►│  Risk engine snapshots the ACTIVE policy    │
        │              │  version and computes the required level    │
        │              │               │              │             │
        │              │ 3. Approve /  │              │             │
        │              │    Return ───►│ 4. Finance   │             │
        │              │               │    approve   │             │
        │◄─────────────┴───────────────┘              │             │
        │                                              │             │
        │ 5. Send to customer ────────────────────────►│             │
        │                                              │             │
        │◄──── 6. Line-level proposals / comments ─────│             │
        │      (rep accepts → new revision)            │             │
        │                                              │             │
        │◄──── 7. Accept version N (terms-hash bound) ─│             │
        │                                              │             │
        │ 8. Order created ─────────► Fulfillment plan │             │
        │                             (split · reserve │             │
        │                              · backorder)    │             │
        │                                    │         │             │
        │                                    ▼         │             │
        │                            9. Dispatch → invoice (goods)   │
        │                               Service completion → invoice │
        │                               Subscription period → invoice│
        │                                    │         │             │
        │                                    ▼         │             │
        │                           10. Payments · credit notes ·    │
        │                               settlement ───►│ Portal pays │
        │                                              │             │
        │  ⟳  Deal-health detectors watch the whole chain nightly    │
```

### Entity State Machines

| Entity | States |
|--------|--------|
| **Quotation** | `DRAFT → PENDING_APPROVAL → APPROVED → SENT → UNDER_NEGOTIATION → CONFIRMED` <br/>(branches: `REVISION_REQUESTED`, `REJECTED`, `EXPIRED`, `CANCELLED`) |
| **ApprovalRequest** | `PENDING → APPROVED` / `REJECTED` / `RETURNED` / `SUPERSEDED` |
| **ApprovalStep** | Sequential per reviewer role, each with its own SLA clock |
| **Order** | `OPEN → COMPLETED` (or `CANCELLED`) |
| **Order fulfillment** | `UNALLOCATED → RESERVED → PARTIALLY_FULFILLED → FULFILLED` (or `BACKORDERED`) |
| **Backorder** | `OPEN → CONSOLIDATION_SUGGESTED → ALLOCATED` (or `CANCELLED`) |
| **Shipment** | `PLANNED → SHIPPED` |
| **Subscription** | `SCHEDULED → ACTIVE → PAUSE_SCHEDULED → PAUSED → ACTIVE` (or `CANCELLED`) |
| **Invoice** | `DRAFT → ISSUED` (or `VOID`), with payment status `UNPAID → PARTIALLY_PAID → PAID` |
| **BillingScheduleItem** | Scheduled → generated exactly once per period |
| **DealHealthAlert** | Open → acknowledged / auto-resolved on meaningful activity |

### Why the policy engine is versioned

An approval is only defensible if you can reproduce it. When a quote is submitted, DealFlow360 **snapshots the active `PolicyVersion`** onto the approval request. Publishing a new ceiling tomorrow does not retroactively change why yesterday's deal needed Finance — the reviewer chain, the thresholds and the computed excess are all frozen with the decision.

---

## 🛠️ Libraries & Tech Stack

Every dependency below is pulled straight from `package.json` — no aspirational listings.

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.3 | Full-stack React framework (App Router + Server Actions) |
| React | 19.2 | UI library |
| TypeScript | 5 | Type safety across the entire codebase |
| Tailwind CSS | v4 | Utility-first styling (`@tailwindcss/postcss`) |
| shadcn/ui | 4.21 | Component layer generated into `src/components/ui` |
| Radix UI | 1.6 | Unstyled accessible primitives (dialog, popover, select, sidebar) |
| @phosphor-icons/react | 2.1 | Icon set, re-exported through `src/components/icons.ts` |
| Recharts | 3.8 | Analytics and reporting charts |
| @tanstack/react-table | 9.2 | Headless table engine behind the data tables |
| React Hook Form + Zod | 7.87 / 4.5 | Form state and schema validation (shared with the server) |
| react-day-picker | 10.0 | Date-range pickers for report and list filters |
| react-hot-toast | 2.6 | Toast notifications |
| cmdk | 1.1 | Command palette primitives |
| next-themes | 0.4 | Theme provider (the product ships light-mode only) |
| tw-animate-css · class-variance-authority · tailwind-merge | — | Variant and animation utilities |

### Backend & Data

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js Server Actions | — | The mutation API — there is no separate REST tier |
| NextAuth v5 | 5.0.0-beta | Two auth realms: internal credentials + customer portal magic links |
| @auth/prisma-adapter | 2.11 | Session and verification-token persistence |
| Prisma | 6.19 | ORM, migrations, and the soft-delete client extension |
| PostgreSQL | 16 | Primary relational database (Docker locally, Neon/any PG hosted) |
| decimal.js | 10.6 | Exact money math — integer minor units and basis points |
| bcryptjs | 3.0 | Password hashing |
| Nodemailer | 9.1 | SMTP delivery behind a queued `EmailMessage` outbox |
| @react-pdf/renderer | 4.9 | Invoice and report PDF documents |
| ExcelJS | 4.4 | XLSX report workbooks |
| date-fns + date-fns-tz | 4.4 / 3.2 | IST-correct period math and display |
| nanoid | 6.0 | Token and identifier generation |

### AI Assistant Service (`services/assistant`)

| Technology | Purpose |
|------------|---------|
| FastAPI (Python 3.12) | `/query` and `/health` endpoints, bound to `127.0.0.1` |
| LangGraph ReAct agent | Writes the SQL and narrates the answer |
| OpenCode gateway (OpenAI-compatible) | LLM provider with an ordered fallback model chain |
| `dealflow_readonly` Postgres role | `SELECT`-only, `default_transaction_read_only`, 15s statement timeout |
| Docker Compose | `compose.dev.yml` + `compose.assistant.yml` |

### Tooling & Infrastructure

| Technology | Purpose |
|------------|---------|
| pnpm 11.2 | Package manager (version pinned in `package.json`) |
| Vitest 5 | Unit and PostgreSQL integration suites |
| Playwright 1.62 | End-to-end browser tests |
| ESLint 9 + `eslint-config-next` | Linting |
| Vercel + Vercel Cron | Hosting and the daily billing / email / deal-health jobs |
| Docker Compose | Local Postgres 16 on `127.0.0.1:55432` |

---

## 🗄️ Data Model

**50 models, 34 enums, 11 migrations** — a fully relational PostgreSQL schema managed by Prisma, with a soft-delete extension layered over the client.

```
                          ┌──────────┐
              Team ───────│   User   │──────── AuditLog (append-only)
                          └────┬─────┘
                               │ owns
   Customer ──── PortalUser    │
      │  │                     │
      │  └────────────► Quotation ──── QuotationLine
      │                    │  │
      │                    │  ├── QuotationVersion  (immutable snapshot + termsHash)
      │                    │  ├── QuoteAcceptance   (binds a version)
      │                    │  ├── NegotiationMessage (+ line proposals)
      │                    │  └── ApprovalRequest ── ApprovalStep
      │                    │            └── snapshots PolicyVersion
      │                    ▼
      │                  Order ──── OrderLine
      │                    │           │
      │                    │           ├── FulfillmentPlan ── Allocation ── StockLevel
      │                    │           ├── Backorder                      └── Warehouse
      │                    │           └── Shipment ── ShipmentLine        └── StockMovement
      │                    │           └── ServiceCompletion               └── ReplenishmentPlan
      │                    │
      │                    ├── Subscription ── SubscriptionTransition
      │                    │        │             BillingScheduleItem
      │                    │        └── SubscriptionPlan ── PlanTier
      │                    │                 └── EntitlementDefinition ── EntitlementValue
      │                    │                 └── PlanChangeNotice
      │                    ▼
      └──────────────► Invoice ──── InvoiceLine
                          │  │
                          │  ├── Payment
                          │  └── CreditNote ── CreditApplication
                          │
   Product ── Category ── VariantAttribute ── VariantValue
      └── PriceList ── PriceListItem
      └── UpsellRule

   PolicyVersion · Setting · NumberSequence · Notification · EmailMessage · DealHealthAlert
```

### Key Models

| Model | Description |
|-------|-------------|
| `User` | Internal staff and portal identities; `Role` ∈ `PENDING · ADMIN · SALES_REP · SALES_MANAGER · FINANCE · CUSTOMER` |
| `Team` | Sales team grouping used by manager-scoped analytics |
| `Customer` | Account with `CustomerTier` (`BRONZE`/`SILVER`/`GOLD`), currency (INR) and portal contact |
| `Product` / `Category` | Catalog with `ProductType` (physical / service / subscription) and variant attributes |
| `PriceList` / `PriceListItem` | Tier- and customer-assignable price books with `PriceRule` resolution |
| `PolicyVersion` | Versioned, published JSON payload per `PolicyKind` — the governing configuration |
| `Quotation` / `QuotationLine` | The working deal: lines, discounts in basis points, computed `RiskBand` |
| `QuotationVersion` | Immutable per-submission snapshot with a canonical SHA-256 `termsHash` |
| `QuoteAcceptance` | Customer acceptance bound to one specific version — a later revision cannot be silently accepted |
| `ApprovalRequest` / `ApprovalStep` | Sequential reviewer chain, per-step SLA, decision reasons, supersession on revision |
| `NegotiationMessage` | Portal thread with structured line-level `ProposalStatus` proposals |
| `Order` / `OrderLine` | Confirmed commercial terms; fulfillment status tracked per line |
| `Warehouse` / `StockLevel` / `StockMovement` | Multi-warehouse inventory with an auditable movement ledger |
| `FulfillmentPlan` / `Allocation` / `Backorder` | The split plan, its reservations, and unfulfilled remainder |
| `Shipment` / `ShipmentLine` / `ServiceCompletion` | Dispatch and service-completion events that trigger billing |
| `SubscriptionPlan` / `PlanTier` | Weekly, monthly, quarterly and yearly plans with proration and cancellation rules |
| `EntitlementDefinition` / `EntitlementValue` | Plan entitlements with per-subscription overrides and publishable change notices |
| `Subscription` / `SubscriptionTransition` | Lifecycle including boundary-safe pause and scheduled resume |
| `BillingScheduleItem` | The exactly-once ledger that prevents double-invoicing a period |
| `Invoice` / `InvoiceLine` / `Payment` | GST-aware invoices in paise, with derived `balance` and `PaymentStatus` |
| `CreditNote` / `CreditApplication` | Proration and cancellation credits, optionally auto-applied |
| `DealHealthAlert` | `STALLED · DISCOUNT_ANOMALY · DELIVERY_SLIPPAGE · APPROVAL_SLA` |
| `Notification` | Per-user inbox entries with deep links |
| `EmailMessage` | Outbox row — queued, sent, failed, with retry accounting |
| `AuditLog` | Append-only: actor, actor type, entity, action, version, before/after JSON, reason |
| `NumberSequence` | Atomic `UPDATE … RETURNING` allocation for `Q-`, `ORD-`, `INV-`, `CN-`, `SHP-` codes |

---

## 🔐 User Roles & Permissions

RBAC is enforced **at the layout level**, **at every server action** (`runAction({ roles })` → `requireRole`), and **at the query level** (ownership scoping), not just in the UI. New signups land on `PENDING` and see `/pending` until an admin assigns a role.

```
ADMIN  ·  FINANCE  ·  SALES_MANAGER  ·  SALES_REP  ·  CUSTOMER (portal realm)
                                                      PENDING (no access)
```

| Permission | Admin | Sales Rep | Manager | Finance | Customer |
|------------|:-----:|:---------:|:-------:|:-------:|:--------:|
| Create & revise quotations | ✅ | ✅ (own) | ✅ (team) | ❌ | ❌ |
| See cost, margin and internal risk notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Submit a quote for approval | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve / reject / return a quote | ✅ | ❌ | ✅ | ✅ | ❌ |
| Approve **your own** quote | ❌ | ❌ | ❌ | ❌ | ❌ |
| Send a quote to the customer | ✅ | ✅ | ✅ | ❌ | ❌ |
| Review a quote & propose line changes | ❌ | ❌ | ❌ | ❌ | ✅ |
| Accept a quote version | ❌ | ❌ | ❌ | ❌ | ✅ |
| Plan / override warehouse splits | ✅ | ❌ | ❌ | ✅ | ❌ |
| Ship, receive and adjust stock | ✅ | ❌ | ❌ | ✅ | ❌ |
| Record service completion | ✅ | ❌ | ❌ | ✅ | ❌ |
| Generate invoices & run billing | ✅ | ❌ | ❌ | ✅ | ❌ |
| Record payments & issue credit notes | ✅ | ❌ | ❌ | ✅ | ❌ |
| Modify / cancel a subscription | ✅ | ❌ | ❌ | ✅ | ❌ |
| Pause / resume own subscription | ❌ | ❌ | ❌ | ❌ | ✅ |
| Publish & restore policy versions | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage users, teams & role assignment | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage catalog, price lists, warehouses, plans | ✅ | ❌ | ❌ | ⚠️ stock only | ❌ |
| Deal-health alerts & nudges | ✅ | ✅ (own) | ✅ (team) | ✅ | ❌ |
| Reports & exports (PDF / XLSX) | ✅ | ✅ (own) | ✅ (team) | ✅ | ❌ |
| Analytics views | all | `rep` | `rep`, `manager` | `finance`, `ops` | ❌ |
| Read-only AI assistant | ✅ | ✅ | ✅ | ✅ | ❌ |
| Full audit log | ✅ | ❌ | ❌ | ❌ | ❌ |

> **Boundary that matters:** administrative access does **not** silently bypass approval policy, and the customer realm is a separate NextAuth instance (`/api/portal-auth`) whose queries are scoped to one `customerId` at the query-builder level (`src/server/portal/select.ts`).

---

## 🔄 Complete User Workflow

### 4.1 Sales Rep

**Purpose:** Build and revise deals, respond to customer negotiation, and drive quotes to confirmation.

#### Step 1 — Start a quote

1. Go to `/quotations` → **New quotation**.
2. Pick the customer (tier drives the applicable price list and discount ceiling) — or start a draft without one and attach the customer later.
3. Add lines: product, variant, quantity, and a discount in basis points (`1250 bp = 12.50 %`).
4. Pricing resolves live through `src/domain/pricing/` — list price → price-list rule → discount → line net → order net.

#### Step 2 — Watch the risk read-out

As you edit, the discount/risk engine evaluates against the **active** policy version:

- Per-line **excess** over the applicable ceiling (tier, category, or overall)
- Recurring lines bucketed by cycle (`WEEKLY`/`MONTHLY`/`QUARTERLY`/`YEARLY`) so a monthly discount is never compared against a one-time one
- **Worst excess**, **blended excess** and **overall excess**, matched against the routing rules
- A resulting `RiskBand` and **required approval level**, with plain-English explanations for each fired rule

Upsell recommendations surface alongside, ranked by policy weight with a promoted-product boost and an optional minimum-margin filter.

#### Step 3 — Submit for approval

Click **Submit**. The server:

1. Validates the submission (zero-price lines rejected if policy says so).
2. Writes an immutable `QuotationVersion` with a canonical SHA-256 `termsHash`.
3. **Snapshots the active `PolicyVersion`** onto the approval request.
4. Builds the sequential `ApprovalStep` chain and starts the first reviewer's SLA clock.
5. Notifies the reviewers, and writes audit rows for the version and the request.

The quote moves to `PENDING_APPROVAL`. **Withdraw** returns it to `DRAFT` and supersedes the open request.

#### Step 4 — Handle a return

A reviewer can **return** instead of rejecting. The quote becomes `REVISION_REQUESTED` with the reviewer's reason attached; **Revise** opens a new editable revision and the prior approval is marked `SUPERSEDED`.

#### Step 5 — Send to the customer

Once `APPROVED`, click **Send to customer**. A magic-link email is queued to the portal contact and the quote becomes `SENT`.

#### Step 6 — Negotiate

Customer proposals arrive on the quote's negotiation thread. Per proposal you can:

- **Accept** → the line change is applied into a new revision (which re-enters approval if it breaches a ceiling)
- **Decline** → with a reason the customer sees in the portal

#### Step 7 — Confirmation

When the customer accepts version *N*, the acceptance is checked against the current `termsHash`. On success the quote becomes `CONFIRMED` and an `Order` is created — exactly once, even under concurrent acceptance.

---

### 4.2 Sales Manager / Approver

**Purpose:** Clear or return the deals routed to you, and keep the team's pipeline healthy.

1. **`/approvals`** — your queue, scoped to the steps assigned to your role, with SLA countdown, quote value, discount and risk band.
2. **`/approvals/[id]`** — the decision surface:
   - The full quotation snapshot at the submitted version
   - The **policy that was active at submission** — ceilings, thresholds and reviewer chain as they stood
   - Line-by-line excess with the exact rules that fired and why
   - Every prior step's decision, actor, timestamp and reason
3. **Decide:**
   - **Approve** → the next step in the chain opens (or the quote becomes `APPROVED` if you were the last reviewer)
   - **Reject** → the quote is `REJECTED` with your reason
   - **Return** → the quote is `REVISION_REQUESTED` and goes back to the rep
4. A reason is required on every decision, and `blockOwnQuoteApproval` prevents you from clearing a quote you own.
5. **`/analytics`** (`manager` view) — team performance, discount/margin scatter, approval workload and turnaround, pipeline stage distribution, confirmed value by owner.
6. **`/deal-health`** — stalled deals and discount anomalies across the team, with nudge actions that are themselves audited.

---

### 4.3 Finance / Operations

**Purpose:** Turn confirmed orders into shipped goods and reconciled cash.

#### Fulfillment

1. **`/fulfillment`** lists orders by fulfillment status. Open one at **`/fulfillment/[id]`**.
2. **Recompute plan** runs the split planner against live stock:
   - Minimises total cost = fixed shipment cost + weighted shipping cost + a per-extra-shipment penalty (default ₹15.00)
   - Respects `maxWarehousesPerOrder` (default 3)
   - Deterministic tie-break by warehouse `PRIORITY` or `CODE`
   - Anything unservable becomes a `Backorder` rather than an oversell
3. **Override** individual allocations by hand when the plan needs a human call.
4. **Reserve** commits the allocation against `StockLevel`; **Ship** creates the `Shipment` and its lines, writes `StockMovement` rows, and — for physical goods — **generates the invoice on dispatch**.
5. **Complete service** records a `ServiceCompletion`, which invoices service lines.
6. **Consolidation suggestions** appear when a replenishment plan would clear several open backorders together; accept or decline, both audited.

#### Billing & cash

1. **`/invoices`** — issued invoices with derived balance and `PaymentStatus`. `/invoices/[id]` shows lines, GST, payments, applied credits and a **PDF** download (`/api/export/invoice/[id]/pdf`).
2. **Record payment** — partial payments settle to `PARTIALLY_PAID`; overpayment is rejected and concurrent duplicate payments are de-duplicated.
3. **Credit notes** — proration and cancellation credits are issued automatically by policy and can be auto-applied to open invoices.
4. **`/subscriptions`** and `/subscriptions/[id]`:
   - **Preview change** shows the exact proration before you commit
   - **Modify** quantity, tier or cycle; **Cancel** with `NONE` / `PRORATED_CREDIT` / `FULL_CREDIT` per policy
   - The billing schedule shows every future period, generated exactly once
5. **`/admin/jobs`** — billing-run history with correlation IDs, plus a manual **retry** for a failed run.

---

### 4.4 Customer — Portal

**Purpose:** Review, negotiate and accept — without ever seeing cost, margin or another customer's data.

> The portal is a **separate auth realm**. Every portal query is built through a customer-scoped selector, so cross-tenant reads are impossible by construction, not by convention.

1. **Log in** at `/portal/login` — enter your email, receive a **magic link** valid for 15 minutes (configurable via the portal policy), and land on `/portal`.
2. **`/portal`** — your quotations. Open one at `/portal/quotations/[id]`:
   - Line items, quantities, net prices and totals in ₹ — **no cost or margin**
   - **Propose changes** on specific lines, or leave a comment on the thread
   - **Accept** the current version — the acceptance is bound to that version's terms hash, so a quote that changes underneath you cannot be accepted by accident
   - An open proposal blocks acceptance until it is resolved or withdrawn
3. **`/portal/orders`** and `/portal/orders/[id]` — fulfillment progress, shipments and backorders for your own orders.
4. **`/portal/invoices`** and `/portal/invoices/[id]` — issued invoices with lines, balance and recorded payments.
5. **`/portal/subscriptions`** — **pause** and choose a **resume** billing cycle. A pause takes effect at the next billing-cycle boundary and resume at the boundary you pick: no mid-period interruption and no mid-period proration.
6. **`/portal/messages`** — every negotiation thread in one place.
7. **`/portal/profile`** — your contact details.

**What a customer cannot do:** see costs, margins, internal risk notes, other customers, configuration, or any internal route. Accept an obsolete version. Edit terms through a proposal (proposals are requests, not edits).

---

### 4.5 Admin

**Purpose:** Own the configuration that everything else obeys.

1. **`/admin`** — platform overview: pending users, policy state, job health, email outbox status.
2. **`/admin/users`** — approve `PENDING` signups, assign roles, activate/deactivate, manage teams.
3. **`/admin/customers`** — customer accounts, tiers, price-list assignment, and **portal user invitations**.
4. **`/admin/products`** — catalog, categories, variant attributes and values, product status.
5. **`/admin/price-lists`** — price books, per-item rules, and bulk **copy prices** between lists.
6. **`/admin/warehouses`** — warehouses, priorities, shipping costs, stock levels, reorder points, replenishment plans, receive and adjust.
7. **`/admin/policy`** — the **Policy Center**, one page per kind:

   | Policy | What it governs | Notable defaults |
   |--------|-----------------|------------------|
   | **Discount & risk** | Tier/category/overall ceilings, routing rules, reviewer chain, SLA hours | `BRONZE 5% · SILVER 10% · GOLD 15%`, chain `SALES_MANAGER → FINANCE`, SLA `24h / 48h` |
   | **Fulfillment** | Shipment penalty, max warehouses, tie-break, preview-before-confirmation | `₹15.00 penalty`, `3 warehouses`, `PRIORITY` |
   | **Billing** | Invoice due days, proration, cancellation rule, credit auto-apply, schedule horizon | `14 days`, `DAILY`, `PRORATED_CREDIT`, `12 periods` |
   | **Deal health** | Stalled threshold, anomaly delta/samples/lookback, slippage window, SLA alerts | `7 days`, `10% delta / 5 samples / 90 days`, `3 days` |
   | **Portal** | Quote validity, auto-apply proposals, allow pause/resume, magic-link lifetime | `30 days`, `off`, `on`, `15 minutes` |
   | **Recommendations** | Max suggestions, promoted boost, promotions, min-margin enforcement, rules | `5`, `2×`, `enforce` |

   Each page has a **draft → diff → publish** flow, a **simulator** (drop in a real quote and see how a draft would have routed it), a full **version history** at `/admin/policy/history/[kind]`, and one-click **restore** of any prior version.
8. **`/admin/plans`** — subscription plans, tiers, entitlement definitions and values, with a **preview publish** that lists exactly which subscribers get which `PlanChangeNotice` before you commit.
9. **`/admin/emails`** — the outbox: queued, sent and failed messages with error detail.
10. **`/admin/jobs`** — billing/transition run history, correlation IDs and manual retry.

---

## 📱 Screens & Features

### Public & auth

| Route | Access | Purpose |
|-------|--------|---------|
| `/` | Public | Marketing landing page — hero, flow, pricing, FAQ |
| `/login` | Public | Internal email + password sign-in |
| `/signup` | Public | Self-signup → lands on `PENDING`, no privileges |
| `/pending` | `PENDING` | Waiting room until an admin assigns a role |
| `/portal/login` | Public | Customer magic-link request |
| `/portal/login/verify` | Public | Magic-link consumption (Route Handler — it sets the cookie) |
| `/portal/q/[token]` | Public | Shared quote link entry point |

### Internal workspace

| Route | Role Access | Purpose |
|-------|------------|---------|
| `/dashboard` | Internal | Role-aware KPIs, open work, alerts |
| `/quotations` | Internal | Quotation list with status/owner/risk filters and pagination |
| `/quotations/new` | Rep, Manager, Admin | Create a quotation |
| `/quotations/[id]` | Internal | Builder: lines, pricing, risk read-out, versions, negotiation, upsells |
| `/approvals` | Manager, Finance, Admin | Approval queue scoped to your role's steps |
| `/approvals/[id]` | Manager, Finance, Admin | Snapshot, fired rules, chain history, approve / reject / return |
| `/fulfillment` | Finance, Admin | Orders by fulfillment status |
| `/fulfillment/[id]` | Finance, Admin | Split plan, allocations, overrides, reserve, ship, backorders |
| `/subscriptions` | Finance, Admin | Subscription list with lifecycle state |
| `/subscriptions/[id]` | Finance, Admin | Schedule, transitions, entitlements, modify / cancel with preview |
| `/invoices` | Internal | Invoice list with balance and payment status |
| `/invoices/[id]` | Internal | Lines, GST, payments, credits, PDF export |
| `/deal-health` | Internal | Alert board: stalled, anomaly, slippage, SLA — with nudge actions |
| `/reports` | Internal (scoped) | Manually generated reports + PDF / XLSX export |
| `/analytics` | Internal (scoped) | `rep` · `manager` · `finance` · `ops` · `admin` chart views |

### Admin

| Route | Purpose |
|-------|---------|
| `/admin` | Platform overview |
| `/admin/users` | Users, roles, teams, pending approvals |
| `/admin/customers` · `/admin/customers/[id]` | Customers, tiers, portal invitations |
| `/admin/products` · `/admin/products/[id]` | Catalog, categories, variants |
| `/admin/price-lists` · `/admin/price-lists/[id]` | Price books and item rules |
| `/admin/warehouses` · `/admin/warehouses/[id]` | Warehouses, stock, reorder points, replenishment |
| `/admin/policy` + 6 kind pages | Policy Center: edit, simulate, diff, publish |
| `/admin/policy/history/[kind]` | Version history and restore |
| `/admin/plans` · `/admin/plans/[productId]` | Plans, tiers, entitlements, change notices |
| `/admin/emails` | Email outbox |
| `/admin/jobs` | Billing job runs and retries |

### Customer portal

| Route | Purpose |
|-------|---------|
| `/portal` | My quotations |
| `/portal/quotations/[id]` | Review, propose, accept |
| `/portal/orders` · `/portal/orders/[id]` | Fulfillment progress |
| `/portal/invoices` · `/portal/invoices/[id]` | Invoices, balance and payments |
| `/portal/subscriptions` · `/portal/subscriptions/[id]` | Pause / resume at cycle boundaries |
| `/portal/messages` | Negotiation threads |
| `/portal/profile` | Contact details |

---

## 📁 Project Structure

```
qubits-dealflow/
├── prisma/
│   ├── schema.prisma            # 50 models, 34 enums
│   ├── migrations/              # 11 migrations (incl. soft-delete partial uniques, FK indexes)
│   ├── sql/readonly-role.sql    # creates the SELECT-only assistant role
│   ├── seed.ts                  # orchestrates the five seed modules
│   └── seed/
│       ├── base.ts              # teams, internal users, customers, portal users
│       ├── catalogue.ts         # products, price lists, warehouses, stock
│       ├── policy.ts            # initial PRD policy defaults, published
│       ├── plans.ts             # subscription plans, tiers, entitlements
│       └── demo.ts              # quotations, approvals, orders, subs, invoices, alerts
│
├── src/
│   ├── app/
│   │   ├── (marketing)/         # landing page
│   │   ├── (auth)/              # login · signup · pending · portal login + verify
│   │   ├── (internal)/          # authenticated staff shell (+ assistant widget)
│   │   │   ├── dashboard · quotations · approvals · fulfillment
│   │   │   ├── subscriptions · invoices · deal-health · reports · analytics
│   │   │   └── admin/           # users · customers · products · price-lists
│   │   │                        # warehouses · policy · plans · emails · jobs
│   │   ├── (portal)/portal/     # customer realm
│   │   └── api/
│   │       ├── auth/[...nextauth]/        # internal credentials realm
│   │       ├── portal-auth/[...nextauth]/ # customer magic-link realm
│   │       ├── assistant/query/           # auth-checked proxy to the FastAPI agent
│   │       ├── export/invoice/[id]/pdf/   # invoice PDF stream
│   │       ├── export/report/[format]/    # report PDF / XLSX
│   │       └── jobs/                      # billing · emails · deal-health · transitions
│   │
│   ├── domain/                  # pure, testable business rules — no I/O
│   │   ├── money/               # minor units, basis points, proportional allocation
│   │   ├── pricing/             # price resolution, limits, submission validation
│   │   ├── risk/                # discount-risk evaluation → required approval level
│   │   ├── policy/              # zod schemas, defaults, diffs, simulators
│   │   ├── split/               # cost-aware multi-warehouse allocation planner
│   │   ├── proration/           # period math and daily proration
│   │   ├── subscription/        # boundary-safe pause / resume
│   │   ├── billing/             # invoice lines, credit application, payment status
│   │   ├── entitlements/        # effective values, diffs, notice text
│   │   ├── health/              # stalled · anomaly · slippage detectors
│   │   ├── quotation/           # terms hash, list params, invariants
│   │   ├── upsell/ · analytics/ · reports/ · approval/ · boundaries/
│   │   └── errors.ts            # typed domain errors → friendly action errors
│   │
│   ├── server/
│   │   ├── actions/             # "use server" mutations, one file per module
│   │   │   ├── run-action.ts    # the shared auth → validate → mutate → revalidate boundary
│   │   │   └── admin/           # catalog, users, warehouses, price lists, customers
│   │   ├── services/            # transactional orchestration (26 services)
│   │   ├── queries/             # read models: lists, detail, dashboard, analytics
│   │   ├── auth/                # NextAuth config, guards, portal magic links
│   │   ├── portal/select.ts     # customer-scoped query builders (tenant isolation)
│   │   ├── email/               # outbox + nodemailer adapter
│   │   ├── pdf/                 # invoice and report documents
│   │   ├── exports/             # ExcelJS workbooks + response helpers
│   │   ├── jobs/authorize.ts    # shared-secret guard for cron endpoints
│   │   ├── soft-delete.ts       # Prisma client extension
│   │   ├── sequences.ts         # atomic Q- / ORD- / INV- / CN- / SHP- numbering
│   │   ├── audit.ts · events.ts · list.ts · db.ts
│   │
│   ├── components/
│   │   ├── ui/                  # shadcn/ui primitives
│   │   ├── layout/              # AppShell, sidebar nav, KPI tile, status badge, money
│   │   ├── data-table/ · filters/ · forms/
│   │   ├── marketing/           # hero, flow, pricing, FAQ, footer, wordmark
│   │   ├── assistant/           # the read-only assistant widget
│   │   └── brand-mark.tsx       # the shared handshake-and-growth mark
│   │
│   └── lib/
│       ├── datetime-ist.ts      # every displayed timestamp is IST
│       ├── activity-sentence.ts # audit rows → readable sentences
│       └── zod-schemas/         # shared client + server validation
│
├── services/assistant/          # FastAPI + LangGraph read-only agent
│   ├── app/{server,graph,readonly,db,schema_digest,prompt,settings}.py
│   ├── tests/ · Dockerfile · pyproject.toml
│
├── tests/                       # PostgreSQL integration suites (17 files)
├── docs/                        # assistant.md · implementation-status.md · audits
├── scripts/assistant-readonly.sh
├── compose.dev.yml · compose.assistant.yml · compose.test.yml
├── vercel.json                  # daily cron: billing · emails · deal-health
└── PRD.md                       # the product requirements document
```

---

## ⚡ Quick Start

> A fully seeded platform running locally in under five minutes.

### Prerequisites

- **Node.js ≥ 20**
- **pnpm 11.2** (`npm install -g pnpm@11.2.2` — the version is pinned in `package.json`)
- **Docker** (for the local Postgres 16) — or any PostgreSQL instance / Neon project
- SMTP credentials — optional; without them, mail queues in the outbox instead of sending

### 1 · Clone & install

```bash
git clone https://github.com/ridh21/qubits-dealflow.git
cd qubits-dealflow
pnpm install --frozen-lockfile
cp .env.example .env
```

### 2 · Start the database

```bash
pnpm db:up      # postgres 16 on 127.0.0.1:55432, waits until healthy
```

The container uses user `dealflow`, password `dealflow_dev`, database `dealflow_dev` — already the default in `.env.example`. Data lives in the `dealflow_pgdata` volume and survives restarts.

> Using Neon or another hosted Postgres instead? Set `DATABASE_URL` and `DIRECT_URL` in `.env` and skip `pnpm db:up`.

### 3 · Migrate & seed

```bash
pnpm db:setup   # prisma migrate deploy && tsx prisma/seed.ts
```

The seed is idempotent — demo rows are purged and recreated — so re-run it any time with `pnpm db:seed`.

### 4 · Run the app

```bash
pnpm dev
# → http://localhost:3000
```

Sign in at `/login` with any seeded account (see [Database Seeding](#-database-seeding)).

### 5 · (Optional) Run the AI assistant

```bash
pnpm assistant:grant   # create the SELECT-only dealflow_readonly role
pnpm assistant:up      # build + start the FastAPI agent on port 8000
```

Then use the bubble in the bottom-right of any internal page. See [The Read-Only Assistant](#-the-read-only-assistant).

### Useful commands

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Next.js dev server |
| `pnpm build` / `pnpm start` | Production build / serve (`build` runs `prisma generate` first) |
| `pnpm db:up` / `pnpm db:down` | Start / stop the local Postgres container |
| `pnpm db:setup` | Migrate + seed in one step |
| `pnpm db:seed` | Re-run the seed only |
| `pnpm db:migrate` | Create a new migration |
| `pnpm db:reset` | Drop, re-migrate and re-seed |
| `pnpm db:studio` | Browse the data in Prisma Studio |
| `pnpm test` / `pnpm test:watch` | Vitest unit suite |
| `pnpm typecheck` / `pnpm lint` | `tsc --noEmit` / ESLint |
| `pnpm e2e` | Playwright end-to-end tests |
| `pnpm assistant:up` / `:down` / `:logs` / `:test` | Assistant service lifecycle |

---

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|:--------:|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (pooled) |
| `DIRECT_URL` | ✅ | Direct connection used by Prisma Migrate |
| `AUTH_SECRET` | ✅ | NextAuth signing secret — `openssl rand -base64 32` |
| `AUTH_URL` / `NEXTAUTH_URL` | ⚠️ | Canonical app URL (required behind a proxy or on a custom domain) |
| `AUTH_TRUST_HOST` | ⚠️ | Set when running behind a reverse proxy |
| `JOBS_SECRET` | ⚠️ | Shared secret required by every `/api/jobs/*` endpoint |
| `CRON_SECRET` | ⚠️ | Vercel Cron authorization for the scheduled job runs |
| `ADMIN_BOOTSTRAP_EMAIL` | ⚠️ | Email promoted to `ADMIN` on first boot |
| `BCRYPT_SALT_ROUNDS` | ➖ | Password hashing cost (defaults to 10) |
| `JWT_SECRET` · `JWT_EXPIRES_IN` · `JWT_REFRESH_SECRET` · `JWT_REFRESH_EXPIRES_IN` | ➖ | Token lifetimes |
| `SMTP_HOST` · `SMTP_PORT` · `SMTP_SECURE` · `SMTP_USER` · `SMTP_PASS` | ⚠️ | SMTP transport — **without `SMTP_HOST` mail stays queued in the outbox** |
| `SMTP_FROM` / `EMAIL_FROM` | ⚠️ | Sender address (falls back to `no-reply@dealflow360.app`) |
| `MAX_FILE_SIZE` · `CLOUDINARY_*` | ➖ | Upload limits and provider credentials |
| `ASSISTANT_URL` | ➖ | FastAPI assistant base URL (default `http://127.0.0.1:8000`) |
| `ASSISTANT_SERVICE_KEY` | ➖ | Shared secret between the Next.js proxy and the assistant |
| `ASSISTANT_DATABASE_URL` | ➖ | Connection string for the **`dealflow_readonly`** role — never the app role |
| `ASSISTANT_DB_PASSWORD` | ➖ | Password used by `pnpm assistant:grant` |
| `ASSISTANT_MAX_RESULT_ROWS` | ➖ | Row ceiling handed back to the model (default 30) |
| `LLM_BASE_URL` · `LLM_API_KEY` · `LLM_MODEL` · `LLM_FALLBACK_MODELS` | ➖ | OpenAI-compatible gateway and its ordered fallback chain |
| `TEST_DATABASE_URL` | ➖ | **Disposable** database for the integration suites — never the app database |

✅ required · ⚠️ required for that feature to work · ➖ optional

---

## 🌱 Database Seeding

`pnpm db:seed` builds a complete INR/GST demo workspace across five modules.

### Internal accounts

All internal users share the password **`Password123!`**.

| Role | Name | Email |
|------|------|-------|
| `ADMIN` | Arjun Malhotra | `arjun.admin@yopmail.com` |
| `SALES_MANAGER` | Vikram Desai | `vikram.manager@yopmail.com` |
| `SALES_MANAGER` | Kavya Iyer | `kavya.manager@yopmail.com` |
| `FINANCE` | Priya Raghavan | `priya.finance@yopmail.com` |
| `SALES_REP` | Rahul Verma | `rahul.rep@yopmail.com` |
| `SALES_REP` | Sneha Kulkarni | `sneha.rep@yopmail.com` |
| `SALES_REP` | Imran Sheikh | `imran.rep@yopmail.com` *(deactivated — tests the disabled path)* |
| `PENDING` | Neha Joshi | `neha.newjoiner@yopmail.com` *(awaiting role assignment)* |

### Portal accounts

Customers sign in through the **magic link** at `/portal/login` — no password.

| Customer | Tier | Portal contact |
|----------|------|----------------|
| Sharma Industries | 🥇 GOLD | `aarav.sharma@yopmail.com` |
| Mehta Logistics | 🥈 SILVER | `ananya.mehta@yopmail.com` |
| Gupta Retail | 🥉 BRONZE | `rohan.gupta@yopmail.com` |
| Reddy Systems | 🥇 GOLD | `deepa.reddy@yopmail.com` |
| + Iyer Pharma, Chettiar Freight, Patil Agro, Nair Foods *(no contact — edge case)*, Bose Textiles *(inactive — edge case)* | | |

> 💡 Every demo address is `@yopmail.com` — open any of them at [yopmail.com](https://yopmail.com) to read outbound mail without creating an account.

### What else gets created

- **Catalogue** — products across physical / service / subscription types, 5 price lists, 3 warehouses and their stock rows
- **Policy** — all six policy kinds published at the PRD defaults, with an initial audit entry
- **Plans** — subscription plans, tiers and entitlement definitions
- **Demo** — quotations in every status, 15 approval requests, 8 orders, subscriptions, invoices, billing schedule items, 4 credit notes, 4 deal-health alerts, 13 notifications, 5 outbox emails and a full audit trail
- **Edge cases on purpose** — a live magic-link token *and* an expired one, an empty team, an inactive customer, a customer without a contact, and a deactivated user

---

## 🎭 End-to-End Demo Script

Exercise every role and every module in one sitting:

```
 1.  Reset            →  pnpm db:reset            (fresh, fully seeded state)

 2.  Rep  (rahul)     →  /quotations/new
                         Customer: Gupta Retail (BRONZE, 5% ceiling)
                         Add 2 physical lines + 1 monthly subscription line
                         Push one line to 14% discount  →  watch the risk panel
                         flip to HIGH with the exact rule that fired
                         →  Submit

 3.  Manager (vikram) →  /approvals/[id]
                         Read the SNAPSHOTTED policy, per-line excess and reasons
                         →  Return with "Trim the subscription discount"

 4.  Rep  (rahul)     →  Revise  →  drop the line to 9%  →  Submit again

 5.  Manager (vikram) →  Approve   (chain advances to Finance)
 6.  Finance (priya)  →  Approve   (quote becomes APPROVED)

 7.  Rep  (rahul)     →  Send to customer   →  magic link queued to the outbox
 8.  Admin  (arjun)   →  /admin/emails      →  copy the link (or read it at yopmail)

 9.  Customer         →  /portal/quotations/[id]
                         Propose a change on one line  →  Rep declines with a reason
                         →  Accept the current version  →  Order created

10.  Finance (priya)  →  /fulfillment/[id]
                         Recompute plan  →  see the split across 2 warehouses and
                         one backorder  →  Reserve  →  Ship
                         →  invoice generated on dispatch

11.  Finance (priya)  →  /invoices/[id]
                         Download PDF  →  Record a partial payment
                         →  status moves to PARTIALLY_PAID

12.  Finance (priya)  →  /subscriptions/[id]
                         Preview change  →  raise quantity  →  see the daily
                         proration and the credit before committing

13.  Customer         →  /portal/subscriptions/[id]
                         Pause  →  choose a resume cycle  →  confirm the pause
                         lands on the next boundary, not mid-period

14.  Admin  (arjun)   →  /admin/policy/discount-risk
                         Lower the GOLD ceiling  →  Simulate against a real quote
                         →  Diff  →  Publish  →  then Restore the prior version

15.  Anyone internal  →  Assistant bubble
                         "How many quotations are pending approval?"
                         →  answer + the SQL it ran

16.  Manager (vikram) →  /deal-health   →  stalled + anomaly alerts, nudge one
17.  Admin  (arjun)   →  /reports       →  export PDF and XLSX
18.  Admin  (arjun)   →  /analytics     →  switch across rep/manager/finance/ops
19.  Admin  (arjun)   →  /admin/users   →  approve Neha Joshi  →  she can sign in
```

All five roles, both auth realms, the policy engine, the split planner, hybrid billing, the portal and the AI assistant are covered by step 19.

---

## ⚙️ Cross-Cutting Features

### Money is never a float

All amounts are **integer minor units** (paise) and all percentages are **basis points** (`1250 bp = 12.50 %`). `src/domain/money/money.ts` is the only place arithmetic happens, and it uses `decimal.js` with explicit half-up rounding:

- `pctOf(amountMinor, bp)` · `applyDiscount(amountMinor, bp)` · `ratioBp(part, whole)`
- `allocateProportional(totalMinor, weights)` — largest-remainder split where the parts **always** sum back to the total, with ties broken by index so the result is deterministic. This is what makes order-level discounts, prorations and credits reconcile exactly.

### Versioned, snapshotted policy

Six `PolicyKind`s, each a validated JSON payload with a strict Zod schema, published as an immutable `PolicyVersion`. Approvals snapshot the version that was active at submission, so a decision can always be replayed against the rules that actually governed it. Every kind supports draft → diff → publish → history → restore.

### Terms-hash-bound acceptance

`termsHash()` canonicalises the quote terms (sorted keys, ISO dates, recursive) and hashes them with SHA-256. Acceptance carries the hash of the version the customer saw — so a quote that changes between rendering and acceptance is rejected rather than silently confirmed. Concurrent acceptances create exactly one order.

### Auto-numbering that survives concurrency

`nextNumber(tx, key)` allocates through a `NumberSequence` upsert whose `UPDATE … RETURNING` locks the row — two concurrent callers can never receive the same number:

`Q-01001` · `ORD-01001` · `INV-01001` · `CN-01001` · `SHP-01001`

### Soft delete as a client extension

`src/server/soft-delete.ts` extends the Prisma client so deletes become `deletedAt` stamps and every read filters them out automatically. Unique constraints are **partial** (`WHERE deleted_at IS NULL`) so a soft-deleted row never blocks re-creating its live counterpart.

### Everything is in IST

`src/lib/datetime-ist.ts` renders every user-facing timestamp on the India Standard Time wall clock, and report/analytics buckets are labelled the same way — so a "yesterday" in a chart and a "yesterday" in an audit row mean the same thing.

### Append-only audit + readable activity

`writeAudit()` records `actorId`, `actorType` (`USER`/`CUSTOMER`/`SYSTEM`), entity, action, version, before/after JSON and a reason — one row per affected entity, written inside the same transaction as the mutation. `src/lib/activity-sentence.ts` renders those rows as plain sentences in the UI.

### The shared action boundary

Every mutation goes through `runAction()`:

```ts
await runAction({
  roles: ["ADMIN", "FINANCE"],   // 1 · requireRole — throws if not permitted
  schema: RecordPaymentZ,        // 2 · zod parse (FormData or JSON)
  input,
  execute: async (actor, data) => { … },  // 3 · transactional service call
  paths: ["/invoices", `/invoices/${id}`], // 4 · revalidatePath
});
```

It returns a typed `ActionResult<T>` — validation failures come back as friendly field messages instead of thrown stack traces.

### Email as an outbox, not a fire-and-forget

Outbound mail is written as an `EmailMessage` row first and sent by the `/api/jobs/emails` worker in batches of 50, one message per send with backoff and error capture. `/admin/emails` shows queued, sent and failed with the failure reason. Without `SMTP_HOST` configured, mail simply stays queued — there is no silent drop and no dev-only link shortcut.

### Scheduled jobs

| Endpoint | Vercel Cron | What it does |
|----------|-------------|--------------|
| `/api/jobs/billing` | `0 0 * * *` | Generates due subscription invoices, applies prorations and credits, records a run with a correlation ID |
| `/api/jobs/emails` | `5 0 * * *` | Flushes the outbox |
| `/api/jobs/deal-health` | `10 0 * * *` | Expires stale quotations, then runs all four detectors |
| `/api/jobs/subscription-transitions` | — | Shares the billing handler; processes activations, pauses and resumes at boundaries |

All four are guarded by `authorizedJob()`, which timing-safe compares an `x-jobs-secret` header or a `Bearer` token against `JOBS_SECRET` (local) or `CRON_SECRET` (Vercel Cron). The billing run returns an `x-correlation-id` header on both success and failure.

### Exports

- **Invoice PDF** — `@react-pdf/renderer` document streamed from `/api/export/invoice/[id]/pdf`, with Noto Sans bundled so the ₹ glyph renders correctly
- **Report PDF / XLSX** — `/api/export/report/[format]`; the ExcelJS workbook carries a Summary sheet plus one sheet per report section, all IST-labelled

---

## 🤖 The Read-Only Assistant

Ask the database a question in English and get an answer — with the SQL it ran shown underneath.

> *"How many quotations are pending approval?"* → **“There are 6 quotations in PENDING_APPROVAL.”** + the `SELECT` that produced it.

### Shape

```
Widget (bubble, bottom-right of the internal shell)
  │  POST /api/assistant/query        ← Next.js Route Handler, calls requireInternal()
  ▼
assistant-api :8000  /query           ← FastAPI, bound to 127.0.0.1
  │
  ├── LangGraph ReAct agent ── OpenCode gateway (writes the SQL)
  │        │
  │        └── query_database tool ── statement guard ── Postgres as dealflow_readonly
  ▼
{ answer, sql }
```

### Read-only is enforced by Postgres, not by a prompt

Three layers, and **only the first is load-bearing**:

1. **The Postgres role.** `prisma/sql/readonly-role.sql` creates `dealflow_readonly` with `SELECT` and nothing else — no INSERT/UPDATE/DELETE, no DDL, no `CREATE` on `public` — plus `default_transaction_read_only = on` and a 15s `statement_timeout`. A fully jailbroken model still cannot write a row.
2. **The statement guard** (`app/readonly.py`). Rejects anything that is not a single `SELECT`/`WITH`, after stripping comments, string literals and quoted identifiers — so `WHERE "action" = 'DELETE'` passes and `/* x */ UPDATE …` does not. It also caps result rows. It exists so a bad attempt becomes a correctable error rather than a permission fault mid-answer.
3. **The prompt**, which mostly stops the model from trying in the first place.

`GET /health` reports `database.user` and `database.readOnly`, because pointing the service at the application role is the one misconfiguration that silently removes layer 1.

The widget is mounted **only in the internal shell** — a portal version would need row-level scoping the agent does not have. Full architecture and tuning notes: [`docs/assistant.md`](./docs/assistant.md).

---

## 📡 API Guide

DealFlow360 exposes three surfaces: **Server Actions** for every typed business mutation, **HTTP Route Handlers** for auth, binary output and scheduled jobs, and the **assistant proxy**. There is no public REST CRUD API — reads and writes go through server actions and server queries, which keeps type safety end-to-end and removes the need for a separate API tier.

### 1 · Route Handlers (`src/app/api/`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `*` | `/api/auth/[...nextauth]` | — | NextAuth v5 catch-all for the **internal** credentials realm |
| `*` | `/api/portal-auth/[...nextauth]` | — | NextAuth v5 catch-all for the **customer** magic-link realm |
| `POST` | `/api/assistant/query` | Internal session | Proxies `{ question }` to the FastAPI agent after `requireInternal()`; returns `{ answer, sql }` |
| `GET` | `/api/export/invoice/[id]/pdf` | Internal session (scoped) | Streams the rendered invoice PDF. Admin and Finance see every invoice; reps and managers only invoices whose quotation is in their scope |
| `GET` | `/api/export/report/[format]` | Internal (scoped) | `pdf` or `xlsx`, built from the same filters as `/reports` and scoped to the actor's role |
| `GET`·`POST` | `/api/jobs/billing` | `JOBS_SECRET` / `CRON_SECRET` | Runs the billing cycle; `200` on success, `503` with a `runId` on failure |
| `GET`·`POST` | `/api/jobs/subscription-transitions` | `JOBS_SECRET` / `CRON_SECRET` | Same handler — activations, pauses and resumes at boundaries |
| `GET`·`POST` | `/api/jobs/emails` | `JOBS_SECRET` / `CRON_SECRET` | Sends up to 50 queued outbox messages |
| `GET`·`POST` | `/api/jobs/deal-health` | `JOBS_SECRET` / `CRON_SECRET` | Expires stale quotations, then runs the four detectors |

Portal magic-link verification lives at `/portal/login/verify` as a Route Handler rather than a page — a Server Component cannot set the session cookie, which is exactly the bug that makes a valid link report itself as expired.

### 2 · Server Actions (`src/server/actions/*.ts`)

Every action file starts with `"use server"` and routes through `runAction()`: **authenticate → validate → mutate transactionally → audit → notify → revalidate**.

| Module | Representative exports | Role guard |
|--------|------------------------|:----------:|
| `auth.actions.ts` | `signupAction`, `loginAction`, `logoutAction`, `requestPortalLinkAction`, `portalLogoutAction` | Public |
| `quotations.ts` | `createQuoteAction`, `startDraftQuoteAction`, `addQuoteLineAction`, `saveQuoteAction`, `removeQuoteLineAction`, `repriceQuoteAction`, `reviseQuoteAction`, `cancelQuoteAction` | Rep, Manager, Admin |
| `approvals.ts` | `submitQuoteAction`, `withdrawQuoteAction`, `decideApprovalAction` | Submit: Rep/Manager · Decide: Manager, Finance, Admin |
| `negotiation.ts` | `sendToCustomerAction`, `respondToProposalAction` | Rep, Manager, Admin |
| `portal.ts` | `acceptQuotationAction`, `submitProposalsAction`, `withdrawProposalAction`, `portalPauseAction` | Portal customer (own records) |
| `fulfillment.ts` | `recomputePlanAction`, `overridePlanAction`, `shipAction`, `completeServiceAction`, `consolidateAction`, `decideConsolidationAction` | Finance, Admin |
| `subscriptions.ts` | `previewChangeAction`, `previewCancelAction`, `modifySubscriptionAction`, `cancelSubscriptionAction`, `activationAction`, `pauseResumeAction` | Finance, Admin |
| `payments.ts` | `recordPaymentAction` | Finance, Admin |
| `plans.ts` | `savePlanAction`, `createTierAction`, `updateTierAction`, `deactivateTierAction`, `copyPricesAction` | Admin |
| `entitlements.ts` | `saveDefinitionAction`, `archiveDefinitionAction`, `saveEntitlementValueAction`, `resetOverrideAction`, `previewPublishAction`, `publishChangesAction`, `discardDraftAction`, `noticeHistoryAction` | Admin |
| `policy.ts` | `publishPolicyAction`, `restorePolicyAction`, `simulateRiskAction`, `simulateFulfillmentAction`, `loadRiskSampleAction`, `previewRecommendationsAction`, `refreshCopurchaseRulesAction` | Admin |
| `deal-health.ts` | `scanHealthAction`, `healthAlertAction` | Internal (scoped) |
| `jobs.ts` | `runBillingAction`, `retryBillingRunAction`, `sendQueuedEmailsAction` | Admin |
| `admin/` | `approveUserAction`, `updateUserRoleAction`, `setUserActiveAction`, `createTeamAction`, `createCustomerAction`, `updateCustomerAction`, `setCustomerActiveAction`, `invitePortalUserAction`, `assignPriceListAction`, `createProductAction`, `updateProductAction`, `setProductStatusAction`, `setVariantsAction`, `createCategoryAction`, `createPriceListAction`, `updatePriceListAction`, `upsertPriceListItemAction`, `removePriceListItemAction`, `createWarehouseAction`, `updateWarehouseAction`, `setWarehouseActiveAction`, `adjustStockAction`, `receiveStockAction`, `setReorderPointAction`, `createReplenishmentAction`, `cancelReplenishmentAction` | Admin (stock: Finance too) |

**Example — recording a payment from a client component:**

```tsx
"use client";
import { useTransition } from "react";
import toast from "react-hot-toast";
import { recordPaymentAction } from "@/server/actions/payments";

export function RecordPayment({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();

  function submit(amountMinor: number) {
    start(async () => {
      const result = await recordPaymentAction({
        invoiceId,
        amountMinor,                     // paise — never a float
        method: "BANK_TRANSFER",
        reference: "NEFT-88213",
        idempotencyKey: crypto.randomUUID(), // a retry can never double-pay
      });
      if (!result.ok) toast.error(result.error.message);
      else toast.success("Payment recorded");
    });
  }

  return (
    <button disabled={pending} onClick={() => submit(2_500_00)}>
      {pending ? "Recording…" : "Record ₹2,500"}
    </button>
  );
}
```

### 3 · Server Queries (`src/server/queries/`)

Reads are separated from mutations. Every list query goes through `src/server/list.ts` for consistent filtering, sorting and pagination, and every scoped query derives its `where` clause from the actor:

| Module | What it returns |
|--------|-----------------|
| `dashboard.ts` | Role-aware KPI tiles and open work |
| `quotation-list.ts` / `quotations.ts` | Filterable list + full detail with versions and negotiation |
| `approvals.ts` | Queue scoped to the actor's reviewer role, plus decision context |
| `fulfillment.ts` | Orders, plans, allocations, backorders |
| `subscriptions.ts` / `plans.ts` | Lifecycle, schedules, entitlements |
| `invoices.ts` | Invoices, lines, payments, credit applications |
| `deal-health.ts` | Alert board with filters |
| `reports.ts` | Report data feeding both the UI and the exporters |
| `analytics/` | `sales` · `finance` · `ops` · `admin` · `mrr-history` chart builders |
| `jobs.ts` / `policy.ts` / `portal.ts` / `admin/` | Job runs, policy versions, portal-scoped reads, admin lists |

### 4 · Validation Schemas

Input validation is centralised in `src/lib/zod-schemas/` (`auth`, `quotation`, `admin`, `reports`, `list`) and `src/domain/policy/schemas.ts`, and consumed by **both** the server action and the matching React Hook Form via `zodResolver`. Each Zod schema is the single source of truth — the form, the action and the TypeScript type (`z.infer<typeof schema>`) all derive from it.

### 5 · Assistant Service (`services/assistant`)

| Method | Path | Auth | Description |
|--------|------|:----:|-------------|
| `GET` | `/health` | None (localhost-bound) | Reports `database.user` and `database.readOnly` |
| `POST` | `/query` | `X-Assistant-Key` header (`ASSISTANT_SERVICE_KEY`) | `{ question }` → `{ answer, sql }`, executed as `dealflow_readonly` |

---

## 🧪 Testing & Validation

```bash
pnpm test        # Vitest — unit + domain suites
pnpm typecheck   # tsc --noEmit
pnpm lint        # ESLint
pnpm build       # production build (runs prisma generate first)
pnpm e2e         # Playwright
pnpm assistant:test   # pytest for the FastAPI service
```

**68 test files** across the domain layer, server helpers and 17 PostgreSQL integration suites covering the parts where correctness is not obvious:

| Suite | What it proves |
|-------|----------------|
| `quotation.integration` | Versioning, terms hash, pricing and submission validation |
| `approval.integration` | Sequential chains, supersession, own-quote blocking, policy snapshotting |
| `fulfillment.integration` | Order idempotency, reservation/dispatch conservation, one invoice per shipment, concurrent duplicate payment and overpayment rejection |
| `fulfillment-audit.integration` | Every allocation mutation lands in the audit log |
| `subscription-billing.integration` | Scheduled activation, exactly-once period invoicing, quantity proration, cancellation retry |
| `subscription-cycle-change.integration` | Boundary pause/resume and skipped periods |
| `plan-catalog-entitlement.integration` | Draft separation, selective notices, stale/concurrent publication, rollback on missing recipient, active-holder protection |
| `portal.integration` | Cross-customer rejection, obsolete-version rejection, concurrent confirmation creates one order, proposals cannot edit terms |
| `portal-token.integration` | Magic-link issue, consume-once and expiry |
| `deal-health.integration` | Concurrent scoped scans deduplicate; meaningful activity auto-resolves |
| `policy.integration` | Publish, diff, restore and version isolation |
| `credit.integration` | Credit issue, application and reconciliation |
| `analytics.integration` | Forbidden-view rejection, own-record scope, currency separation, half-open period boundaries |
| `reports.integration` · `report-exports` | Report data, workbook readback and PDF rendering |

> ⚠️ Integration tests require an explicitly configured **disposable** `TEST_DATABASE_URL` and run in an isolated schema. The default `pnpm test` run skips them. Never point them at the application schema.

Current verified coverage and the remaining acceptance work are tracked in [`docs/implementation-status.md`](./docs/implementation-status.md).

---

## 🚀 Deployment

1. Set the hosting project's **Root Directory to the repository root** (empty or `.`) — the app lives at the root, there is no `code/` subdirectory.
2. Build with `pnpm build`, start with `pnpm start`.
3. Provide `DATABASE_URL`, `DIRECT_URL` and `AUTH_SECRET` at minimum; add SMTP and `JOBS_SECRET` / `CRON_SECRET` for mail and the scheduled jobs.
4. Apply migrations with `pnpm exec prisma migrate deploy`.
5. `vercel.json` registers the three daily crons (billing 00:00, emails 00:05, deal-health 00:10 UTC).
6. The assistant is a **separate deployment** — it binds to localhost by design; run it behind the same private network as the app, never on a public port.

---

## 🤝 Contributing

```bash
git checkout -b feature/your-feature-name
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
# Open a Pull Request
```

Please follow [Conventional Commits](https://www.conventionalcommits.org/). Run `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` before opening a PR.

---

## 📄 License

MIT © 2026 Team Qubits

---

<p align="center">
  <strong>Built with 🔥 by <a href="#-meet-the-team--qubits">Ridham Patel</a>, <a href="#-meet-the-team--qubits">Harsh Dodiya</a> & <a href="#-meet-the-team--qubits">Het Saraiya</a></strong><br />
  <sub>Team Qubits · 2026</sub>
</p>

<p align="center">
  <a href="https://github.com/ridh21/qubits-dealflow">📦 Repository</a> ·&nbsp;
  <a href="./PRD.md">📄 PRD</a> ·&nbsp;
  <a href="./docs/assistant.md">🤖 Assistant Docs</a> ·&nbsp;
  <a href="./docs/implementation-status.md">✅ Verification Ledger</a>
</p>

<p align="center">
  <em>If this project helped you, drop a ⭐ — it means the world to us.</em>
</p>
