import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from "@nestjs/common";
import { AgroEvidenceService, type AgroEvidenceInput } from "./agro-evidence.service.js";
import { AgroFarmAccessService, assertAgroFarmAction, type AgroFarmActor } from "./agro-farm-access.service.js";
import { AGRO_FARM_MEMBER_ROLES, isAgroFarmMemberRole, type AgroFarmRole } from "./agro-farm-policy.js";
import { AgroAuditRepository } from "./agro-audit.repository.js";
import { AgroWorkforceRepository } from "./agro-workforce.repository.js";
import {
  AGRO_CAPABILITY_CATEGORIES, AGRO_CAPABILITY_LEVELS, AGRO_CATALOG_KEY_PATTERN, AGRO_SECTORS,
  AGRO_VERIFICATION_METHODS, AGRO_VERIFICATION_RESULTS,
  canRedeclareCapability, canRequestReview, canVerifyFrom, effectiveCapabilityStatus,
  verificationExpiry,
} from "./agro-workforce.domain.js";

const MEMBER_STATUSES = ["ACTIVE", "SUSPENDED", "REVOKED"] as const;

function assertIn<T extends string>(values: readonly T[], value: string | undefined, field: string): void {
  if (value !== undefined && !values.includes(value as T)) {
    throw new BadRequestException(`Invalid ${field}: ${value}. Must be one of: ${values.join(", ")}`);
  }
}

@Injectable()
export class AgroWorkforceService {
  constructor(
    private readonly repo: AgroWorkforceRepository,
    private readonly access: AgroFarmAccessService,
    private readonly evidence: AgroEvidenceService,
    private readonly audit: AgroAuditRepository,
  ) {}

  // ── Catálogo (taxonomía) ────────────────────────────────────────────────────

  async getCatalog() {
    const [roles, specialties, capabilities] = await Promise.all([
      this.repo.listRoles(), this.repo.listSpecialties(), this.repo.listCapabilities(),
    ]);
    return {
      roles: roles.map((r) => ({ ...r, specialties: r.specialties.map((s) => s.specialty) })),
      specialties: specialties.map((s) => ({ ...s, roles: s.roles.map((r) => r.role) })),
      capabilities,
    };
  }

  async createCatalogRole(input: {
    key: string; name: string; sector: string; species?: string; description?: string; specialtyKeys?: string[];
  }) {
    this.assertCatalogKey(input.key);
    assertIn(AGRO_SECTORS, input.sector, "sector");
    if (await this.repo.catalogKeyExists("role", input.key)) throw new ConflictException(`Role key already exists: ${input.key}`);
    const specialties = await this.requireKeys(input.specialtyKeys ?? [], (k) => this.repo.findSpecialtiesByKeys(k), "specialty");
    const { specialtyKeys: _ignored, ...data } = input;
    return this.repo.createRole(data, specialties.map((s) => s.id));
  }

  async createCatalogSpecialty(input: {
    key: string; name: string; sector: string; species?: string; description?: string; roleKeys?: string[];
  }) {
    this.assertCatalogKey(input.key);
    assertIn(AGRO_SECTORS, input.sector, "sector");
    if (await this.repo.catalogKeyExists("specialty", input.key)) throw new ConflictException(`Specialty key already exists: ${input.key}`);
    const roles = await this.requireKeys(input.roleKeys ?? [], (k) => this.repo.findRolesByKeys(k), "role");
    const { roleKeys: _ignored, ...data } = input;
    return this.repo.createSpecialty(data, roles.map((r) => r.id));
  }

  async createCatalogCapability(input: {
    key: string; name: string; category: string; description?: string;
    specialtyKey?: string; parentKey?: string;
    requiresProfessional?: boolean; evidenceRequired?: boolean; validityDays?: number;
  }) {
    this.assertCatalogKey(input.key);
    assertIn(AGRO_CAPABILITY_CATEGORIES, input.category, "category");
    if (await this.repo.catalogKeyExists("capability", input.key)) throw new ConflictException(`Capability key already exists: ${input.key}`);
    const [specialty] = await this.requireKeys(input.specialtyKey ? [input.specialtyKey] : [], (k) => this.repo.findSpecialtiesByKeys(k), "specialty");
    let parentId: string | null = null;
    if (input.parentKey) {
      const parent = await this.repo.findCapability(input.parentKey);
      if (!parent) throw new BadRequestException(`Unknown parent capability: ${input.parentKey}`);
      parentId = parent.id;
    }
    return this.repo.createCapability({
      key: input.key, name: input.name, category: input.category, description: input.description,
      specialtyId: specialty?.id ?? null, parentId,
      requiresProfessional: input.requiresProfessional ?? false,
      evidenceRequired: input.evidenceRequired ?? true,
      validityDays: input.validityDays ?? null,
    });
  }

  // ── Miembros de finca ───────────────────────────────────────────────────────

  async listMembers(farmId: string, userId: string) {
    const actor = await this.access.require(farmId, userId, "farm.read");
    const [farm, members] = await Promise.all([this.repo.findFarm(farmId), this.repo.listMembers(farmId)]);
    return {
      viewerRole: actor.role,
      owner: farm?.ownerId ? { userId: farm.ownerId, role: "OWNER" as const } : null,
      members,
    };
  }

  async addMember(farmId: string, userId: string, input: { userId: string; role: string; displayName?: string }) {
    const actor = await this.access.require(farmId, userId, "members.manage");
    if (!isAgroFarmMemberRole(input.role)) {
      throw new BadRequestException(`Invalid farm role: ${input.role}. Must be one of: ${AGRO_FARM_MEMBER_ROLES.join(", ")}`);
    }
    this.assertCanGrantRole(actor, input.role);
    const farm = await this.repo.findFarm(farmId);
    if (farm?.ownerId === input.userId) throw new BadRequestException("The farm owner is already a member");
    if (!(await this.repo.userExists(input.userId))) throw new NotFoundException(`User not found: ${input.userId}`);

    const before = await this.repo.findMember(farmId, input.userId);
    const member = await this.repo.upsertMember({ farmId, userId: input.userId, role: input.role, displayName: input.displayName, invitedById: userId });
    await this.audit.record({
      farmId, actorId: userId, entityType: "AgroFarmMember", entityId: member.id,
      action: before ? "member.reactivated" : "member.added",
      before: before ? { role: before.role, status: before.status } : undefined,
      after: { userId: member.userId, role: member.role, status: member.status },
      source: "WEB",
    });
    return member;
  }

  async updateMember(farmId: string, userId: string, memberId: string, input: { role?: string; status?: string; displayName?: string }) {
    const actor = await this.access.require(farmId, userId, "members.manage");
    const member = await this.repo.findMemberById(memberId);
    if (!member || member.farmId !== farmId) throw new NotFoundException(`Member not found: ${memberId}`);
    if (member.userId === userId) throw new ForbiddenException("Members cannot change their own role or status");
    if (input.role !== undefined) {
      if (!isAgroFarmMemberRole(input.role)) throw new BadRequestException(`Invalid farm role: ${input.role}`);
      this.assertCanGrantRole(actor, input.role);
    }
    // Un MANAGER no puede degradar/suspender a otro MANAGER: solo el propietario.
    if (member.role === "MANAGER") this.assertCanGrantRole(actor, "MANAGER");
    assertIn(MEMBER_STATUSES, input.status, "status");

    const updated = await this.repo.updateMember(memberId, input);
    await this.audit.record({
      farmId, actorId: userId, entityType: "AgroFarmMember", entityId: memberId,
      action: input.status && input.status !== member.status ? "member.status_changed" : "member.role_changed",
      before: { role: member.role, status: member.status },
      after: { role: updated.role, status: updated.status },
      source: "WEB",
    });
    return updated;
  }

  // ── Perfil y matriz de capacidades ─────────────────────────────────────────

  async getWorkerProfile(farmId: string, userId: string, workerId: string) {
    const actor = await this.access.requireMember(farmId, userId);
    if (workerId !== userId) assertAgroFarmAction(actor, "workforce.read_any");
    const workerRole = await this.requireWorkerInFarm(farmId, workerId);

    const [member, roles, capabilities] = await Promise.all([
      this.repo.findMember(farmId, workerId),
      this.repo.listWorkerRoles([workerId]),
      this.repo.listWorkerCapabilities([workerId]),
    ]);
    const verifications = await this.repo.listVerifications(capabilities.map((c) => c.id));
    const evidenceIds = [...new Set(verifications.filter((v) => v.farmId === farmId).flatMap((v) => v.evidenceIds))];
    const [linkedEvidence, capabilityEvidence] = await Promise.all([
      this.evidence.findEvidenceInFarm(farmId, evidenceIds),
      Promise.all(capabilities.map((c) => this.evidence.getEntityEvidenceForMember(farmId, "WORKER_CAPABILITY", c.id))),
    ]);
    const evidenceById = new Map<string, unknown>();
    for (const e of [...linkedEvidence, ...capabilityEvidence.flat()] as Array<{ id: string }>) evidenceById.set(e.id, e);

    const now = new Date();
    return {
      viewerRole: actor.role,
      worker: { userId: workerId, farmRole: workerRole, displayName: member?.displayName ?? null },
      roles: roles.map((r) => ({
        id: r.id, isPrimary: r.isPrimary, source: r.source,
        role: { id: r.role.id, key: r.role.key, name: r.role.name, sector: r.role.sector, species: r.role.species },
        specialties: r.role.specialties.map((s) => s.specialty),
      })),
      capabilities: capabilities.map((c) => {
        const history = verifications.filter((v) => v.workerCapabilityId === c.id);
        return {
          id: c.id,
          capability: c.capability,
          level: c.level,
          status: effectiveCapabilityStatus(c.status, c.expiresAt, now),
          storedStatus: c.status,
          source: c.source,
          acquiredAt: c.acquiredAt, verifiedAt: c.verifiedAt, expiresAt: c.expiresAt,
          lastVerification: history[0] ?? null,
          verifications: history.map((v) => ({
            ...v,
            // Solo se exponen evidencias de ESTA finca.
            evidence: v.farmId === farmId ? v.evidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) : [],
          })),
          evidence: (capabilityEvidence[capabilities.indexOf(c)] ?? []),
        };
      }),
    };
  }

  async getCapabilityMatrix(farmId: string, userId: string) {
    const actor = await this.access.requireMember(farmId, userId);
    const farm = await this.repo.findFarm(farmId);
    const members = (await this.repo.listMembers(farmId)).filter((m) => m.status === "ACTIVE");
    const people = [
      ...(farm?.ownerId ? [{ userId: farm.ownerId, role: "OWNER", displayName: null as string | null }] : []),
      ...members.map((m) => ({ userId: m.userId, role: m.role, displayName: m.displayName })),
    ];
    const canReadAny = actor.role !== "WORKER";
    const visible = canReadAny ? people : people.filter((p) => p.userId === userId);
    const capabilities = await this.repo.listWorkerCapabilities(visible.map((p) => p.userId));
    const now = new Date();
    return {
      viewerRole: actor.role,
      workers: visible.map((p) => ({
        ...p,
        capabilities: capabilities
          .filter((c) => c.userId === p.userId)
          .map((c) => ({
            id: c.id,
            capabilityId: c.capabilityId,
            key: c.capability.key,
            name: c.capability.name,
            category: c.capability.category,
            level: c.level,
            status: effectiveCapabilityStatus(c.status, c.expiresAt, now),
            verifiedAt: c.verifiedAt,
            expiresAt: c.expiresAt,
            hasVerificationEvidence: Boolean(c.lastVerificationId),
          })),
      })),
    };
  }

  // ── Mutaciones de trabajador ────────────────────────────────────────────────

  async assignWorkerRole(farmId: string, userId: string, workerId: string, input: { role: string; isPrimary?: boolean }) {
    const actor = await this.authorizeWorkerMutation(farmId, userId, workerId);
    const role = await this.repo.findRole(input.role);
    if (!role || !role.active) throw new NotFoundException(`Agro role not found: ${input.role}`);
    return this.repo.upsertWorkerRole({
      userId: workerId, roleId: role.id, isPrimary: input.isPrimary ?? false,
      source: workerId === userId ? "SELF_REPORTED" : "ASSIGNED", farmId, assignedById: userId,
    }, {
      farmId, actorId: userId, entityType: "AgroWorkerRole", entityId: "",
      action: "worker_role.assigned",
      after: { userId: workerId, roleKey: role.key, isPrimary: input.isPrimary ?? false, byRole: actor.role },
      source: "WEB",
    });
  }

  async declareCapability(farmId: string, userId: string, workerId: string, input: {
    capability: string; level?: string; acquiredAt?: Date; notes?: string;
  }) {
    const actor = await this.authorizeWorkerMutation(farmId, userId, workerId);
    assertIn(AGRO_CAPABILITY_LEVELS, input.level, "level");
    const capability = await this.repo.findCapability(input.capability);
    if (!capability || !capability.active) throw new NotFoundException(`Agro capability not found: ${input.capability}`);

    const existing = await this.repo.findWorkerCapabilityFor(workerId, capability.id);
    if (existing) {
      const status = effectiveCapabilityStatus(existing.status, existing.expiresAt);
      if (!canRedeclareCapability(status)) {
        throw new ConflictException(`Capability is ${status}; changing it requires a verification`);
      }
    }
    const level = input.level ?? "BASIC";
    const source = workerId === userId ? "SELF_REPORTED" : "ASSIGNED";
    return this.repo.saveDeclaration({
      userId: workerId, capabilityId: capability.id, level, source, farmId,
      acquiredAt: input.acquiredAt ?? null,
      ...(input.notes !== undefined && { metadata: { notes: input.notes } }),
    }, {
      farmId, actorId: userId, entityType: "AgroWorkerCapability", entityId: "",
      action: existing ? "capability.redeclared" : "capability.declared",
      before: existing ? { status: existing.status, level: existing.level } : undefined,
      after: { userId: workerId, capabilityKey: capability.key, level, status: "SELF_REPORTED", source, byRole: actor.role },
      source: "WEB",
    });
  }

  async requestReview(farmId: string, userId: string, workerCapabilityId: string) {
    const wc = await this.requireWorkerCapability(workerCapabilityId);
    await this.authorizeWorkerMutation(farmId, userId, wc.userId);
    const status = effectiveCapabilityStatus(wc.status, wc.expiresAt);
    if (!canRequestReview(status)) throw new ConflictException(`Cannot request review from status ${status}`);
    return this.repo.updateWorkerCapabilityStatus(wc.id, { status: "IN_REVIEW", farmId }, {
      farmId, actorId: userId, entityType: "AgroWorkerCapability", entityId: wc.id,
      action: "capability.review_requested",
      before: { status }, after: { status: "IN_REVIEW" }, source: "WEB",
    });
  }

  async addCapabilityEvidence(farmId: string, userId: string, workerCapabilityId: string, input: Omit<AgroEvidenceInput, "entityType" | "entityId">) {
    const wc = await this.requireWorkerCapability(workerCapabilityId);
    const actor = await this.access.requireMember(farmId, userId);
    // El propio trabajador o quien puede verificar aporta evidencia.
    if (wc.userId !== userId) assertAgroFarmAction(actor, "capability.verify");
    await this.requireWorkerInFarm(farmId, wc.userId);
    return this.evidence.recordEvidence(farmId, userId, { ...input, entityType: "WORKER_CAPABILITY", entityId: wc.id });
  }

  async verifyCapability(farmId: string, userId: string, workerCapabilityId: string, input: {
    result: string; method: string; levelAssessed?: string; evidenceIds?: string[]; notes?: string; expiresAt?: Date;
  }) {
    assertIn(AGRO_VERIFICATION_RESULTS, input.result, "result");
    assertIn(AGRO_VERIFICATION_METHODS, input.method, "method");
    assertIn(AGRO_CAPABILITY_LEVELS, input.levelAssessed, "levelAssessed");
    const wc = await this.requireWorkerCapability(workerCapabilityId);
    const actor = await this.authorizeVerifier(farmId, userId, wc);

    const status = effectiveCapabilityStatus(wc.status, wc.expiresAt);
    if (!canVerifyFrom(status)) throw new ConflictException(`Cannot verify a ${status} capability; it must be declared again`);

    const evidenceIds = [...new Set(input.evidenceIds ?? [])];
    if (input.result === "APPROVED" && wc.capability.evidenceRequired && evidenceIds.length === 0) {
      throw new BadRequestException("This capability requires at least one evidence item to be verified");
    }
    if (input.result === "REJECTED" && !input.notes?.trim()) {
      throw new BadRequestException("A rejection requires notes explaining the reason");
    }
    await this.evidence.assertEvidenceInFarm(farmId, evidenceIds);

    const now = new Date();
    const approved = input.result === "APPROVED";
    const expiresAt = approved ? verificationExpiry(now, wc.capability.validityDays, input.expiresAt) : null;
    return this.repo.applyVerification({
      verification: {
        workerCapabilityId: wc.id, capabilityId: wc.capabilityId, userId: wc.userId,
        verifierId: userId, verifierFarmRole: actor.role, farmId,
        method: input.method, result: input.result, levelAssessed: input.levelAssessed ?? null,
        evidenceIds, notes: input.notes ?? null, verifiedAt: now, expiresAt,
      },
      capabilityPatch: approved
        ? { status: "VERIFIED", level: input.levelAssessed ?? wc.level, verifiedAt: now, expiresAt, source: "VERIFICATION" }
        : { status: "REJECTED", verifiedAt: null, expiresAt: null },
    }, {
      farmId, actorId: userId, entityType: "AgroWorkerCapability", entityId: wc.id,
      action: approved ? "capability.verified" : "capability.rejected",
      before: { status, level: wc.level },
      after: {
        status: approved ? "VERIFIED" : "REJECTED", level: approved ? (input.levelAssessed ?? wc.level) : wc.level,
        method: input.method, evidenceIds, verifierFarmRole: actor.role,
      },
      source: "WEB",
    });
  }

  async revokeVerification(farmId: string, userId: string, workerCapabilityId: string, input: { reason: string; evidenceIds?: string[] }) {
    if (!input.reason?.trim()) throw new BadRequestException("A revocation requires a reason");
    const wc = await this.requireWorkerCapability(workerCapabilityId);
    const actor = await this.authorizeVerifier(farmId, userId, wc);
    const status = effectiveCapabilityStatus(wc.status, wc.expiresAt);
    if (status !== "VERIFIED" && status !== "EXPIRED") throw new ConflictException(`Only verified capabilities can be revoked (current: ${status})`);
    const evidenceIds = [...new Set(input.evidenceIds ?? [])];
    await this.evidence.assertEvidenceInFarm(farmId, evidenceIds);

    return this.repo.applyVerification({
      verification: {
        workerCapabilityId: wc.id, capabilityId: wc.capabilityId, userId: wc.userId,
        verifierId: userId, verifierFarmRole: actor.role, farmId,
        method: "OTHER", result: "REVOKED", levelAssessed: null,
        evidenceIds, notes: input.reason, verifiedAt: new Date(), expiresAt: null,
      },
      capabilityPatch: { status: "REVOKED", expiresAt: null },
    }, {
      farmId, actorId: userId, entityType: "AgroWorkerCapability", entityId: wc.id,
      action: "capability.revoked",
      before: { status }, after: { status: "REVOKED", reason: input.reason, verifierFarmRole: actor.role },
      source: "WEB",
    });
  }

  async getCapabilityTimeline(farmId: string, userId: string, workerCapabilityId: string) {
    const wc = await this.requireWorkerCapability(workerCapabilityId);
    const actor = await this.access.requireMember(farmId, userId);
    if (wc.userId !== userId) assertAgroFarmAction(actor, "workforce.read_any");
    return this.audit.listForEntity({ farmId, entityType: "AgroWorkerCapability", entityId: wc.id });
  }

  // ── helpers ────────────────────────────────────────────────────────────────

  private assertCatalogKey(key: string) {
    if (!AGRO_CATALOG_KEY_PATTERN.test(key)) {
      throw new BadRequestException(`Invalid key "${key}": use lowercase letters, digits and underscores`);
    }
  }

  private async requireKeys<T extends { key: string }>(keys: string[], find: (k: string[]) => Promise<T[]>, label: string): Promise<T[]> {
    const unique = [...new Set(keys)];
    const found = await find(unique);
    const missing = unique.filter((k) => !found.some((f) => f.key === k));
    if (missing.length) throw new BadRequestException(`Unknown ${label} keys: ${missing.join(", ")}`);
    return found;
  }

  /** Solo el propietario concede o retira el rol MANAGER. */
  private assertCanGrantRole(actor: AgroFarmActor, role: string) {
    if (role === "MANAGER" && actor.role !== "OWNER") {
      throw new ForbiddenException("Only the farm owner can grant or modify the MANAGER role");
    }
  }

  private async requireWorkerInFarm(farmId: string, workerId: string): Promise<AgroFarmRole> {
    const role = await this.access.resolveRole(farmId, workerId);
    if (!role) throw new NotFoundException(`Worker is not a member of this farm: ${workerId}`);
    return role;
  }

  private async requireWorkerCapability(id: string) {
    const wc = await this.repo.findWorkerCapability(id);
    if (!wc) throw new NotFoundException(`Worker capability not found: ${id}`);
    return wc;
  }

  /** Autodeclaración (uno mismo) o asignación por supervisión (otro miembro). */
  private async authorizeWorkerMutation(farmId: string, userId: string, workerId: string): Promise<AgroFarmActor> {
    const actor = await this.access.requireMember(farmId, userId);
    if (workerId === userId) {
      assertAgroFarmAction(actor, "workforce.self_report");
    } else {
      assertAgroFarmAction(actor, "workforce.assign");
      await this.requireWorkerInFarm(farmId, workerId);
    }
    return actor;
  }

  /** Nadie se auto-verifica; las capacidades profesionales exigen rol profesional. */
  private async authorizeVerifier(farmId: string, userId: string, wc: { userId: string; capability: { requiresProfessional: boolean } }) {
    if (wc.userId === userId) throw new ForbiddenException("Workers cannot verify their own capabilities");
    const actor = await this.access.requireMember(farmId, userId);
    assertAgroFarmAction(actor, wc.capability.requiresProfessional ? "capability.verify_professional" : "capability.verify");
    await this.requireWorkerInFarm(farmId, wc.userId);
    return actor;
  }
}
