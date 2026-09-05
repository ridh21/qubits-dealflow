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
