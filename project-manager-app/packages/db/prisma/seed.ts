/**
 * SEMSE OS — Seed robusto v2
 *
 * Crea un dataset completo bajo `tenant_default` que coincide exactamente
 * con las cuentas demo del login (worker@demo.semse, client@demo.semse, admin@demo.semse).
 *
 * Incluye: tenant, orgs, usuarios, memberships, roles, jobs, projects,
 * milestones, evidence, escrow, reservations, contracts, disputes,
 * agent plans, agent memory, agent delegations, notifications.
 */

import { EscrowStatus, PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { config as dotenvConfig } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenvConfig({ path: resolve(__dirname, "../../apps/api/.env") });

const prisma = new PrismaClient();

function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `s1$${salt.toString("base64url")}$${derived.toString("base64url")}`;
}

const TENANT_ID   = "tenant_default";
const ORG_CLIENT  = "org_client_001";
const ORG_PRO     = "org_pro_001";
const ORG_ADMIN   = "org_admin_001";
const USER_CLIENT = "usr_client_001";
const USER_PRO    = "usr_worker_001";
const USER_ADMIN  = "usr_admin_001";

// ── Permisos por rol ──────────────────────────────────────────────────────────

const ROLE_PERMISSIONS: Record<string, string[]> = {
  CLIENT: [
    "jobs:read", "jobs:create", "jobs:archive", "jobs:restore",
    "bids:read", "bids:accept",
    "milestones:read", "milestones:create", "milestones:approve",
    "evidence:read", "evidence:write",
    "disputes:read", "disputes:create", "disputes:archive", "disputes:restore",
    "projects:read", "projects:financials:read", "projects:financials:write", "projects:status:update",
    "trust:read",
    "reservations:read", "reservations:accept", "reservations:release",
    "contracts:create", "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "org:members:read",
    "users:read", "users:memberships:read",
    "agents:run:create",
  ],
  PRO: [
    "jobs:read",
    "bids:create",
    "milestones:read", "milestones:submit",
    "evidence:read", "evidence:write",
    "disputes:read",
    "projects:read",
    "trust:read",
    "reservations:create", "reservations:read", "reservations:release",
    "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "org:members:read",
    "users:read", "users:memberships:read",
  ],
  WORKER: ["agents:run:worker", "agents:run:manage"],
  OPS_ADMIN: [
    "jobs:read", "jobs:create", "jobs:archive", "jobs:restore",
    "bids:read", "bids:create", "bids:accept",
    "milestones:read", "milestones:create", "milestones:submit", "milestones:approve", "milestones:reject",
    "evidence:read", "evidence:write",
    "disputes:read", "disputes:create", "disputes:assign", "disputes:resolve",
    "disputes:archive", "disputes:restore",
    "projects:read", "projects:financials:read", "projects:financials:write", "projects:status:update",
    "trust:read",
    "reservations:create", "reservations:read", "reservations:accept", "reservations:release", "reservations:expire",
    "contracts:create", "contracts:read", "contracts:sign",
    "ratings:read", "ratings:create",
    "org:read", "org:members:read",
    "users:read", "users:memberships:read", "users:verify", "users:status:update",
    "ops:audit:read", "ops:dashboard:read", "ops:dashboard:write",
    "ops:risk:read", "ops:alerts:ack", "ops:runbooks:execute", "ops:incidents:create",
    "domain-events:read", "domain-events:emit",
    "communications:read", "communications:write", "communications:admin",
    "agents:run:create", "agents:run:retry", "agents:run:manage", "agents:run:worker",
  ],
};

async function upsertRoles() {
  const allPerms = Array.from(new Set(Object.values(ROLE_PERMISSIONS).flat()));
  const permMap = new Map<string, string>();
  for (const key of allPerms) {
    const perm = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
    permMap.set(key, perm.id);
  }
  const roleMap = new Map<string, string>();
  for (const [roleKey, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: roleKey },
      create: { key: roleKey, name: roleKey },
    });
    roleMap.set(roleKey, role.id);
    for (const permKey of perms) {
      const permId = permMap.get(permKey)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permId } },
        update: {},
        create: { roleId: role.id, permissionId: permId },
      });
    }
  }
  return roleMap;
}

async function main() {
  console.log("🌱  SEMSE Seed v2 — arrancando…");

  // ── 1. Tenant ────────────────────────────────────────────────────────────────
  await prisma.tenant.upsert({
    where: { id: TENANT_ID },
    update: { name: "SEMSE Demo", status: "active" },
    create: { id: TENANT_ID, slug: "tenant_default", name: "SEMSE Demo", status: "active" },
  });
  console.log(`   ✔ Tenant: ${TENANT_ID}`);

  // ── 2. Roles + Permisos ──────────────────────────────────────────────────────
  const roleMap = await upsertRoles();
  console.log(`   ✔ Roles: ${[...roleMap.keys()].join(", ")}`);

  // ── 3. Orgs (todas bajo tenant_default) ──────────────────────────────────────
  await prisma.org.upsert({
    where: { id: ORG_CLIENT },
    update: { tenantId: TENANT_ID, name: "ACME Corp (Cliente)", type: "CLIENT" },
    create: { id: ORG_CLIENT, tenantId: TENANT_ID, type: "CLIENT", name: "ACME Corp (Cliente)" },
  });
  await prisma.org.upsert({
    where: { id: ORG_PRO },
    update: { tenantId: TENANT_ID, name: "ProServicios SRL", type: "PRO" },
    create: { id: ORG_PRO, tenantId: TENANT_ID, type: "PRO", name: "ProServicios SRL" },
  });
  await prisma.org.upsert({
    where: { id: ORG_ADMIN },
    update: { tenantId: TENANT_ID, name: "SEMSE Operations", type: "OPS" },
    create: { id: ORG_ADMIN, tenantId: TENANT_ID, type: "OPS", name: "SEMSE Operations" },
  });
  console.log("   ✔ Orgs: client, pro, admin");

  // ── 4. Usuarios ───────────────────────────────────────────────────────────────
  const passClient = hashPassword("demo1234");
  await prisma.user.upsert({
    where: { id: USER_CLIENT },
    update: { email: "client@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified" },
    create: { id: USER_CLIENT, email: "client@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified" },
  });
  await prisma.user.upsert({
    where: { id: USER_PRO },
    update: { email: "worker@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified", trustScore: 0.88 },
    create: { id: USER_PRO, email: "worker@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified", trustScore: 0.88 },
  });
  await prisma.user.upsert({
    where: { id: USER_ADMIN },
    update: { email: "admin@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified" },
    create: { id: USER_ADMIN, email: "admin@demo.semse", passwordHash: passClient, status: "active", verificationStatus: "verified" },
  });
  // Worker system user para el worker process
  await prisma.user.upsert({
    where: { id: "usr_worker_system" },
    update: {},
    create: { id: "usr_worker_system", email: "worker-system@semse.local", passwordHash: hashPassword("system"), status: "active" },
  });
  console.log("   ✔ Usuarios: client@demo.semse, worker@demo.semse, admin@demo.semse (pass: demo1234)");

  // ── 5. Memberships ────────────────────────────────────────────────────────────
  const memberDefs = [
    { userId: USER_CLIENT, orgId: ORG_CLIENT, roleKey: "CLIENT" },
    { userId: USER_PRO,    orgId: ORG_PRO,    roleKey: "PRO" },
    { userId: USER_ADMIN,  orgId: ORG_ADMIN,  roleKey: "OPS_ADMIN" },
  ];
  for (const { userId, orgId, roleKey } of memberDefs) {
    const roleId = roleMap.get(roleKey)!;
    await prisma.membership.upsert({
      where: { userId_orgId_roleId: { userId, orgId, roleId } },
      update: {},
      create: { userId, orgId, roleId },
    });
  }
  console.log("   ✔ Memberships enlazadas");

  // ── 6. Jobs ───────────────────────────────────────────────────────────────────
  const jobs = [
    {
      id: "job_demo_001",
      title: "Instalación panel eléctrico 200A + cableado",
      category: "electricidad",
      scope: "Instalar tablero eléctrico trifásico 200A, reemplazar cableado obsoleto en 3 habitaciones, instalar 12 tomas de corriente y 8 puntos de luz LED. Requiere permiso municipal.",
      status: "IN_PROGRESS",
      budgetMin: 2800, budgetMax: 3500, urgency: "high",
    },
    {
      id: "job_demo_002",
      title: "Remodelación baño completo",
      category: "plomería",
      scope: "Remodelar baño principal: cambio de azulejos, instalación de ducha nueva, reemplazo de sanitarios y grifería. Área 6m².",
      status: "PUBLISHED",
      budgetMin: 4500, budgetMax: 6000, urgency: "medium",
    },
    {
      id: "job_demo_003",
      title: "Pintura exterior edificio 5 pisos",
      category: "pintura",
      scope: "Pintura exterior de edificio residencial de 5 pisos. Incluye preparación de superficies, sellado de fisuras y 2 manos de pintura impermeabilizante.",
      status: "PUBLISHED",
      budgetMin: 8000, budgetMax: 12000, urgency: "low",
    },
    {
      id: "job_demo_004",
      title: "Reparación sistema HVAC comercial",
      category: "climatización",
      scope: "Diagnóstico y reparación de sistema de climatización en local comercial de 300m². Incluye limpieza de ductos y recarga de refrigerante.",
      status: "COMPLETED",
      budgetMin: 1200, budgetMax: 1800, urgency: "urgent",
    },
    {
      id: "job_demo_005",
      title: "Impermeabilización terraza 80m²",
      category: "impermeabilización",
      scope: "Aplicación de membrana impermeabilizante en terraza de 80m². Incluye preparación, imprimación y 2 capas de membrana de poliuretano.",
      status: "PUBLISHED",
      budgetMin: 3200, budgetMax: 4000, urgency: "medium",
    },
  ] as const;

  for (const job of jobs) {
    await prisma.job.upsert({
      where: { id: job.id },
      update: {},
      create: {
        id: job.id,
        tenantId: TENANT_ID,
        clientOrgId: ORG_CLIENT,
        title: job.title,
        category: job.category,
        scope: job.scope,
        status: job.status as any,
        budgetType: "fixed",
        budgetMin: job.budgetMin,
        budgetMax: job.budgetMax,
        urgency: job.urgency,
      },
    });
  }
  console.log(`   ✔ Jobs: ${jobs.length} (variados estados)`);

  // ── 7. Project activo (job_demo_001) ─────────────────────────────────────────
  const project = await prisma.project.upsert({
    where: { id: "proj_demo_001" },
    update: {},
    create: {
      id: "proj_demo_001",
      tenantId: TENANT_ID,
      jobId: "job_demo_001",
      assignedProOrgId: ORG_PRO,
      status: "IN_PROGRESS",
      startAt: new Date("2026-04-01"),
      dueAt: new Date("2026-05-15"),
    },
  });
  console.log(`   ✔ Project: ${project.id}`);

  // ── 8. Milestones ─────────────────────────────────────────────────────────────
  const milestones = [
    {
      id: "ms_demo_001",
      title: "Desmontaje y preparación",
      description: "Retirar tablero viejo, preparar canalización y verificar acometida.",
      amount: 800, sequence: 1, status: "APPROVED",
      requiredEvidenceTypes: ["PHOTO", "DOCUMENT"],
    },
    {
      id: "ms_demo_002",
      title: "Instalación tablero 200A",
      description: "Montar tablero trifásico, conectar fases y neutro, prueba de continuidad.",
      amount: 1400, sequence: 2, status: "SUBMITTED",
      requiredEvidenceTypes: ["PHOTO", "VIDEO"],
    },
    {
      id: "ms_demo_003",
      title: "Cableado habitaciones y prueba final",
      description: "Tender cableado nuevo, instalar tomas y luces LED, prueba de carga completa.",
      amount: 900, sequence: 3, status: "DRAFT",
      requiredEvidenceTypes: ["PHOTO", "VIDEO", "DOCUMENT"],
    },
  ];

  for (const ms of milestones) {
    await prisma.milestone.upsert({
      where: { id: ms.id },
      update: {},
      create: {
        id: ms.id,
        projectId: project.id,
        title: ms.title,
        description: ms.description,
        amount: ms.amount,
        sequence: ms.sequence,
        status: ms.status as any,
        requiredEvidenceTypes: ms.requiredEvidenceTypes,
      },
    });
  }
  console.log(`   ✔ Milestones: ${milestones.length}`);

  // ── 9. Evidence ───────────────────────────────────────────────────────────────
  const evidenceItems = [
    {
      id: "ev_demo_001",
      milestoneId: "ms_demo_001",
      kind: "PHOTO",
      bucketKey: "evidence/ev_demo_001.jpg",
      url: "https://placehold.co/800x600?text=Desmontaje+tablero+viejo",
      uploadedById: USER_PRO,
    },
    {
      id: "ev_demo_002",
      milestoneId: "ms_demo_001",
      kind: "DOCUMENT",
      bucketKey: "evidence/ev_demo_002.pdf",
      url: "https://placehold.co/800x600?text=Certificado+acometida",
      uploadedById: USER_PRO,
    },
    {
      id: "ev_demo_003",
      milestoneId: "ms_demo_002",
      kind: "PHOTO",
      bucketKey: "evidence/ev_demo_003.jpg",
      url: "https://placehold.co/800x600?text=Tablero+200A+instalado",
      uploadedById: USER_PRO,
    },
    {
      id: "ev_demo_004",
      milestoneId: "ms_demo_002",
      kind: "VIDEO",
      bucketKey: "evidence/ev_demo_004.mp4",
      url: "https://placehold.co/800x600?text=Video+prueba+continuidad",
      uploadedById: USER_PRO,
    },
  ];

  for (const ev of evidenceItems) {
    await prisma.evidence.upsert({
      where: { id: ev.id },
      update: {},
      create: {
        id: ev.id,
        tenantId: TENANT_ID,
        projectId: project.id,
        milestoneId: ev.milestoneId,
        kind: ev.kind as any,
        bucketKey: ev.bucketKey,
        metadataJson: { url: ev.url },
        uploadedById: ev.uploadedById,
      },
    });
  }
  console.log(`   ✔ Evidence: ${evidenceItems.length} archivos`);

  // ── 10. Escrow ────────────────────────────────────────────────────────────────
  await prisma.paymentEscrow.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      id: "escrow_demo_001",
      projectId: project.id,
      jobId: "job_demo_001",
      providerRef: "escrow_ref_demo_001",
      currency: "USD",
      totalAmount: 3100,
      holdbackPct: 10,
      status: EscrowStatus.ACTIVE,
    },
  });
  console.log("   ✔ Escrow activo");

  // ── 11. Reservación ───────────────────────────────────────────────────────────
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  await prisma.jobReservation.upsert({
    where: { id: "res_demo_001" },
    update: {},
    create: {
      id: "res_demo_001",
      jobId: "job_demo_001",
      professionalId: USER_PRO,
      professionalOrgId: ORG_PRO,
      status: "ACCEPTED",
      expiresAt,
      acceptedAt: new Date("2026-04-01"),
    },
  });
  console.log("   ✔ Reservación aceptada");

  // ── 12. Disputa ───────────────────────────────────────────────────────────────
  await prisma.dispute.upsert({
    where: { id: "dispute_demo_001" },
    update: {},
    create: {
      id: "dispute_demo_001",
      tenantId: TENANT_ID,
      projectId: project.id,
      milestoneId: "ms_demo_002",
      raisedById: USER_CLIENT,
      reason: "El tablero instalado no coincide con las especificaciones del contrato. Se acordó un tablero Siemens pero se instaló una marca genérica.",
      status: "OPEN" as any,
    },
  });
  console.log("   ✔ Disputa abierta");

  // ── 13. Notification ─────────────────────────────────────────────────────────
  const notifications = [
    {
      id: "notif_demo_001",
      userId: USER_CLIENT,
      type: "milestone_submitted",
      title: "Hito enviado para revisión",
      body: "El profesional ha enviado el hito 'Instalación tablero 200A' para tu revisión.",
      payload: { entityType: "milestone", entityId: "ms_demo_002" },
    },
    {
      id: "notif_demo_002",
      userId: USER_CLIENT,
      type: "dispute_opened",
      title: "Disputa registrada",
      body: "Tu disputa sobre el hito 2 ha sido registrada y está siendo revisada.",
      payload: { entityType: "dispute", entityId: "dispute_demo_001" },
    },
    {
      id: "notif_demo_003",
      userId: USER_PRO,
      type: "milestone_approved",
      title: "Hito aprobado",
      body: "El hito 'Desmontaje y preparación' fue aprobado. Se liberarán $800 USD.",
      payload: { entityType: "milestone", entityId: "ms_demo_001" },
    },
  ];

  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {},
      create: {
        id: n.id,
        tenantId: TENANT_ID,
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
      },
    });
  }
  console.log(`   ✔ Notificaciones: ${notifications.length}`);

  // ── 14. Agent Plan ────────────────────────────────────────────────────────────
  await prisma.agentWorkPlan.upsert({
    where: { id: "plan_demo_001" },
    update: {},
    create: {
      id: "plan_demo_001",
      tenantId: TENANT_ID,
      orgId: ORG_CLIENT,
      projectId: project.id,
      createdBy: USER_CLIENT,
      agentId: "project-copilot",
      title: "Revisión y cierre del hito 2 — Tablero eléctrico",
      status: "pending_approval",
      metaJson: {
        goal: "Resolver la discrepancia de marca en el tablero y proceder al pago del hito 2.",
        rationale: "El cliente detectó que el tablero instalado no es el especificado. El copiloto propone un plan de 3 pasos para resolver esto antes de liberar el escrow.",
        risks: ["El profesional puede disputar la observación", "El retraso puede incurrir en penalidades contractuales"],
        requiredEvidence: ["Foto del tablero instalado con número de serie", "Cotización original del tablero Siemens"],
        successCriteria: ["Marca del tablero verificada o aceptada por el cliente", "Pago liberado o disputa escalada a ops"],
      },
      stepsJson: [
        {
          id: "step_1", title: "Revisar evidencia del tablero instalado",
          status: "pending", sequence: 1, capability: "searching",
          toolsAllowed: ["READ_FILE", "SEARCH_PATTERNS"],
          expectedOutcome: "Confirmación de marca y modelo del tablero instalado",
        },
        {
          id: "step_2", title: "Notificar al profesional sobre discrepancia",
          status: "pending", sequence: 2, capability: "composing",
          toolsAllowed: ["DRAFT_MESSAGE"],
          dependsOnStepIds: ["step_1"],
          expectedOutcome: "Mensaje enviado al profesional solicitando aclaración",
        },
        {
          id: "step_3", title: "Proponer aprobación o escalación",
          status: "pending", sequence: 3, capability: "worker",
          toolsAllowed: ["PROPOSE_MILESTONE_APPROVAL", "PROPOSE_DISPUTE_OPEN"],
          dependsOnStepIds: ["step_2"],
          requiresApprovedPlan: true,
          expectedOutcome: "Hito aprobado o disputa escalada a ops",
        },
      ],
    },
  });
  console.log("   ✔ AgentWorkPlan creado (pending_approval)");

  // ── 15. Agent Memory ──────────────────────────────────────────────────────────
  const memories = [
    {
      id: "mem_demo_001",
      agentId: "project-copilot",
      type: "observation",
      content: "El cliente reportó que el tablero instalado en el hito 2 no corresponde a la marca Siemens especificada en el contrato. La marca instalada es genérica (sin identificación visible en las fotos).",
      summary: "Discrepancia de marca en tablero eléctrico del hito 2",
      importanceScore: 5,
      tags: ["hito", "disputa", "tablero", "marca"],
    },
    {
      id: "mem_demo_002",
      agentId: "project-copilot",
      type: "decision",
      content: "Se decidió proponer un plan de revisión antes de aprobar el pago del hito 2. El plan requiere evidencia fotográfica del número de serie del tablero instalado para comparar con la cotización original.",
      summary: "Plan propuesto: revisar evidencia antes de aprobar hito 2",
      importanceScore: 4,
      tags: ["plan", "aprobación", "escrow"],
    },
    {
      id: "mem_demo_003",
      agentId: "field-ops",
      type: "fact",
      content: "El hito 1 (Desmontaje y preparación) fue aprobado el 2026-04-05 con 2 evidencias: foto del desmontaje y certificado de acometida. $800 USD liberados al profesional.",
      summary: "Hito 1 aprobado — $800 USD liberados",
      importanceScore: 3,
      tags: ["hito", "pago", "aprobación"],
    },
  ];

  for (const mem of memories) {
    await prisma.agentMemory.upsert({
      where: { id: mem.id },
      update: {},
      create: {
        id: mem.id,
        tenantId: TENANT_ID,
        orgId: ORG_CLIENT,
        projectId: project.id,
        agentId: mem.agentId,
        type: mem.type,
        content: mem.content,
        summary: mem.summary,
        importanceScore: mem.importanceScore,
        tags: mem.tags,
      },
    });
  }
  console.log(`   ✔ AgentMemory: ${memories.length} entradas`);

  // ── 16. Agent Delegations (para Coordinator Dashboard) ───────────────────────
  const delegations = [
    {
      id: "deleg_demo_001",
      coordinatorId: "project-copilot",
      targetAgentId: "field-ops",
      taskTitle: "Verificar documentación del hito 2",
      status: "completed",
      resultJson: { documentationSufficient: false, missingDocumentation: [{ milestoneId: "ms_demo_002", issue: "Falta foto del número de serie del tablero" }] },
    },
    {
      id: "deleg_demo_002",
      coordinatorId: "project-copilot",
      targetAgentId: "trust-match",
      taskTitle: "Evaluar trust score del profesional para disputa",
      status: "completed",
      resultJson: { trustScore: 0.88, level: "high", flags: [], candidatesEvaluated: 1 },
    },
    {
      id: "deleg_demo_003",
      coordinatorId: "project-copilot",
      targetAgentId: "pricing",
      taskTitle: "Verificar precio de mercado para tablero Siemens 200A",
      status: "executing",
      resultJson: null,
    },
  ];

  for (const deleg of delegations) {
    await prisma.agentDelegation.upsert({
      where: { id: deleg.id },
      update: { status: deleg.status as any, resultJson: deleg.resultJson },
      create: {
        id: deleg.id,
        tenantId: TENANT_ID,
        orgId: ORG_CLIENT,
        projectId: project.id,
        coordinatorId: deleg.coordinatorId,
        targetAgentId: deleg.targetAgentId,
        taskTitle: deleg.taskTitle,
        taskContextJson: { projectId: project.id, jobId: "job_demo_001" },
        status: deleg.status as any,
        resultJson: deleg.resultJson,
      },
    });
  }
  console.log(`   ✔ AgentDelegations: ${delegations.length} (coordinator dashboard)`);

  // ── 17. UserProfile (AssistantSettings) ──────────────────────────────────────
  await prisma.userProfile.upsert({
    where: { userId: USER_CLIENT },
    update: {},
    create: {
      userId: USER_CLIENT,
      assistantTone: "friendly",
      assistantLanguage: "es",
      assistantVerbosity: "balanced",
      unifiedMode: false,
      expertMode: false,
    },
  });
  await prisma.userProfile.upsert({
    where: { userId: USER_PRO },
    update: {},
    create: {
      userId: USER_PRO,
      assistantTone: "technical",
      assistantLanguage: "es",
      assistantVerbosity: "short",
      unifiedMode: false,
      expertMode: true,
    },
  });
  console.log("   ✔ UserProfiles con AssistantSettings");

  // ── 18. WorkspaceMemory (legacy compat) ───────────────────────────────────────
  await prisma.workspaceMemoryEntry.upsert({
    where: { id: "wsmem_demo_001" },
    update: {},
    create: {
      id: "wsmem_demo_001",
      tenantId: TENANT_ID,
      orgId: ORG_CLIENT,
      createdBy: USER_CLIENT,
      workspaceId: project.id,
      kind: "project_context",
      scope: "project",
      title: "Contexto del proyecto demo",
      summary: "Discrepancia marca tablero eléctrico hito 2 — plan pendiente aprobación",
      body: JSON.stringify({
        projectId: project.id,
        jobId: "job_demo_001",
        currentIssue: "Discrepancia marca tablero eléctrico hito 2",
        lastAction: "Plan propuesto por copiloto — pendiente aprobación",
      }),
    },
  });
  console.log("   ✔ WorkspaceMemory");

  // ── 19. Segundo proyecto para el job_demo_004 (COMPLETED) ────────────────────
  const proj2 = await prisma.project.upsert({
    where: { id: "proj_demo_002" },
    update: {},
    create: {
      id: "proj_demo_002",
      tenantId: TENANT_ID,
      jobId: "job_demo_004",
      assignedProOrgId: ORG_PRO,
      status: "COMPLETED",
      startAt: new Date("2026-03-01"),
      dueAt: new Date("2026-03-20"),
    },
  });
  await prisma.milestone.upsert({
    where: { id: "ms_demo_004" },
    update: {},
    create: {
      id: "ms_demo_004",
      projectId: proj2.id,
      title: "Diagnóstico y reparación HVAC",
      amount: 1500,
      sequence: 1,
      status: "APPROVED",
    },
  });
  await prisma.paymentEscrow.upsert({
    where: { projectId: proj2.id },
    update: {},
    create: {
      id: "escrow_demo_002",
      projectId: proj2.id,
      jobId: "job_demo_004",
      providerRef: "escrow_ref_demo_002",
      currency: "USD",
      totalAmount: 1500,
      status: EscrowStatus.RELEASED,
    },
  });
  console.log("   ✔ Proyecto 2 completado (HVAC)");

  // ── Contractor Leads (CRM demo) ──────────────────────────────────────────────
  console.log("\n6. Contractor leads...");

  const leadsData = [
    {
      id: "lead_demo_001",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Maria Elena Vargas",
      phone: "(305) 555-0101",
      email: "mvargas@email.com",
      address: "1234 NW 42nd Ave",
      city: "Miami", state: "FL",
      jobType: "Drywall",
      description: "Reparar drywall en sala principal después de goteras. Aprox 200 sqft.",
      budgetRange: "$800-$1,200",
      urgency: "this_week",
      status: "new",
      source: "referral",
      notes: "Cliente referido por Juan. Tiene seguro pero necesita estimado primero.",
      nextAction: "Llamar para confirmar visita",
    },
    {
      id: "lead_demo_002",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Roberto Castillo",
      phone: "(786) 555-0202",
      email: "rcastillo@hotmail.com",
      address: "5678 SW 8th St",
      city: "Miami", state: "FL",
      jobType: "Pintura",
      description: "Pintar interior completo: sala, 3 cuartos, cocina. Casa 1,400 sqft.",
      budgetRange: "$1,500-$2,500",
      urgency: "this_month",
      status: "contacted",
      source: "facebook",
      notes: "Le enviamos información por FB. Quiere ver muestras de color.",
      nextAction: "Enviar estimado con opciones de pintura",
    },
    {
      id: "lead_demo_003",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Ana Sofía Moreno",
      phone: "(954) 555-0303",
      address: "910 Brickell Bay Dr, Apt 2201",
      city: "Miami", state: "FL",
      jobType: "Pisos",
      description: "Instalar LVP (luxury vinyl plank) en toda la unidad. 850 sqft.",
      budgetRange: "$2,000-$3,500",
      urgency: "flexible",
      status: "estimate_sent",
      source: "nextdoor",
      notes: "Estimado enviado 28/04. Está comparando con otro contratista.",
      nextAction: "Hacer seguimiento del estimado",
      nextActionAt: new Date("2026-05-05"),
    },
    {
      id: "lead_demo_004",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Carlos Mendez",
      phone: "(305) 555-0404",
      email: "cmendez@gmail.com",
      address: "321 Coral Way",
      city: "Coral Gables", state: "FL",
      jobType: "Remodelación",
      description: "Remodelar baño principal: azulejos nuevos, vanity, ducha con nicho.",
      budgetRange: "$4,000-$7,000",
      urgency: "this_month",
      status: "estimate_approved",
      source: "referral",
      notes: "Aprobó estimado por $5,800. Depósito pendiente.",
      nextAction: "Cobrar 50% de depósito para arrancar",
      nextActionAt: new Date("2026-05-03"),
    },
    {
      id: "lead_demo_005",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Diana Reyes",
      phone: "(786) 555-0505",
      address: "456 Collins Ave, Unit 8",
      city: "Miami Beach", state: "FL",
      jobType: "Techo",
      description: "Reparar goteras en techo plano. Aprox 30 sqft de área afectada.",
      budgetRange: "$500-$900",
      urgency: "asap",
      status: "in_progress",
      source: "call",
      notes: "Trabajo en curso. Empezamos el lunes. Cliente muy satisfecha con avance.",
      nextAction: "Terminar sellado y prueba de agua",
    },
    {
      id: "lead_demo_006",
      tenantId: TENANT_ID, orgId: ORG_CLIENT, createdBy: USER_CLIENT,
      name: "Pedro González",
      phone: "(305) 555-0606",
      email: "pgonzalez@yahoo.com",
      address: "789 Bird Rd",
      city: "Miami", state: "FL",
      jobType: "Reparación general",
      description: "Varios trabajos menores: bisagras, puertas que no cierran, mano de pintura en pared.",
      budgetRange: "$300-$500",
      urgency: "flexible",
      status: "lost",
      source: "website",
      notes: "Decidió hacerlo él mismo. Posible cliente futuro para trabajos más grandes.",
    },
  ];

  for (const lead of leadsData) {
    await prisma.contractorLead.upsert({
      where: { id: lead.id },
      update: {},
      create: lead,
    });
  }
  console.log("   ✔ 6 contractor leads (pipeline completo)");

  // ── Knowledge Contributor Program ──────────────────────────────────────
  const CONTRIBUTOR_TERMS_ES = `# Programa de Contribuidores de Conocimiento SEMSE — Términos v1.0

**Fecha de vigencia:** 15 de septiembre de 2026

## Participación voluntaria
Participar en una misión de SEMSE es voluntario. Puedes dejar de participar en cualquier momento sin penalización.

## Elegibilidad
Al aceptar estos términos, confirmas que tienes al menos 18 años y capacidad legal para aceptarlos.

## Autorización para grabar
Solo puedes grabar en lugares y trabajos donde tengas autorización. No puedes subir: información privada de clientes sin autorización, documentos personales, números de tarjetas, credenciales, códigos de acceso, información médica, datos personales innecesarios, ni material protegido que no tengas derecho a compartir. Evita mostrar rostros, direcciones y datos identificativos cuando no sean necesarios.

## Seguridad
El contenido nunca justifica trabajar energizado innecesariamente, retirar tu equipo de protección personal, operar un vehículo mientras grabas, usar una herramienta de forma insegura, violar OSHA, el NEC, las instrucciones del fabricante, permisos o normas aplicables, ni poner a otra persona en riesgo para obtener mejor contenido. La documentación debe detenerse cuando interfiera con la seguridad.

## No instrucciones falsas
Debes documentar lo que realmente ocurrió. Está prohibido inventar medidas, representar trabajo ajeno como propio, falsificar resultados, editar evidencia para ocultar errores relevantes, o reciclar la misma evidencia como múltiples trabajos sin declararlo. Un error real puede documentarse si explicas qué ocurrió, cómo se detectó, cómo se corrigió y cuál fue el resultado — no se debe incentivar recrear intencionalmente fallas peligrosas.

## Compensación
Cada misión muestra, antes de aceptarla, la compensación disponible, el alcance, los requisitos, los criterios de aprobación, posibles bonos y la fecha límite. SEMSE no modifica retroactivamente el pago de una misión ya aceptada.

## Revisión
Una entrega pasa por estos estados: disponible, aceptada, en progreso, enviada, en revisión, cambios solicitados, aprobada, rechazada, pago pendiente, pagada, en disputa o cancelada. Un rechazo nunca se convierte en una simple eliminación del registro.

## Derecho de corrección y de apelación
Cuando corresponda, puedes corregir una entrega incompleta. Todo rechazo incluye una razón, y puedes apelarlo. SEMSE conserva la decisión original, la razón, tu apelación, quién la revisó y el resultado final.

## Uso del contenido
Conservas los derechos que legalmente te correspondan sobre tu material original, pero otorgas a SEMSEproject una licencia suficiente para almacenar, copiar, procesar, transcribir, traducir, analizar, clasificar, generar datos derivados, crear material educativo, y usarlo para desarrollar y mejorar productos, modelos, herramientas y sistemas de conocimiento de SEMSEproject. Esta sección puede ser reemplazada tras revisión jurídica.

## Uso de IA
SEMSE puede usar sistemas automatizados para transcribir, identificar herramientas o materiales, extraer pasos, detectar medidas mencionadas, clasificar tareas, identificar problemas y soluciones, y generar conocimiento estructurado. Un resultado generado por IA nunca modifica silenciosamente tu evidencia original.

## Provenance (trazabilidad)
Todo conocimiento derivado conserva una referencia a la entrega y evidencia originales, el rango de tiempo del video cuando esté disponible, el modelo o proceso utilizado, la fecha de extracción y su versión.

## Relación laboral
Aceptar una misión de este programa no modifica, por sí sola, ninguna relación laboral existente entre tú y SEMSE ni con terceros.

## Impuestos
Algunas compensaciones podrían estar sujetas a requisitos tributarios o de reporte según tu jurisdicción y el monto recibido. SEMSE no promete una clasificación fiscal específica.

## Privacidad
SEMSE recopila únicamente la información necesaria para operar el programa (identidad, evidencia enviada, consentimiento, historial de pago). Consulta la Política de Privacidad de SEMSE para más detalles.

## Actualizaciones
Estos términos están versionados. Una nueva versión material requiere una nueva aceptación para futuras misiones. Tu aceptación de la versión 1.0 permanece registrada incluso si en el futuro existe una versión 1.1 o posterior.`;

  const CONTRIBUTOR_TERMS_EN = `# SEMSE Knowledge Contributor Program — Terms v1.0

**Effective date:** September 15, 2026

## Voluntary participation
Participating in a SEMSE mission is voluntary. You may stop participating at any time without penalty.

## Eligibility
By accepting these terms, you confirm you are at least 18 years old and have the legal capacity to accept them.

## Authorization to record
You may only record work and locations where you have authorization. You may not upload: private client information without authorization, personal documents, card numbers, credentials, access codes, medical information, unnecessary personal data, or protected material you don't have the right to share. Avoid showing faces, addresses and identifying details when not necessary.

## Safety
Content never justifies working on energized equipment unnecessarily, removing your PPE, operating a vehicle while recording, using a tool unsafely, violating OSHA, the NEC, manufacturer instructions, permits or applicable codes, or putting anyone else at risk to get better footage. Documentation must stop when it interferes with safety.

## No fabricated instructions
You must document what actually happened. It is prohibited to invent measurements, present someone else's work as your own, falsify results, edit evidence to hide relevant mistakes, or reuse the same evidence as multiple submissions without disclosing it. A real mistake can be documented if you explain what happened, how it was caught, how it was corrected, and what the outcome was — intentionally recreating dangerous failures is never encouraged.

## Compensation
Every mission shows, before you accept it, the available compensation, scope, requirements, approval criteria, possible bonuses and the deadline. SEMSE does not retroactively change the payment for a mission you already accepted.

## Review
A submission moves through these states: available, accepted, in progress, submitted, under review, changes requested, approved, rejected, payment pending, paid, disputed or cancelled. A rejection is never turned into a plain deletion of the record.

## Right to correct and to appeal
When applicable, you may correct an incomplete submission. Every rejection includes a reason, and you may appeal it. SEMSE keeps the original decision, the reason, your appeal, who reviewed it, and the final outcome.

## Use of content
You keep whatever rights you legally hold over your original material, but you grant SEMSEproject a license sufficient to store, copy, process, transcribe, translate, analyze, classify, generate derived data, create educational material, and use it to develop and improve SEMSEproject's products, models, tools and knowledge systems. This section may be replaced after legal review.

## Use of AI
SEMSE may use automated systems to transcribe, identify tools or materials, extract steps, detect mentioned measurements, classify tasks, identify problems and solutions, and generate structured knowledge. An AI-generated result never silently modifies your original evidence.

## Provenance
Every piece of derived knowledge keeps a reference back to the original submission and evidence, the video time range when available, the model or process used, the extraction date and its version.

## Employment relationship
Accepting a mission in this program does not, by itself, change any existing employment relationship between you and SEMSE or any third party.

## Taxes
Some compensation may be subject to tax or reporting requirements depending on your jurisdiction and the amount received. SEMSE does not promise a specific tax classification.

## Privacy
SEMSE collects only the information necessary to operate the program (identity, submitted evidence, consent, payment history). See SEMSE's Privacy Policy for details.

## Updates
These terms are versioned. A material new version requires new acceptance for future missions. Your acceptance of version 1.0 stays on record even once a version 1.1 or later exists.`;

  const termsHash = sha256(`${CONTRIBUTOR_TERMS_ES}|${CONTRIBUTOR_TERMS_EN}`);
  await prisma.contributorTermsVersion.upsert({
    where: { version: "1.0" },
    update: {},
    create: {
      version: "1.0",
      effectiveAt: new Date("2026-09-15T00:00:00.000Z"),
      contentEs: CONTRIBUTOR_TERMS_ES,
      contentEn: CONTRIBUTOR_TERMS_EN,
      contentHash: termsHash,
      isActive: true,
    },
  });
  console.log("   ✔ Contributor program terms v1.0 (active)");

  const existingEmtMission = await prisma.knowledgeMission.findFirst({
    where: { tenantId: TENANT_ID, title: "Documentar un offset EMT (demo)" },
  });
  if (!existingEmtMission) {
    await prisma.knowledgeMission.create({
      data: {
        tenantId: TENANT_ID,
        createdByUserId: USER_ADMIN,
        title: "Documentar un offset EMT (demo)",
        trade: "electrician",
        category: "conduit_bending",
        difficulty: "intermediate",
        description:
          "Documenta paso a paso cómo doblas un offset en conduit EMT: desde la condición inicial y el " +
          "obstáculo que resuelve el offset, hasta el resultado final. Esta es una misión de demostración/prueba " +
          "del programa — la compensación indicada es simbólica y no de producción.",
        requirementsJson: [
          "Tamaño del conduit EMT usado",
          "Condición inicial del tramo",
          "Obstáculo que motiva el offset",
          "Medidas tomadas y ángulo elegido",
          "Marcas hechas en el conduit",
          "Herramienta utilizada para doblar",
          "Ejecución del doblez",
          "Resultado final",
          "Correcciones, si fueron necesarias",
          "Tiempo aproximado de la tarea",
        ],
        evidenceRequestedJson: [
          "Clip 1 — Antes (condición inicial y obstáculo)",
          "Clip 2 — Planeación (medidas, ángulo, marcas)",
          "Clip 3 — Ejecución (el doblez en sí)",
          "Clip 4 — Problema/corrección (si aplica)",
          "Clip 5 — Resultado (offset instalado)",
        ],
        acceptanceCriteriaJson: [
          "Se explican las medidas y el ángulo elegido",
          "Se muestra la herramienta y su uso",
          "El resultado final es visible y coincide con lo descrito",
          "No se expone información privada innecesaria",
          "El trabajo se realizó de forma segura",
        ],
        baseCompensationCents: 500,
        currency: "USD",
        bonusJson: null,
        maxParticipants: 25,
        isDemo: true,
        status: "PUBLISHED",
      },
    });
    console.log("   ✔ Demo mission: Documentar un offset EMT (demo/test)");
  } else {
    console.log("   ↷ Demo mission already exists, skipping");
  }

  console.log("\n✅  Seed v2 completo!");
  console.log("\n   Credenciales demo:");
  console.log("     client@demo.semse  / demo1234  → Cliente");
  console.log("     worker@demo.semse  / demo1234  → Profesional");
  console.log("     admin@demo.semse   / demo1234  → Admin / OPS");
  console.log("\n   Datos creados:");
  console.log("     • 5 jobs (variados estados)");
  console.log("     • 2 projects (1 activo, 1 cerrado)");
  console.log("     • 3 milestones + 4 evidencias");
  console.log("     • 1 escrow activo + 1 liberado");
  console.log("     • 1 disputa abierta");
  console.log("     • 1 plan de agente (pending_approval)");
  console.log("     • 3 memorias de agente");
  console.log("     • 3 delegaciones (coordinator dashboard)");
  console.log("     • 3 notificaciones");
  console.log("     • userProfiles con assistantSettings");
  console.log("     • 6 contractor leads (pipeline completo)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
