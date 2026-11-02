"""Synthetic-only tests for the Prometeo P0 aggregate evaluator; no database."""
import json
import sys
from copy import deepcopy

import pytest

from evaluate_inventory import EXPECTED, InvalidEvidence, evaluate, main


def fixture():
    return {
        "source_kind": "authorized_postgresql_aggregate_inventory",
        "snapshot_utc": "2026-11-01T21:24:40.123Z",
        "audit_events": {},
        **{name: {metric: 0 for metric in metrics}
           for name, metrics in EXPECTED.items()},
    }


def test_zero_counts_never_authorize():
    result = evaluate(fixture())
    assert result["data_quality_assessment"] == "NO_FLAGGED_AGGREGATE_ANOMALIES"
    assert result["activation_decision"] == "NOT_AUTHORIZED_BY_THIS_AUDIT"


@pytest.mark.parametrize("section,total,metric", [
    ("documents", "documents_total", "owner_org_not_in_tenant"),
    ("documents", "documents_total", "project_missing_in_tenant"),
    ("grants", "grants_total", "grant_document_scope_mismatch"),
    ("grants", "grants_total", "recipient_not_in_tenant"),
    ("chunks", "chunks_total", "chunk_tenant_mismatch"),
    ("feedback", "feedback_total", "feedback_tenant_or_document_mismatch"),
])
def test_integrity_flags_fail_closed(section, total, metric):
    d = fixture()
    d[section][total] = 1
    d[section][metric] = 1
    if section == "documents":
        d["documents"]["tenant_private_labels"] = 1
        if metric == "project_missing_in_tenant":
            d["documents"]["project_or_job_missing_in_tenant"] = 1
    if section == "grants":
        d["grants"]["grants_active"] = 1
    result = evaluate(d)
    assert result["data_quality_assessment"] == "HOLD_INTEGRITY"
    assert section + "." + metric in result["integrity_flags"]
    assert result["activation_decision"] == "NOT_AUTHORIZED_BY_THIS_AUDIT"


def test_legacy_public_training_not_consent():
    d = fixture()
    d["documents"].update(documents_total=1, legacy_public_training=1)
    assert evaluate(d)["data_quality_assessment"] == "HOLD_CLASSIFICATION"


def test_active_grant_not_consent():
    d = fixture()
    d["grants"].update(grants_total=1, grants_active=1)
    assert "grants.grants_active" in evaluate(d)["classification_flags"]


def test_missing_audit_with_grants_requires_review():
    d = fixture()
    d["grants"].update(grants_total=1, grants_revoked=1)
    assert "audit_events.no_share_events_with_grants" in evaluate(d)["classification_flags"]


@pytest.mark.parametrize("mutation", [
    lambda d: d.pop("chunks"),
    lambda d: d["documents"].__setitem__("title", "secret"),
    lambda d: d["feedback"].__setitem__("feedback_total", -1),
    lambda d: d["feedback"].__setitem__("feedback_total", True),
    lambda d: d.__setitem__("source_kind", "screenshot"),
    lambda d: d.__setitem__("snapshot_utc", "2026-02-30T10:00:00Z"),
    lambda d: d["documents"].__setitem__("documents_total", 1),
    lambda d: d["grants"].update(grants_total=2, grants_active=1),
    lambda d: d["chunks"].update(chunks_total=1, orphan_chunks=2),
    lambda d: d["audit_events"].__setitem__("unknown_action", 1),
])
def test_reject_malformed_evidence(mutation):
    d = fixture()
    mutation(d)
    with pytest.raises(InvalidEvidence):
        evaluate(d)


def test_visibility_class_mismatch_requires_review():
    d = fixture()
    d["documents"].update(documents_total=1, tenant_private_labels=1,
                          tenant_private_with_project=1)
    assert "documents.tenant_private_with_project" in evaluate(d)["classification_flags"]


def test_no_identity_in_output():
    result = evaluate(fixture())
    assert all(term not in str(result)
               for term in ("email", "documentId", "orgId", "userId", "title", "text"))


def test_duplicate_json_key_rejected_at_cli(tmp_path, capsys, monkeypatch):
    data = fixture()
    payload = json.dumps(data).replace(
        '"source_kind":', '"source_kind": "authorized_postgresql_aggregate_inventory", "source_kind":', 1
    )
    file = tmp_path / "duplicate.json"
    file.write_text(payload, encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["evaluate_inventory.py", str(file)])
    assert main() == 2
    assert "Duplicated JSON evidence field" in capsys.readouterr().err


def test_valid_json_cli_fails_never_authorizes(tmp_path, capsys, monkeypatch):
    file = tmp_path / "counts.json"
    file.write_text(json.dumps(fixture()), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["evaluate_inventory.py", str(file)])
    assert main() == 0
    assert "NOT_AUTHORIZED_BY_THIS_AUDIT" in capsys.readouterr().out
