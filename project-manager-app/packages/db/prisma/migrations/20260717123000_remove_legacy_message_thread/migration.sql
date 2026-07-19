-- Remove the legacy Message / MessageThread tables that were superseded by
-- ConversationThread / ConversationMessage in migration 20260519000000_communications_gateway.
-- These tables have no active consumers in the application code and no tenantId columns,
-- so they cannot be migrated into the canonical communications schema.
DROP TABLE "Message" CASCADE;
DROP TABLE "MessageThread" CASCADE;
