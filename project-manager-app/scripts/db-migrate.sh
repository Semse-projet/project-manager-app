#!/bin/bash
set -e
# Runs from /app — prisma CLI via node_modules/.bin
PRISMA="./node_modules/.bin/prisma"
SCHEMA="./packages/db/prisma/schema.prisma"

echo "[db-migrate] Starting..."

set +e
OUTPUT=$($PRISMA migrate deploy --schema "$SCHEMA" 2>&1)
EXIT=$?
set -e

if [ $EXIT -eq 0 ]; then
  echo "[db-migrate] ✓ Migrations applied"
  exit 0
fi

if echo "$OUTPUT" | grep -q "P3005"; then
  echo "[db-migrate] ⚠ P3005 — DB has schema without migration history. Baselining..."

  $PRISMA db push --schema "$SCHEMA" --skip-generate --accept-data-loss=false

  MIGRATIONS="
    20260309205333_init
    20260310045500_dispute_assignment_fields
    20260310052000_agent_run_lifecycle_fields
    20260312160000_job_reservations_contracts_transition
    20260312190000_payment_escrow_job_contract_link
    20260313183000_bid_professional_user_bridge
    20260408133000_soft_delete_and_runtime_indexes
    20260408183000_agent_approval_persistence
    20260409160000_tracker_sessions
    20260409195000_autonomous_pr_runs
    20260416021500_workspace_memory_entries
    20260419000000_agent_run_idempotency
    20260419000100_workspace_memory_fts_index
    20260419001000_tasks_incidents_materials
    20260422000000_travel_ops
    20260422010000_travel_google_places
    20260423010000_developer_runtime_persistence
    20260424000000_user_profile
    20260424010000_agent_work_plan
    20260424020000_agent_memory
    20260424030000_agent_work_plan_meta
    20260425000000_agent_delegation
    20260425010000_user_profile_assistant_prefs
    20260427000000_prometeo_engine
    20260428000000_ai_models_logging
    20260428010000_ai_interaction_thread_id
    20260504235951_sync_schema_drift
    20260505000000_buildops_projects
    20260506000000_buildops_tasks
    20260511000000_project_intake
    20260511020000_intake_operations_bridge
    20260512100000_buildops_client_approval
    20260512110000_security_hardening
    20260512143000_buildops_legacy_promotion_trace
    20260512170000_buildops_plan_versions
    20260514000000_algorithm_run_milestone_evidence
    20260514010000_change_order_candidate
  "

  for M in $MIGRATIONS; do
    $PRISMA migrate resolve --schema "$SCHEMA" --applied "$M"
  done

  echo "[db-migrate] ✓ Baseline complete"
  exit 0
fi

echo "[db-migrate] ✗ Unexpected error:"
echo "$OUTPUT"
exit 1
