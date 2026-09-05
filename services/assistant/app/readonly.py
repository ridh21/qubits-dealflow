"""Read-only enforcement for assistant-generated SQL.

Three independent layers, because a system prompt is a request, not a
constraint, and the model writing the SQL is the untrusted part:

  1. The Postgres role (prisma/sql/readonly-role.sql) holds SELECT and nothing
     else, and runs with `default_transaction_read_only = on`. Even a perfect
     jailbreak cannot write through it.
  2. This module rejects anything that is not a single SELECT/WITH statement
     before it reaches the connection.
  3. Every statement runs inside an explicitly READ ONLY transaction with a
     statement timeout, so a runaway query cannot pin a connection.

Layer 1 is the guarantee. Layers 2 and 3 exist so a rejected attempt produces a
clear error the model can recover from, instead of a Postgres permission fault
mid-answer.
"""

from __future__ import annotations

import re

# Statement kinds that must never run, even though the role already lacks the
# privilege. Matched as whole words so a column named "update_note" is fine.
FORBIDDEN = (
    "insert",
    "update",
    "delete",
    "drop",
    "alter",
    "create",
    "truncate",
    "grant",
    "revoke",
    "comment",
    "merge",
    "call",
    "do",
    "copy",
    "vacuum",
    "analyze",
    "reindex",
    "cluster",
    "refresh",
    "listen",
    "notify",
    "prepare",
    "execute",
    "deallocate",
    "lock",
    "set",
    "reset",
    "begin",
    "commit",
    "rollback",
    "savepoint",
    "security",
    "import",
    "pg_read_file",
    "pg_read_binary_file",
    "pg_ls_dir",
    "lo_import",
    "lo_export",
    "dblink",
    "pg_sleep",
)

_LINE_COMMENT = re.compile(r"--[^\n]*")
_BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
_STRING_LITERAL = re.compile(r"'(?:[^']|'')*'")
_QUOTED_IDENT = re.compile(r'"(?:[^"]|"")*"')
_LIMIT_TAIL = re.compile(r"\blimit\s+\d+\s*(?:offset\s+\d+\s*)?$", re.IGNORECASE)


class UnsafeSQL(ValueError):
    """Raised when generated SQL is not a plain read."""


def _strip_noise(sql: str) -> str:
    """Remove comments, string literals and quoted identifiers.

    Keyword scanning happens on the result, so `WHERE "reason" = 'delete me'`
    cannot be mistaken for a DELETE, and `/* delete */` cannot smuggle one in.
    """
    out = _BLOCK_COMMENT.sub(" ", sql)
    out = _LINE_COMMENT.sub(" ", out)
    out = _STRING_LITERAL.sub("''", out)
    out = _QUOTED_IDENT.sub('""', out)
    return out


def _split_statements(sql: str) -> list[str]:
    """Split on semicolons that are not inside a literal or quoted identifier."""
    parts: list[str] = []
    current: list[str] = []
    in_string = False
    in_ident = False
    for char in sql:
        if char == "'" and not in_ident:
            in_string = not in_string
        elif char == '"' and not in_string:
            in_ident = not in_ident
        if char == ";" and not in_string and not in_ident:
            parts.append("".join(current))
            current = []
            continue
        current.append(char)
    parts.append("".join(current))
    return [p.strip() for p in parts if p.strip()]


def ensure_readonly(sql: str) -> str:
    """Validate `sql` as a single read, returning it normalized.

    Raises UnsafeSQL with a message written for the model to act on, since the
    agent gets one chance to rewrite a rejected query.
    """
    statements = _split_statements(sql)
    if not statements:
        raise UnsafeSQL("The query was empty.")
    if len(statements) > 1:
        raise UnsafeSQL(
            "Only one statement is allowed. Send a single SELECT, with no semicolons."
        )

    statement = statements[0]
    scanned = _strip_noise(statement).lower()

    if not re.match(r"^\s*(select|with)\b", scanned):
        raise UnsafeSQL(
            "Only SELECT queries are allowed. This assistant is read-only and cannot "
            "insert, update or delete anything."
        )

    for word in FORBIDDEN:
        if re.search(rf"(?<![\w.]){re.escape(word)}(?![\w])", scanned):
            raise UnsafeSQL(
                f"'{word}' is not permitted. This assistant is read-only: rewrite the "
                "question as a plain SELECT."
            )

    return statement


def apply_row_cap(sql: str, cap: int) -> str:
    """Append `LIMIT cap` unless the query already ends in one within the cap.

    Aggregates return a single row and are unaffected. A model-written
    `LIMIT 500` is lowered to the cap; a `LIMIT 5` is left alone.
    """
    trimmed = sql.rstrip().rstrip(";").rstrip()
    match = _LIMIT_TAIL.search(_strip_noise(trimmed))
    if not match:
        return f"{trimmed} LIMIT {cap}"

    existing = int(re.search(r"\d+", match.group(0)).group(0))
    if existing <= cap:
        return trimmed
    return _LIMIT_TAIL.sub(f"LIMIT {cap} ", trimmed).rstrip()
