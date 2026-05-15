#!/bin/bash
set -e

echo "[prisma-deploy] Starting migration deploy..."

# Attempt normal migrate deploy
set +e
DEPLOY_OUTPUT=$(prisma migrate deploy 2>&1)
DEPLOY_EXIT=$?
set -e

if [ $DEPLOY_EXIT -eq 0 ]; then
  echo "[prisma-deploy] ✓ Migrations applied"
  exit 0
fi

# P3005: DB has existing schema but no migration history
# Fix: sync schema via db push (additive, no data loss), then baseline all migrations
if echo "$DEPLOY_OUTPUT" | grep -q "P3005"; then
  echo "[prisma-deploy] ⚠ P3005 detected — DB has schema without migration history"
  echo "[prisma-deploy] Running db push to sync schema..."

  prisma db push --skip-generate --accept-data-loss=false

  echo "[prisma-deploy] Baselining all migrations..."

  prisma migrate resolve --applied 20260309205333_init
  prisma migrate resolve --applied 20260310045500_dispute_assignment_fields
  prisma migrate resolve --applied 20260310052000_agent_run_lifecycle_fields
  prisma migrate resolve --applied 20260312160000_job_reservations_contracts_transition
  prisma migrate resolve --applied 20260312190000_payment_escrow_job_contract_link
  prisma migrate resolve --applied 20260313183000_bid_professional_user_bridge
  prisma migrate resolve --applied 20260408133000_soft_delete_and_runtime_indexes
  prisma migrate resolve --applied 20260408183000_agent_approval_persistence
  prisma migrate resolve --applied 20260409160000_tracker_sessions
  prisma migrate resolve --applied 20260409195000_autonomous_pr_runs
  prisma migrate resolve --applied 20260416021500_workspace_memory_entries
  prisma migrate resolve --applied 20260419000000_agent_run_idempotency
  prisma migrate resolve --applied 20260419000100_workspace_memory_fts_index
  prisma migrate resolve --applied 20260419001000_tasks_incidents_materials
  prisma migrate resolve --applied 20260422000000_travel_ops
  prisma migrate resolve --applied 20260422010000_travel_google_places
  prisma migrate resolve --applied 20260423010000_developer_runtime_persistence
  prisma migrate resolve --applied 20260424000000_user_profile
  prisma migrate resolve --applied 20260424010000_agent_work_plan
  prisma migrate resolve --applied 20260424020000_agent_memory
  prisma migrate resolve --applied 20260424030000_agent_work_plan_meta
  prisma migrate resolve --applied 20260425000000_agent_delegation
  prisma migrate resolve --applied 20260425010000_user_profile_assistant_prefs
  prisma migrate resolve --applied 20260427000000_prometeo_engine
  prisma migrate resolve --applied 20260428000000_ai_models_logging
  prisma migrate resolve --applied 20260428010000_ai_interaction_thread_id
  prisma migrate resolve --applied 20260504235951_sync_schema_drift
  prisma migrate resolve --applied 20260505000000_buildops_projects
  prisma migrate resolve --applied 20260506000000_buildops_tasks
  prisma migrate resolve --applied 20260511000000_project_intake
  prisma migrate resolve --applied 20260511020000_intake_operations_bridge
  prisma migrate resolve --applied 20260512100000_buildops_client_approval
  prisma migrate resolve --applied 20260512110000_security_hardening
  prisma migrate resolve --applied 20260512143000_buildops_legacy_promotion_trace
  prisma migrate resolve --applied 20260512170000_buildops_plan_versions
  prisma migrate resolve --applied 20260514000000_algorithm_run_milestone_evidence
  prisma migrate resolve --applied 20260514010000_change_order_candidate

  echo "[prisma-deploy] ✓ Baseline complete — schema synced and migration history initialized"
  exit 0
fi

# Any other migration error: fail loudly
echo "[prisma-deploy] ✗ Migration failed with unexpected error:"
echo "$DEPLOY_OUTPUT"
exit 1
