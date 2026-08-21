# CYCLO Implementation Plan

Status: Phase 1 (Foundation) in progress. Stack confirmed — see "Open Decisions" at the end.
Source of truth for product rules: the CYCLO Master Implementation Prompt provided 2026-08-21.
Design/brand reference: [index.html](index.html) (static prototype — see Section 1).

## Phase 1 progress

- Monorepo scaffolded: `apps/api` (NestJS), `apps/web` (Next.js), `packages/design-tokens`,
  `packages/shared-types`, root npm workspaces, git initialized.
- Brand assets extracted byte-identical from the prototype to `assets/brand/` and wired into
  both the design-tokens CSS and the web app.
- Database foundation live: Prisma + SQLite, initial migration applied (User, OtpChallenge,
  RefreshToken, Organization, OrganizationMember, Location, CollectorProfile, Verification,
  AuditLog).
- Auth working end-to-end: phone+OTP request/verify, JWT access + rotating refresh tokens,
  RBAC guard scaffold (`@Roles()`), `GET /users/me`. Covered by an e2e test
  (`apps/api/test/auth.e2e-spec.ts`) exercising request → verify → profile → refresh →
  rotation-rejection, plus expiry/replay/unauthorized rejection paths. All passing.
- Web app: CYCLO-themed login (phone → OTP code) and an authenticated home/profile page with
  loading/error/retry states, built on the shared design tokens.
- Still open for the rest of Phase 1: navigation shell content for the other five roles is not
  built yet (only household-shaped login/home exist); Flutter mobile app not started (SDK
  install in progress, see below).

---

## 1. Current Architecture

- Single static file, no repository, no backend, no database, no tests, no CI/CD.
- No `git`, `flutter`/`dart`, or `docker` installed on the dev machine. `node` v24 / `npm` 11 are available.
- The file is a self-contained HTML/CSS/JS demo: a splash screen, a topbar role switcher, and six `.view` blocks (household, collector, business, buyer, authority, admin) toggled with vanilla JS. No data model, no persistence, no network calls.
- Two official CYCLO logo lockups exist only as inline base64 PNG strings (dark lockup for splash, light lockup for topbar/footer, swapped by `toggleTheme()`).

This file is treated as **UX/brand reference only**, per the master prompt's "no big-bang rewrite" rule (§59) — there is no working functionality to preserve at the code level, but the design system and asset identity are authoritative and must not change (§7).

## 2. Target Architecture

Modular monolith, domain-first (master prompt §5, §38), TypeScript end-to-end:

```
/apps
  /api      NestJS backend — modular monolith, one module per domain boundary
  /web      Next.js (React, TS) — mobile-responsive PWA for Household/Collector,
            desktop dashboards for Business/Buyer/Authority/Admin
  /mobile   Flutter — added once Flutter tooling is available (see Open Decisions)
/packages
  /shared-types   DTOs/enums shared between api and web (state machines, roles)
  /design-tokens  CSS variables extracted verbatim from index.html
/prisma          schema.prisma, migrations
/assets/brand    logo-dark.png, logo-light.png (extracted from index.html, byte-identical)
```

Layering inside `apps/api` follows §37: Presentation (controllers) → Application (use cases/services) → Domain (entities, state machines, business rules) → Infrastructure (Prisma, storage, payment/AI provider adapters). No business logic in controllers or in `apps/web` components.

## 3. Architecture Gaps

- No auth, no session/JWT handling, no RBAC enforcement anywhere.
- No database, no ORM, no migrations.
- No API layer / service boundaries (§38).
- No domain layer — nothing encodes the state machines in §15/§20/§26.
- No storage abstraction for photos/evidence/documents (§4, §44).
- No AI abstraction layer (§11–§13).
- No payment abstraction (§26).
- No notification service (§30).
- No offline sync design for collectors (§41).
- No environment separation, secrets management (§55).
- No tests of any kind (§51).
- No version control.

## 4. Feature Gaps

Every capability in master-prompt §6 (role capabilities) through §34 (admin dashboard) is unimplemented. The prototype only *visually* represents: household home/scan/marketplace/activity/profile, collector jobs/active/earnings/profile, and read-only dashboard shells for business/buyer/authority/admin. None of it is backed by real logic.

## 5. Technical Debt

None yet — there is no code to accumulate debt. The main risk is *starting* with debt by skipping the domain model and building screens first, which §5 explicitly forbids.

## 6. Database Plan

PostgreSQL (relational — required for marketplace/transaction/relational queries per §39) via Prisma (TypeScript-native, migrations, generates types consumed by `packages/shared-types`).

Core entities (§35), first-cut fields:

- **User** — id, role(s), phone (primary identifier — East Africa context), email?, name, passwordHash/otp state, locale, country, createdAt.
- **Organization** — id, type(business|recycler|authority), name, verificationStatus, ownerUserId.
- **OrganizationMember** — orgId, userId, role.
- **Location** — id, ownerType/ownerId (User or Organization), label, coordinates, address, region/country (configurable per §67).
- **WasteMaterial** — canonical taxonomy: id, category, subtype, recyclable(bool), extensible (§11).
- **WasteListing** — id, sellerId, materialId, category, estimatedWeight, verifiedWeight?, condition, grade?, purity?, locationId, photos[], askingPrice, pickupOption, description, status (state machine, §15), createdAt, expiresAt?.
- **PickupRequest** — id, producerId, locationId, materialId, estimatedWeight, photos[], preferredTime, notes, status (state machine, §20), assignedCollectorId?, createdAt.
- **CollectorProfile** — userId, verificationStatus (§21 state machine), vehicleInfo, serviceArea, availability.
- **RecyclerProfile** — orgId, verificationStatus.
- **BuyRequest** — id, recyclerOrgId, materialId, requiredQty, minGrade, pricePerKg, locationId, pickupAvailable, deadline, status.
- **Offer** — id, listingId or buyRequestId, fromUserId/orgId, price, qty, status.
- **Transaction** — immutable once finalized (§25): id, reference (`CYCLO-{REGION}-{SEQ}` per §23, region configurable), buyerId, sellerId, collectorId?, materialId, verifiedWeight, agreedPrice, platformFee, grossAmount, netAmount, paymentStatus, relatedListingId?, relatedPickupId?, createdAt.
- **Payment** — id, transactionId, provider, state machine (§26), amounts, providerRef, timestamps.
- **WalletLedger** — id, userId/orgId, type(earning|purchase|fee|withdrawal|refund), amount, relatedTransactionId (every entry traceable, §27 — no direct balance mutation).
- **WasteEvent** — id, wasteRef (transaction/listing/pickup id), eventType, actorId, location, timestamp, evidence[], notes, previousState, newState (§24).
- **Verification** — id, subjectType(user|collector|org), status (§21), documents[], reviewedBy?, reviewedAt?.
- **Conversation** / **Message** — contextual only, scoped to a legitimate CYCLO relationship (§29).
- **Notification** — id, userId, type, payload, readAt.
- **Rating** — id, transactionId, fromUserId, toUserId, score, comment.
- **Dispute** — id, transactionId, openedBy, evidence[], status, resolution (§28).
- **Report** — generated exports (authority/admin).
- **EducationContent** — learn/earn cards seen in the prototype's "Learn & Earn" section.
- **AuditLog** — actor, action, target, timestamp, diff (every admin action, §34/§63).

Every entity: stable UUID, `createdAt`, `updatedAt` where mutable, explicit FK relationships (no implicit joins), indexes on FKs/status/location, ISO-8601 timestamps throughout (no mixed formats, §36).

## 7. API Plan

NestJS modules mirroring §38 service boundaries: `auth`, `users`, `organizations`, `marketplace`, `collection`, `waste`, `transactions`, `payments`, `ai`, `notifications`, `messaging`, `verification`, `analytics`, `admin`. Each module: controller (HTTP + validation via DTOs) → service (use case) → domain (state machine/rules) → repository (Prisma). REST first (simpler to version and secure); GraphQL not justified at MVP scale. All mutating endpoints require an authenticated principal; authorization checked server-side per role, never trusted from the client (§42).

## 8. Authentication Plan

Phone-number + OTP (SMS) as primary auth, matching East African mobile-first context — email/password optional secondary. JWT access token (short-lived) + refresh token. OTP delivery via an abstracted SMS provider interface (concrete provider TBD — e.g. Africa's Talking — selected after checking current commercial/regulatory terms, per §26's spirit applied to SMS too). Passwords/OTP secrets: hashed, never logged (§43, §45).

## 9. Role/Permission Plan

Roles: `household`, `business`, `collector`, `recycler`, `authority`, `admin` (a user can hold one primary role plus org memberships). RBAC enforced via NestJS guards reading the JWT's role claims plus a per-resource ownership check (e.g., a household can only mutate its own listings). Authority role gets aggregated/anonymized read endpoints only — no raw PII (§6 Role 5, §33).

## 10. UI Implementation Plan

- Extract `index.html`'s `:root` and `html[data-theme="dark"]` CSS variables verbatim into `packages/design-tokens` — same hex values, same names. Extract the two embedded base64 PNGs to real files in `assets/brand/`; reference them by URL, never regenerate them (§7).
- `apps/web` (Next.js + TS): mobile viewport gets the phone-shell-free but visually equivalent bottom-nav experience (Home/Marketplace/Scan/Activity/Profile per §9, Scan FAB prominent) for household/collector; desktop gets the sidebar-dashboard layout for business/buyer/authority/admin — same component patterns already proven in the prototype (stat tiles, listing cards, stepper, timeline, KPI cards, data tables), rebuilt as real components bound to API data.
- Every async view implements loading/success/empty/error/retry (§46–§47) — no blank screens, no bare "No data."

## 11. AI Implementation Plan

`ai` module exposes a `WasteClassifier` interface with a swappable provider adapter (mock classifier for dev/tests; real vision-capable model behind the same interface for staging/prod). Flow strictly follows §11–§13: image in → classification + confidence + recyclability → user must confirm → only then can the confirmed material feed a listing/pickup form. The AI never creates a listing, sets a price, or completes a sale automatically (§12). Classification taxonomy is a DB-backed enum table (`WasteMaterial`), not hardcoded, so it can extend without a redeploy.

## 12. Marketplace Plan

`WasteListing` state machine (§15): `DRAFT → ACTIVE → OFFER_RECEIVED → NEGOTIATION → RESERVED → SOLD → COLLECTED`, with `CANCELLED / EXPIRED / DISPUTED` as terminal/side states reachable only from valid predecessors — implemented as an explicit state machine (e.g. a typed transition table checked server-side), not booleans (§15 is explicit about this). `BuyRequest`/`Offer` support the recycler-demand side (§16, §32).

## 13. Collection Plan

`PickupRequest` state machine (§20): `CREATED → MATCHING → ASSIGNED → ACCEPTED → EN_ROUTE → ARRIVED → COLLECTING → WEIGHED → COMPLETED`, `CANCELLED/DISPUTED` as side states. Invalid transitions (e.g. `CREATED → COMPLETED`) are rejected at the domain layer regardless of what the client sends. `estimatedWeight` and `verifiedWeight` are distinct fields (§22); the verified figure is what a `Transaction` uses.

## 14. Transaction Plan

`Transaction` rows are created only once a pickup/offer completes with a verified weight, and are never updated after `paymentStatus` reaches a terminal state — corrections happen via new linked records (refund/adjustment), not mutation (§25). Every `WalletLedger` entry references the `Transaction` that produced it (§27). `WasteEvent` rows are appended at every state transition, forming the traceability chain (§23–§24) with a human-readable reference like `CYCLO-DAR-0001842` (region/format configurable, §67).

## 15. Payment Plan

`PaymentProvider` interface with states `PENDING → AUTHORIZED → PROCESSING → SUCCESS/FAILED`, `REFUNDED`, `DISPUTED` (§26). MVP ships with a sandbox/mock provider so the full loop (§52) is testable end-to-end without a live money integration; a real Tanzanian mobile-money provider (M-Pesa/Tigo Pesa/Airtel Money aggregator) is selected and wired in Phase 5 after confirming current API/regulatory/commercial terms — never faked as "success" in anything claimed as working (§62).

## 16. Testing Plan

- Unit: pricing engine, every state-machine transition table, validation rules, permission checks (§51).
- Integration: auth flow, marketplace listing lifecycle, pickup lifecycle, transaction+payment flow, against a real test database.
- E2E: the full critical path in §52 (create user → scan → confirm → list → offer → accept → pickup → collector accepts → arrives → weight verified → transaction → payment → waste event history) as one automated test, since this is the MVP's actual definition of "working."
- UI: critical flows only (login, create listing, request pickup, collector accept/complete).

## 17. Deployment Plan

- `development` (local, SQLite or local Postgres, mock AI + mock payment providers), `staging` (Postgres, sandbox providers), `production` (Postgres, real providers) — per §55, config via environment variables, nothing secret committed.
- `apps/api` and `apps/web` deploy independently; object storage via an S3-compatible bucket abstracted behind a `StorageProvider` interface.
- CI: lint + typecheck + unit + integration tests on every change before merge, once git/CI are set up (see Open Decisions).

## 18. Phased Implementation Roadmap

Mirrors master-prompt §65, restated against this plan:

1. **Foundation** — repo scaffold, design tokens + brand asset extraction, Prisma schema for core entities, auth (phone+OTP, JWT), role guards, base navigation shell in `apps/web`.
2. **Core CYCLO loop** *(highest priority — the MVP proof of concept, §52)* — WasteMaterial taxonomy, WasteListing + state machine, PickupRequest + state machine, collector accept/weigh/complete, Transaction + WasteEvent history, mock payment.
3. **AI** — classifier abstraction, mock provider first, camera/upload UI, confirmation-gated result screen.
4. **Trust** — collector/org verification workflow, ratings, disputes, audit logs.
5. **Payments** — real provider integration behind the existing abstraction, wallet withdrawals.
6. **Business** — organizations, multi-location, recurring pickups, invoices, reports.
7. **Recycler market** — buy requests, offers, matching, purchase tracking.
8. **Admin** — user/verification/marketplace/transaction/dispute management, audit trail UI.
9. **Authority intelligence** — aggregated dashboards, geographic/material trends.
10. **Scale** — country/currency/language/payment-provider configuration for East African expansion.

Each phase ships as one or more vertical slices (§75), never screens-first (§5, §71).

---

## Open Decisions — resolved 2026-08-21

1. **Mobile platform** — Decided: install Flutter now, native-first, per §39's literal recommendation. Flutter/Dart SDK download and extraction in progress (large download; the storage.googleapis.com host truncates connections on this network, so it's being fetched via a resumable `curl -C -` retry loop rather than a single request). `apps/mobile` (Flutter) will be scaffolded once the SDK is verified working via `flutter doctor`.
2. **Version control** — Decided: install Git and init a repo now. Done — Git 2.55 installed, repository initialized, 7 logical commits made so far (brand assets, scaffold, db, auth, web).
3. **Local database** — Decided: SQLite for local dev via Prisma. Done — schema is Postgres-portable (no native `enum` usage; string fields validated at the application layer), initial migration applied, verified working end-to-end through the auth e2e suite.
