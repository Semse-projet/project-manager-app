"""Offline guard for aggregate-only Prometeo P0 #974 inventory.

Never contacts PostgreSQL, never returns permission to activate document
sharing. The source_kind label is not independent proof of provenance.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from pathlib import Path

EXPECTED = {
    'documents': (
        'documents_total', 'indexed_documents', 'without_project',
        'blank_owner_org', 'owner_org_not_in_tenant',
        'project_missing_in_tenant', 'project_or_job_missing_in_tenant',
        'owner_not_project_participant', 'legacy_public_training',
        'tenant_private_labels', 'project_private_labels',
        'tenant_private_with_project', 'project_private_without_project',
        'missing_visibility_metadata', 'unexpected_visibility_label',
    ),
    'grants': (
        'grants_total', 'grants_active', 'grants_revoked',
        'grant_missing_document', 'recipient_not_in_tenant',
        'grant_document_scope_mismatch',
        'active_grants_failing_project_participants',
    ),
    'chunks': (
        'chunks_total', 'orphan_chunks', 'chunk_tenant_mismatch',
        'negative_token_count',
    ),
    'feedback': (
        'feedback_total', 'orphan_feedback_chunk',
        'feedback_tenant_or_document_mismatch',
    ),
}

INTEGRITY = {
    'documents': (
        'blank_owner_org', 'owner_org_not_in_tenant',
        'project_missing_in_tenant', 'project_or_job_missing_in_tenant',
        'owner_not_project_participant',
    ),
    'grants': (
        'grant_missing_document', 'recipient_not_in_tenant',
        'grant_document_scope_mismatch',
        'active_grants_failing_project_participants',
    ),
    'chunks': (
        'orphan_chunks', 'chunk_tenant_mismatch', 'negative_token_count',
    ),
    'feedback': (
        'orphan_feedback_chunk', 'feedback_tenant_or_document_mismatch',
    ),
}

REVIEW = {
    'documents': (
        'legacy_public_training', 'missing_visibility_metadata',
        'tenant_private_with_project', 'project_private_without_project',
        'unexpected_visibility_label',
    ),
    'grants': ('grants_active',),
}


class InvalidEvidence(ValueError):
    pass


def evaluate(data: dict) -> dict:
    """Fail closed on missing or malformed data; never infer user consent."""
    if type(data) is not dict:
        raise InvalidEvidence('Evidence must be a JSON object')
    if data.get('source_kind') != 'authorized_postgresql_aggregate_inventory':
        raise InvalidEvidence('Evidence source kind is missing or invalid')
    timestamp = data.get('snapshot_utc')
    if type(timestamp) is not str or not re.fullmatch(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z', timestamp):
        raise InvalidEvidence('Timestamp must use YYYY-MM-DDTHH:MM:SS(.fraction)Z')
    try:
        datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
    except ValueError as err:
        raise InvalidEvidence('Invalid UTC timestamp date/time') from err
    allowed_top = {'source_kind', 'snapshot_utc', 'documents', 'grants', 'chunks', 'feedback', 'audit_events'}
    if set(data) != allowed_top:
        raise InvalidEvidence('Missing/extra top-level evidence fields')
    audit = data.get('audit_events')
    if type(audit) is not dict:
        raise InvalidEvidence('Missing audit events aggregate')
    allowed_actions = {
        'prometeo.document_share_granted',
        'prometeo.document_share_revoked',
        'prometeo.document_share_revoked_by_delete',
    }
    if set(audit).difference(allowed_actions):
        raise InvalidEvidence('Unknown audit action: only allowlisted aggregates accepted')
    if any(type(n) is not int or n < 0 for n in audit.values()):
        raise InvalidEvidence('Invalid audit event count')
    for category, fields in EXPECTED.items():
        part = data.get(category)
        if type(part) is not dict:
            raise InvalidEvidence(f'Missing required aggregate group: {category}')
        extra = set(part).difference(fields)
        if extra:
            raise InvalidEvidence(f'Unexpected fields in {category}; IDs/content forbidden: {len(extra)} extra fields')
        for key in fields:
            val = part.get(key)
            if type(val) is not int or val < 0:
                raise InvalidEvidence(f'Missing/non-integer/negative count: {category}.{key}')
            if key != fields[0] and val > part.get(fields[0], -1):
                raise InvalidEvidence(f'Count exceeds group total: {category}.{key}')
    grants = data['grants']
    if grants['grants_active'] + grants['grants_revoked'] != grants['grants_total']:
        raise InvalidEvidence('Grant counts are inconsistent')
    documents = data['documents']
    visibility_sum = sum(documents[k] for k in (
        'legacy_public_training', 'tenant_private_labels',
        'project_private_labels', 'missing_visibility_metadata',
        'unexpected_visibility_label'))
    if visibility_sum != documents['documents_total']:
        raise InvalidEvidence('Visibility class counts do not partition documents')
    if documents['project_or_job_missing_in_tenant'] < documents['project_missing_in_tenant']:
        raise InvalidEvidence('Project+job missing must include missing projects')
    if documents['tenant_private_with_project'] > documents['tenant_private_labels'] or documents['project_private_without_project'] > documents['project_private_labels']:
        raise InvalidEvidence('Visibility/project inconsistency exceeds its visibility class')
    if documents['indexed_documents'] > documents['documents_total']:
        raise InvalidEvidence('Indexed docs exceed total')
    integrity = [f'{section}.{key}' for section, keys in INTEGRITY.items()
                 for key in keys if data[section][key] > 0]
    review = [f'{section}.{key}' for section, keys in REVIEW.items()
              for key in keys if data[section][key] > 0]
    if grants['grants_total'] > 0 and sum(audit.values()) == 0:
        review.append('audit_events.no_share_events_with_grants')
    return {
        'data_quality_assessment': 'HOLD_INTEGRITY' if integrity else ('HOLD_CLASSIFICATION' if review else 'NO_FLAGGED_AGGREGATE_ANOMALIES'),
        'integrity_flags': integrity,
        'classification_flags': review,
        'documents_total': documents['documents_total'],
        'grants_total': grants['grants_total'],
        'chunks_total': data['chunks']['chunks_total'],
        'feedback_total': data['feedback']['feedback_total'],
        'activation_decision': 'NOT_AUTHORIZED_BY_THIS_AUDIT',
        'limitations': 'Counts are not consent decisions, privacy audit, data sampling or proof of no historical exposure',
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='Offline aggregate-only assessment (never a sharing GO decision)')
    parser.add_argument('json_path', help='Approved aggregate result JSON; no raw content or identifiers')
    args = parser.parse_args()
    try:
        def no_duplicate_keys(pairs):
            result = {}
            for key, value in pairs:
                if key in result:
                    raise InvalidEvidence('Duplicated JSON evidence field')
                result[key] = value
            return result

        evidence = json.loads(
            Path(args.json_path).read_text(encoding='utf-8'),
            object_pairs_hook=no_duplicate_keys,
            parse_constant=lambda value: (_ for _ in ()).throw(InvalidEvidence('Non-finite JSON value')),
        )
        result = evaluate(evidence)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print('P0_INVENTORY_EVIDENCE_REJECTED: ' + str(exc), file=sys.stderr)
        return 2
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result['data_quality_assessment'] == 'NO_FLAGGED_AGGREGATE_ANOMALIES' else 1


if __name__ == '__main__':
    raise SystemExit(main())
