"""The single connection the assistant is allowed to use.

One process-wide engine bound to the SELECT-only role, and one function that
runs a validated statement inside an explicitly READ ONLY transaction.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from datetime import date, datetime
from functools import lru_cache
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

from .readonly import apply_row_cap, ensure_readonly
from .settings import settings

log = logging.getLogger("assistant.db")


@lru_cache(maxsize=1)
def engine() -> Engine:
    """Connection pool for the read-only role.

    `pool_pre_ping` matters here because the agent is idle between questions and
    Postgres (or Docker's network) will have dropped the socket by the time the
    next one arrives.
    """
    return create_engine(
        settings.sqlalchemy_url,
        pool_size=3,
        max_overflow=2,
        pool_pre_ping=True,
        pool_recycle=300,
        connect_args={"application_name": "dealflow-assistant"},
    )


def _render(value: Any) -> Any:
    """Make a row value safe to put in a prompt and in JSON."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, (bytes, memoryview)):
        return "<binary>"
    return value


def run_select(sql: str) -> list[dict[str, Any]]:
    """Validate, cap and execute a read. Raises UnsafeSQL if it is not a read."""
    statement = ensure_readonly(sql)
    capped = apply_row_cap(statement, settings.assistant_max_result_rows)

    with engine().connect() as conn:
        # Belt and braces: the role already defaults to read-only, but an
        # explicit READ ONLY transaction means this holds even if someone points
        # the service at a database where the role was never created.
        # exec_driver_sql, not text(): generated SQL is full of `::numeric`
        # casts and `LIKE '%...%'`, which SQLAlchemy's text() would try to read
        # as bind parameters. This hands the string straight to psycopg.
        conn.exec_driver_sql("SET TRANSACTION READ ONLY")
        result = conn.exec_driver_sql(capped)
        rows = [
            {key: _render(value) for key, value in row.items()}
            for row in result.mappings()
        ]

    log.info("ran read (%d rows): %s", len(rows), capped.replace("\n", " ")[:300])
    return rows
