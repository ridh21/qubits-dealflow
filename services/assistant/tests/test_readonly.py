"""The SQL guard is the layer that turns a rejected write into a message the
model can recover from, so its failure mode matters more than most code here:
a false negative silently forwards a write to Postgres, and a false positive
makes an ordinary question unanswerable."""

import pytest

from app.readonly import UnsafeSQL, apply_row_cap, ensure_readonly


def test_accepts_a_plain_select():
    sql = 'SELECT COUNT(*) FROM "Quotation" WHERE "status" = \'CONFIRMED\''
    assert ensure_readonly(sql) == sql


def test_accepts_a_cte():
    sql = 'WITH open AS (SELECT * FROM "Order") SELECT COUNT(*) FROM open'
    assert ensure_readonly(sql) == sql


@pytest.mark.parametrize(
    "sql",
    [
        'DELETE FROM "Quotation"',
        'UPDATE "Invoice" SET "paidMinor" = 0',
        'INSERT INTO "Payment" ("amountMinor") VALUES (1)',
        'DROP TABLE "Order"',
        'TRUNCATE "Customer"',
        "GRANT ALL ON ALL TABLES IN SCHEMA public TO dealflow_readonly",
    ],
)
def test_rejects_writes(sql):
    with pytest.raises(UnsafeSQL):
        ensure_readonly(sql)


def test_rejects_a_write_smuggled_after_a_select():
    with pytest.raises(UnsafeSQL, match="one statement"):
        ensure_readonly('SELECT 1; DELETE FROM "Quotation"')


def test_rejects_a_data_modifying_cte():
    # The dangerous shape: it starts with WITH and looks like a read.
    with pytest.raises(UnsafeSQL):
        ensure_readonly(
            'WITH gone AS (DELETE FROM "Quotation" RETURNING *) SELECT * FROM gone'
        )


def test_rejects_a_write_hidden_in_a_comment_block():
    with pytest.raises(UnsafeSQL):
        ensure_readonly('/* comment */ UPDATE "Order" SET "status" = \'OPEN\'')


def test_a_forbidden_word_inside_a_string_is_not_a_write():
    # 'DELETE' here is data, not a verb. Rejecting this would make a legitimate
    # question about audit-log actions unanswerable.
    sql = "SELECT * FROM \"AuditLog\" WHERE \"action\" = 'DELETE'"
    assert ensure_readonly(sql) == sql


def test_a_forbidden_word_inside_an_identifier_is_not_a_write():
    sql = 'SELECT "deletedAt", "updatedAt" FROM "Product"'
    assert ensure_readonly(sql) == sql


def test_offset_is_not_read_as_set():
    sql = 'SELECT "id" FROM "Order" ORDER BY "confirmedAt" OFFSET 10'
    assert ensure_readonly(sql) == sql


def test_row_cap_is_appended_when_absent():
    assert apply_row_cap('SELECT * FROM "Order"', 30) == 'SELECT * FROM "Order" LIMIT 30'


def test_row_cap_leaves_a_smaller_limit_alone():
    sql = 'SELECT * FROM "Order" LIMIT 5'
    assert apply_row_cap(sql, 30) == sql


def test_row_cap_lowers_an_oversized_limit():
    assert apply_row_cap('SELECT * FROM "Order" LIMIT 5000', 30) == (
        'SELECT * FROM "Order" LIMIT 30'
    )


def test_row_cap_ignores_a_trailing_semicolon():
    assert apply_row_cap('SELECT 1;', 30) == "SELECT 1 LIMIT 30"
