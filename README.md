# CYCLO

Digital marketplace and coordination platform for recyclable waste — households, businesses,
collectors, recycling companies, and environmental authorities in one ecosystem. Starting with
a Tanzania MVP; architected to expand across East Africa.

See [CYCLO_IMPLEMENTATION_PLAN.md](CYCLO_IMPLEMENTATION_PLAN.md) for the full audit, architecture,
and phased roadmap. [index.html](index.html) is the original UI prototype — kept as the design/
brand reference, not extended further; the real app lives under `apps/`.

## Structure

```
apps/api      NestJS backend (auth, domain modules)
apps/web      Next.js web app (household/collector PWA + org dashboards)
apps/mobile   Flutter mobile app (native household/collector experience)
packages/     Shared design tokens and TypeScript types
prisma/       Database schema and migrations (SQLite locally, Postgres-portable)
assets/brand  Official CYCLO logo assets — do not regenerate or recolor
```

## Prerequisites

- Node.js 20+ and npm
- Flutter SDK (for `apps/mobile`)

## Setup

```powershell
npm install               # installs all workspaces, builds packages/shared-types
copy apps\api\.env.example apps\api\.env   # then fill in a real JWT_ACCESS_SECRET
npx prisma migrate dev    # creates prisma/dev.db and applies migrations
```

## Running

```powershell
npm run dev:api   # NestJS on http://localhost:3000
npm run dev:web   # Next.js on http://localhost:3001
```

In development, OTP codes are logged to the API console (`[DEV SMS STUB] OTP for ... : ......`)
instead of being sent by SMS — no real SMS provider is wired in yet.

## Testing

```powershell
npm run test --workspace=apps/api      # unit tests
npm run test:e2e --workspace=apps/api  # e2e tests (needs prisma/dev.db to exist)
```

## Database

```powershell
npm run db:generate   # regenerate the Prisma client after a schema change
npm run db:migrate    # create and apply a new migration
npm run db:studio     # browse the local database
```
