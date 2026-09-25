-- Agro Workforce Taxonomy + IncidentOps (docs/specs/agro/AGRO_AS_IS_AUDIT_2026-09-25.md)
-- Migración 100% aditiva: solo CREATE TABLE/INDEX/FK nuevas + seed idempotente.
-- No modifica columnas ni datos existentes.

-- CreateTable
CREATE TABLE "AgroFarmMember" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "displayName" TEXT,
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroFarmMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroRole" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "species" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroSpecialty" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "species" TEXT,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroSpecialty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroRoleSpecialty" (
    "roleId" TEXT NOT NULL,
    "specialtyId" TEXT NOT NULL,

    CONSTRAINT "AgroRoleSpecialty_pkey" PRIMARY KEY ("roleId","specialtyId")
);

-- CreateTable
CREATE TABLE "AgroCapability" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "specialtyId" TEXT,
    "parentId" TEXT,
    "requiresProfessional" BOOLEAN NOT NULL DEFAULT false,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT true,
    "validityDays" INTEGER,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroWorkerRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "farmId" TEXT,
    "assignedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroWorkerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroWorkerCapability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'BASIC',
    "status" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "source" TEXT NOT NULL DEFAULT 'SELF_REPORTED',
    "farmId" TEXT,
    "acquiredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "lastVerificationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroWorkerCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroCapabilityVerification" (
    "id" TEXT NOT NULL,
    "workerCapabilityId" TEXT NOT NULL,
    "capabilityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "verifierId" TEXT NOT NULL,
    "verifierFarmRole" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "levelAssessed" TEXT,
    "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgroCapabilityVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgroIncident" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "farmUnitId" TEXT,
    "animalId" TEXT,
    "animalGroupId" TEXT,
    "cropCycleId" TEXT,
    "inventoryItemId" TEXT,
    "reportedById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "relatedTaskSource" TEXT,
    "relatedTaskId" TEXT,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "severityConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "occurredAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triagedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "duplicateOfId" TEXT,
    "cancelReason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEB',
    "clientEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgroIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgroFarmMember_userId_status_idx" ON "AgroFarmMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgroFarmMember_farmId_userId_key" ON "AgroFarmMember"("farmId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgroRole_key_key" ON "AgroRole"("key");

-- CreateIndex
CREATE INDEX "AgroRole_sector_idx" ON "AgroRole"("sector");

-- CreateIndex
CREATE UNIQUE INDEX "AgroSpecialty_key_key" ON "AgroSpecialty"("key");

-- CreateIndex
CREATE INDEX "AgroSpecialty_sector_idx" ON "AgroSpecialty"("sector");

-- CreateIndex
CREATE INDEX "AgroRoleSpecialty_specialtyId_idx" ON "AgroRoleSpecialty"("specialtyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgroCapability_key_key" ON "AgroCapability"("key");

-- CreateIndex
CREATE INDEX "AgroCapability_specialtyId_idx" ON "AgroCapability"("specialtyId");

-- CreateIndex
CREATE INDEX "AgroCapability_parentId_idx" ON "AgroCapability"("parentId");

-- CreateIndex
CREATE INDEX "AgroCapability_category_idx" ON "AgroCapability"("category");

-- CreateIndex
CREATE INDEX "AgroWorkerRole_userId_idx" ON "AgroWorkerRole"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AgroWorkerRole_userId_roleId_key" ON "AgroWorkerRole"("userId", "roleId");

-- CreateIndex
CREATE INDEX "AgroWorkerCapability_userId_status_idx" ON "AgroWorkerCapability"("userId", "status");

-- CreateIndex
CREATE INDEX "AgroWorkerCapability_capabilityId_status_idx" ON "AgroWorkerCapability"("capabilityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AgroWorkerCapability_userId_capabilityId_key" ON "AgroWorkerCapability"("userId", "capabilityId");

-- CreateIndex
CREATE INDEX "AgroCapabilityVerification_workerCapabilityId_verifiedAt_idx" ON "AgroCapabilityVerification"("workerCapabilityId", "verifiedAt");

-- CreateIndex
CREATE INDEX "AgroCapabilityVerification_userId_idx" ON "AgroCapabilityVerification"("userId");

-- CreateIndex
CREATE INDEX "AgroCapabilityVerification_farmId_verifiedAt_idx" ON "AgroCapabilityVerification"("farmId", "verifiedAt");

-- CreateIndex
CREATE INDEX "AgroIncident_farmId_status_idx" ON "AgroIncident"("farmId", "status");

-- CreateIndex
CREATE INDEX "AgroIncident_farmId_severity_idx" ON "AgroIncident"("farmId", "severity");

-- CreateIndex
CREATE INDEX "AgroIncident_farmId_type_idx" ON "AgroIncident"("farmId", "type");

-- CreateIndex
CREATE INDEX "AgroIncident_assignedToId_status_idx" ON "AgroIncident"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "AgroIncident_reportedById_idx" ON "AgroIncident"("reportedById");

-- CreateIndex
CREATE INDEX "AgroIncident_animalId_idx" ON "AgroIncident"("animalId");

-- CreateIndex
CREATE INDEX "AgroIncident_animalGroupId_idx" ON "AgroIncident"("animalGroupId");

-- CreateIndex
CREATE INDEX "AgroIncident_farmUnitId_idx" ON "AgroIncident"("farmUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "AgroIncident_farmId_clientEventId_key" ON "AgroIncident"("farmId", "clientEventId");

-- AddForeignKey
ALTER TABLE "AgroFarmMember" ADD CONSTRAINT "AgroFarmMember_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroRoleSpecialty" ADD CONSTRAINT "AgroRoleSpecialty_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AgroRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroRoleSpecialty" ADD CONSTRAINT "AgroRoleSpecialty_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "AgroSpecialty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCapability" ADD CONSTRAINT "AgroCapability_specialtyId_fkey" FOREIGN KEY ("specialtyId") REFERENCES "AgroSpecialty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCapability" ADD CONSTRAINT "AgroCapability_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AgroCapability"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroWorkerRole" ADD CONSTRAINT "AgroWorkerRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AgroRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroWorkerCapability" ADD CONSTRAINT "AgroWorkerCapability_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "AgroCapability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCapabilityVerification" ADD CONSTRAINT "AgroCapabilityVerification_workerCapabilityId_fkey" FOREIGN KEY ("workerCapabilityId") REFERENCES "AgroWorkerCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCapabilityVerification" ADD CONSTRAINT "AgroCapabilityVerification_capabilityId_fkey" FOREIGN KEY ("capabilityId") REFERENCES "AgroCapability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroCapabilityVerification" ADD CONSTRAINT "AgroCapabilityVerification_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "AgroFarm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_farmUnitId_fkey" FOREIGN KEY ("farmUnitId") REFERENCES "AgroFarmUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "AgroAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_animalGroupId_fkey" FOREIGN KEY ("animalGroupId") REFERENCES "AgroAnimalGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_cropCycleId_fkey" FOREIGN KEY ("cropCycleId") REFERENCES "AgroCropCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgroIncident" ADD CONSTRAINT "AgroIncident_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "AgroInventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── Seed idempotente de la taxonomía Agro (isSystem = true) ──────────────────
-- Catálogo base ampliable vía v1/agro/workforce/catalog (agro:workforce:admin).
-- ON CONFLICT (key) DO NOTHING: re-aplicable y respeta ediciones posteriores.
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-porcicultor','porcicultor','Porcicultor','ANIMAL_PRODUCTION','PIG',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-ganadero','ganadero','Ganadero','ANIMAL_PRODUCTION','CATTLE',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-avicultor','avicultor','Avicultor','ANIMAL_PRODUCTION','CHICKEN',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-apicultor','apicultor','Apicultor','ANIMAL_PRODUCTION','BEE',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-trabajador_agricola','trabajador_agricola','Trabajador agrícola','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-tractorista','tractorista','Tractorista','MACHINERY',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-operador_maquinaria','operador_maquinaria','Operador de maquinaria','MACHINERY',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-tecnico_agricola','tecnico_agricola','Técnico agrícola','PROFESSIONAL',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-tecnico_pecuario','tecnico_pecuario','Técnico pecuario','PROFESSIONAL',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-agronomo','agronomo','Agrónomo','PROFESSIONAL',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-veterinario','veterinario','Veterinario','PROFESSIONAL',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-especialista_riego','especialista_riego','Especialista en riego','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRole" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-role-especialista_suelos','especialista_suelos','Especialista en suelos','PROFESSIONAL',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-maternidad_porcina','maternidad_porcina','Maternidad porcina','ANIMAL_PRODUCTION','PIG',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-engorde_porcino','engorde_porcino','Engorde porcino','ANIMAL_PRODUCTION','PIG',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-ganado_lechero','ganado_lechero','Ganado lechero','ANIMAL_PRODUCTION','CATTLE',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-ganado_carne','ganado_carne','Ganado de carne','ANIMAL_PRODUCTION','CATTLE',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-pollos_engorde','pollos_engorde','Pollos de engorde','ANIMAL_PRODUCTION','CHICKEN',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-gallinas_ponedoras','gallinas_ponedoras','Gallinas ponedoras','ANIMAL_PRODUCTION','CHICKEN',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-apicultura','apicultura','Apicultura','ANIMAL_PRODUCTION','BEE',TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-sanidad_animal','sanidad_animal','Sanidad animal','ANIMAL_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-manejo_cultivos','manejo_cultivos','Manejo de cultivos','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-irrigacion','irrigacion','Irrigación','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-fertirrigacion','fertirrigacion','Fertirrigación','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-sanidad_vegetal','sanidad_vegetal','Sanidad vegetal','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-suelos','suelos','Manejo de suelos','CROP_PRODUCTION',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroSpecialty" ("id","key","name","sector","species","isSystem","active","createdAt","updatedAt") VALUES ('agro-spec-maquinaria_agricola','maquinaria_agricola','Maquinaria agrícola','MACHINERY',NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'porcicultor' AND s."key" = 'maternidad_porcina' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_pecuario' AND s."key" = 'maternidad_porcina' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'veterinario' AND s."key" = 'maternidad_porcina' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'porcicultor' AND s."key" = 'engorde_porcino' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_pecuario' AND s."key" = 'engorde_porcino' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'ganadero' AND s."key" = 'ganado_lechero' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_pecuario' AND s."key" = 'ganado_lechero' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'veterinario' AND s."key" = 'ganado_lechero' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'ganadero' AND s."key" = 'ganado_carne' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_pecuario' AND s."key" = 'ganado_carne' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'avicultor' AND s."key" = 'pollos_engorde' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'avicultor' AND s."key" = 'gallinas_ponedoras' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'apicultor' AND s."key" = 'apicultura' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'veterinario' AND s."key" = 'sanidad_animal' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_pecuario' AND s."key" = 'sanidad_animal' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'trabajador_agricola' AND s."key" = 'manejo_cultivos' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_agricola' AND s."key" = 'manejo_cultivos' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'agronomo' AND s."key" = 'manejo_cultivos' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'especialista_riego' AND s."key" = 'irrigacion' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'trabajador_agricola' AND s."key" = 'irrigacion' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_agricola' AND s."key" = 'irrigacion' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'especialista_riego' AND s."key" = 'fertirrigacion' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'agronomo' AND s."key" = 'fertirrigacion' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'agronomo' AND s."key" = 'sanidad_vegetal' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tecnico_agricola' AND s."key" = 'sanidad_vegetal' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'especialista_suelos' AND s."key" = 'suelos' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'agronomo' AND s."key" = 'suelos' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'tractorista' AND s."key" = 'maquinaria_agricola' ON CONFLICT DO NOTHING;
INSERT INTO "AgroRoleSpecialty" ("roleId","specialtyId") SELECT r."id", s."id" FROM "AgroRole" r, "AgroSpecialty" s WHERE r."key" = 'operador_maquinaria' AND s."key" = 'maquinaria_agricola' ON CONFLICT DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-cerdos_alimentacion_lote','cerdos_alimentacion_lote','Alimentar lote de cerdos','FEEDING',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'engorde_porcino'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-lechones_manejo','lechones_manejo','Manejar lechones','ANIMAL_HANDLING',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'maternidad_porcina'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-lechones_alimentacion','lechones_alimentacion','Alimentar lechones','FEEDING',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'maternidad_porcina'),(SELECT "id" FROM "AgroCapability" WHERE "key" = 'lechones_manejo'),FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-lechones_cuidado_neonatal','lechones_cuidado_neonatal','Cuidado neonatal de lechones','ANIMAL_HANDLING',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'maternidad_porcina'),(SELECT "id" FROM "AgroCapability" WHERE "key" = 'lechones_manejo'),FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-animales_pesaje','animales_pesaje','Pesar animales','ANIMAL_HANDLING',NULL,NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-ordeno','ordeno','Ordeñar','ANIMAL_HANDLING',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'ganado_lechero'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-condicion_animal_inspeccion','condicion_animal_inspeccion','Inspeccionar condición animal','HEALTH_WELFARE',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'sanidad_animal'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-corrales_limpieza_desinfeccion','corrales_limpieza_desinfeccion','Limpiar y desinfectar corrales','CLEANING_BIOSECURITY',NULL,NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-tractor_operacion','tractor_operacion','Operar tractor','MACHINERY',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'maquinaria_agricola'),NULL,FALSE,TRUE,730,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-terreno_preparacion','terreno_preparacion','Preparar terreno','LAND_PREPARATION',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'manejo_cultivos'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-riego_instalacion_reparacion','riego_instalacion_reparacion','Instalar o reparar riego','IRRIGATION',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'irrigacion'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-fertirrigacion_dosificacion','fertirrigacion_dosificacion','Dosificar fertirrigación','IRRIGATION',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'fertirrigacion'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-huevos_recoleccion','huevos_recoleccion','Recolectar huevos','HARVEST',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'gallinas_ponedoras'),NULL,FALSE,TRUE,NULL,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-vacunacion_aplicacion','vacunacion_aplicacion','Aplicar vacunas según protocolo','HEALTH_WELFARE',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'sanidad_animal'),NULL,TRUE,TRUE,365,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-procedimiento_veterinario_autorizado','procedimiento_veterinario_autorizado','Aplicar procedimiento veterinario autorizado','PROCEDURE',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'sanidad_animal'),NULL,TRUE,TRUE,365,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
INSERT INTO "AgroCapability" ("id","key","name","category","specialtyId","parentId","requiresProfessional","evidenceRequired","validityDays","isSystem","active","createdAt","updatedAt") VALUES ('agro-cap-procedimiento_agricola_autorizado','procedimiento_agricola_autorizado','Aplicar procedimiento agrícola autorizado (fitosanitario)','PROCEDURE',(SELECT "id" FROM "AgroSpecialty" WHERE "key" = 'sanidad_vegetal'),NULL,TRUE,TRUE,365,TRUE,TRUE,NOW(),NOW()) ON CONFLICT ("key") DO NOTHING;
