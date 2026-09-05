"""Build the schema section of the system prompt from the live database.

DealFlow360 has 50 tables and 34 enums, and the Prisma schema moves. Hand-writing
that into a prompt guarantees it goes stale the first time someone runs a
migration, and a stale prompt produces confidently wrong SQL. So the digest is
introspected from `information_schema` once per process and cached.

It is deliberately terse — one line per table, foreign keys as arrows, enums
listed once — because the model has to hold the whole thing in working memory
while writing a query. The prose that follows it in the prompt (see prompt.py)
is where the business rules live; this file only states what exists.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from sqlalchemy import text

from .db import engine

log = logging.getLogger("assistant.schema")

_COLUMNS = """
SELECT c.table_name,
       c.column_name,
       c.data_type,
       c.udt_name,
       c.is_nullable
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
ORDER BY c.table_name, c.ordinal_position
"""

_FOREIGN_KEYS = """
SELECT tc.table_name       AS child_table,
       kcu.column_name     AS child_column,
       ccu.table_name      AS parent_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name AND kcu.table_schema = tc.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
"""

_ENUMS = """
SELECT t.typname AS enum_name, e.enumlabel AS value
FROM pg_type t
JOIN pg_enum e ON e.enumtypid = t.oid
JOIN pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public'
ORDER BY t.typname, e.enumsortorder
"""

# Postgres type names compressed to something a model reads at a glance.
_SHORT_TYPES = {
    "character varying": "text",
    "text": "text",
    "integer": "int",
    "bigint": "int",
    "smallint": "int",
    "numeric": "num",
    "double precision": "num",
    "boolean": "bool",
    "timestamp without time zone": "ts",
    "timestamp with time zone": "ts",
    "date": "date",
    "jsonb": "json",
    "json": "json",
    "ARRAY": "[]",
}

# Prisma's internal tables carry no business meaning; leaving them in only
# invites the model to query migration history when it is confused.
_HIDDEN_TABLES = {"_prisma_migrations"}


def _short_type(data_type: str, udt_name: str) -> str:
    if data_type == "USER-DEFINED":
        return udt_name  # an enum: the name doubles as a pointer to the enum list
    if data_type == "ARRAY":
        return f"{_SHORT_TYPES.get(udt_name.lstrip('_'), udt_name.lstrip('_'))}[]"
    return _SHORT_TYPES.get(data_type, data_type)


@lru_cache(maxsize=1)
def _introspect() -> tuple[list[str], list[str], list[str]]:
    """One compact description of every table, column, FK and enum."""
    with engine().connect() as conn:
        columns = conn.execute(text(_COLUMNS)).mappings().all()
        foreign_keys = conn.execute(text(_FOREIGN_KEYS)).mappings().all()
        enums = conn.execute(text(_ENUMS)).mappings().all()

    fk_targets: dict[tuple[str, str], str] = {
        (fk["child_table"], fk["child_column"]): fk["parent_table"] for fk in foreign_keys
    }

    tables: dict[str, list[str]] = {}
    for column in columns:
        table = column["table_name"]
        if table in _HIDDEN_TABLES:
            continue
        name = column["column_name"]
        parent = fk_targets.get((table, name))
        if parent:
            rendered = f"{name}->{parent}"
        else:
            rendered = f"{name}:{_short_type(column['data_type'], column['udt_name'])}"
        tables.setdefault(table, []).append(rendered)

    table_lines = [
        f'"{table}"({", ".join(cols)})' for table, cols in sorted(tables.items())
    ]

    enum_values: dict[str, list[str]] = {}
    for row in enums:
        enum_values.setdefault(row["enum_name"], []).append(row["value"])
    enum_lines = [
        f"{name} = {'|'.join(values)}" for name, values in sorted(enum_values.items())
    ]

    # Which tables are soft-deleted is left to the caller rather than inferred by
    # the model. Asked to work it out from the column lists it guesses, and adds
    # `"deletedAt" IS NULL` to tables like "Quotation" that have no such column —
    # costing a failed query and a retry on nearly every question.
    soft_deleted = sorted(
        table
        for table, cols in tables.items()
        if any(col.startswith("deletedAt:") for col in cols)
    )

    log.info(
        "schema digest: %d tables (%d soft-deleted), %d enums",
        len(table_lines),
        len(soft_deleted),
        len(enum_lines),
    )
    return table_lines, enum_lines, soft_deleted


def schema_digest() -> str:
    """The tables-and-enums block of the system prompt."""
    table_lines, enum_lines, _ = _introspect()
    return (
        "TABLES (column:type, or column->referenced table):\n"
        + "\n".join(table_lines)
        + "\n\nENUM VALUES:\n"
        + "\n".join(enum_lines)
    )


def soft_deleted_tables() -> list[str]:
    """Exactly the tables that carry a `deletedAt` column."""
    return _introspect()[2]
