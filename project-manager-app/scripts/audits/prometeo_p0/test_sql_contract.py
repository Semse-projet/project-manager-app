"""SQL contract checks only, NOT live PostgreSQL integration tests."""
import re
from pathlib import Path

from evaluate_inventory import EXPECTED

SQL = (Path(__file__).parent / "prometeo_p0_historical_inventory_json_readonly.sql").read_text(encoding="utf-8")


def uncomment(value):
    return re.sub(r"--[^\n]*", "", value)


def test_read_only_transaction_and_limits():
    query = uncomment(SQL)
    assert "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY;" in query
    assert "SET LOCAL statement_timeout = '15s';" in query
    assert "SET LOCAL lock_timeout = '2s';" in query
    assert "SET LOCAL idle_in_transaction_session_timeout = '30s';" in query
    assert query.strip().endswith("ROLLBACK;")


def test_no_mutation_statements():
    query = uncomment(SQL)
    assert not re.search(r"\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|COPY|CALL|EXECUTE|VACUUM|ANALYZE|REFRESH|GRANT|REVOKE)\b", query, re.I)


def test_no_sensitive_fields_projected():
    query = uncomment(SQL)
    for expression in ['"text"', '"note"', '"email"', '"title"', '"embeddingJson"']:
        assert expression not in query
    assert "SELECT *" not in query.upper()
    assert "jsonb_build_object(" in query


def test_json_groups_are_explicit():
    for group in ("documents", "grants", "chunks", "feedback", "audit_events"):
        assert re.search(rf"'{group}'\s*,", SQL)


def test_expected_aggregate_fields_are_projected_once():
    for group, metrics in EXPECTED.items():
        for name in metrics:
            assert len(re.findall(r"\bAS\s+" + name + r"\b", SQL)) == 1, (group, name)


def test_known_tables_only():
    tables = set(re.findall(r"\b(?:FROM|JOIN)\s+\"([A-Za-z]+)\"", SQL))
    assert tables == {
        "PrometeoDocument", "Org", "Project", "Job", "PrometeoDocumentGrant",
        "DocumentChunk", "PrometeoChunkFeedback", "AuditLog",
    }


def test_no_raw_identifiers_emitted_in_final_json():
    final = SQL.split("SELECT jsonb_build_object(", 1)[1]
    assert "'source_kind'" in final
    assert "'snapshot_utc'" in final
    assert not re.search(r"'(?:orgId|documentId|recipientOrgId|userId|title|text)'", final)


def test_transaction_is_single_json_result_and_rolls_back():
    assert SQL.count("jsonb_build_object(") == 1
    assert "to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'" in SQL
    assert SQL.strip().endswith("ROLLBACK;")
