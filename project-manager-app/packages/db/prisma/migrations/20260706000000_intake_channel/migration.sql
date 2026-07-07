-- SAT-002 — Canal de origen del intake (docs/specs/satellites/SAT-002-alexa-voice-channel.spec.md)
-- 'web' (default), 'alexa' u otros canales satélite validados por satellite token.

-- AlterTable
ALTER TABLE "ProjectIntake" ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'web';
