import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { hasScopeAccess, scopeFromOwnership } from '../../common/resource-scope.js';

export type LienActor = {
  tenantId: string;
  orgId: string;
  userId: string;
  roles: string[];
};

export type LienOwnership = { clientOrgId: string; assignedProOrgId: string };

/**
 * read — client org, assigned pro org, OPS_ADMIN.
 * pro  — assigned pro org (the lien claimant) or OPS_ADMIN: create calendars,
 *        generate/send notices (certified mail), sign waivers.
 * ops  — OPS_ADMIN only (scheduler-style state transitions).
 */
export type LienAccessMode = 'read' | 'pro' | 'ops';

/** Pure policy (C10/C28): same org-ownership rule as evidence/milestones. */
export function assertLienAccess(actor: LienActor, ownership: LienOwnership, mode: LienAccessMode): void {
  const scope = scopeFromOwnership(actor, ownership);
  if (hasScopeAccess(actor, scope, mode === 'read' ? 'read' : mode === 'pro' ? 'pro' : 'ops')) return;
  if (mode === 'ops') throw new ForbiddenException('operation restricted to operations admins');
  throw new ForbiddenException(
    mode === 'read' ? 'actor does not have access to this project' : 'only the project professional can perform this lien action',
  );
}

/**
 * Tenant + organization + resource scoping for lien endpoints. Lien waivers
 * feed the payment-release gate (WaiverPaymentGateService) and notices trigger
 * certified mail, so these endpoints must never be reachable by an arbitrary
 * authenticated user, and a child id must belong to the project in the path.
 * Anything outside the caller's tenant is reported as not found.
 */
@Injectable()
export class LienAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertProject(actor: LienActor, projectId: string, mode: LienAccessMode): Promise<void> {
    const project = projectId
      ? await this.prisma.project.findFirst({
          where: { id: projectId, tenantId: actor.tenantId },
          select: { assignedProOrgId: true, job: { select: { clientOrgId: true } } },
        })
      : null;
    if (!project) throw new NotFoundException('Project not found');
    assertLienAccess(
      actor,
      { clientOrgId: project.job?.clientOrgId ?? '', assignedProOrgId: project.assignedProOrgId ?? '' },
      mode,
    );
  }

  async assertCalendar(actor: LienActor, projectId: string, calendarId: string, mode: LienAccessMode): Promise<void> {
    await this.assertProject(actor, projectId, mode);
    const calendar = await this.prisma.lienCalendar.findFirst({
      where: { id: calendarId, projectId },
      select: { id: true },
    });
    if (!calendar) throw new NotFoundException('Lien calendar not found for this project');
  }

  async assertWaiver(actor: LienActor, projectId: string, waiverId: string, mode: LienAccessMode): Promise<void> {
    await this.assertProject(actor, projectId, mode);
    const waiver = await this.prisma.lienWaiver.findFirst({
      where: { id: waiverId, lienCalendar: { projectId } },
      select: { id: true },
    });
    if (!waiver) throw new NotFoundException('Lien waiver not found for this project');
  }

  async assertNotice(actor: LienActor, projectId: string, noticeId: string, mode: LienAccessMode): Promise<void> {
    await this.assertProject(actor, projectId, mode);
    const notice = await this.prisma.lienNotice.findFirst({
      where: { id: noticeId, lienCalendar: { projectId } },
      select: { id: true },
    });
    if (!notice) throw new NotFoundException('Lien notice not found for this project');
  }
}
