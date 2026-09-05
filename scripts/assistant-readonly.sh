#!/usr/bin/env bash
# Create/refresh the SELECT-only Postgres role the assistant connects as.
#
#   pnpm assistant:grant
#
# Runs against the dev container from compose.dev.yml by default. Re-run after
# `prisma migrate` so newly created tables are granted too (ALTER DEFAULT
# PRIVILEGES only covers tables created *after* it was set).
set -euo pipefail

CONTAINER="${ASSISTANT_DB_CONTAINER:-qubits-dealflow-db-1}"
DB_USER="${POSTGRES_USER:-dealflow}"
DB_NAME="${POSTGRES_DB:-dealflow_dev}"

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "postgres container '$CONTAINER' is not running — start it with 'pnpm db:up'." >&2
  echo "For a hosted database, pipe prisma/sql/readonly-role.sql to psql yourself." >&2
  exit 1
fi

docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" \
  < "$(dirname "$0")/../prisma/sql/readonly-role.sql"

echo "granted: dealflow_readonly can SELECT and nothing else on $DB_NAME"
