# DealFlow360

Quotation, approval, fulfillment, subscription billing and customer portal application built with Next.js, Prisma and PostgreSQL.

The application lives at the repository root. Run all commands here; there is no `code/` subdirectory.

## Development

Use the pnpm version declared in `package.json`.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Configure DATABASE_URL, DIRECT_URL and AUTH_SECRET in .env.
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm dev
```

Open http://localhost:3000. SMTP settings are required for delivered email; job endpoints require their configured secret.

`pnpm db:seed` populates the INR/GST demo scenarios. It replaces records owned by the demo seed, so use it against a development or demo database.

## Local database (Docker)

A local Postgres 16 instance replaces the hosted Neon database for development.
Two commands get a fully seeded database:

```bash
pnpm db:up      # starts the postgres container and waits until healthy
pnpm db:setup   # applies prisma migrations + runs prisma/seed.ts
```

`pnpm db:setup` runs `prisma migrate deploy && tsx prisma/seed.ts`; the seed is
idempotent (demo rows are purged and recreated), so it can be re-run any time —
or run the seed alone with `pnpm db:seed`. Then start the app as usual with
`pnpm dev`.

The database listens on `127.0.0.1:55432` (user `dealflow`, password
`dealflow_dev`, database `dealflow_dev`) — this is already configured in
`.env`. Data is stored in the `dealflow_pgdata` docker volume and survives
restarts; `pnpm db:down` stops the container, and `docker compose -f
compose.dev.yml down -v` also wipes the data.

Other useful commands:

- `pnpm db:seed` — run `prisma/seed.ts` directly against the running database
- `pnpm db:studio` — browse the local data with Prisma Studio
- `pnpm db:migrate` — create a new migration against the local database

To switch back to Neon, uncomment the Neon URLs at the top of `.env`.

## Validation

```sh
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Database integration tests require an explicitly configured disposable `TEST_DATABASE_URL`. The default unit run skips them. See [the verification ledger](docs/implementation-status.md) for verified coverage and remaining phase acceptance work.

## Deployment

Set the hosting project's Root Directory to the repository root (empty or `.`), replacing any existing `code` setting. Build with `pnpm build`; start with `pnpm start`. `vercel.json`, Prisma migrations and the environment example are also at the root.

Local reference documents, original font source files, unfinished integration fixtures, environment files and generated artifacts are ignored. Runtime fonts remain tracked under `public/fonts`.
