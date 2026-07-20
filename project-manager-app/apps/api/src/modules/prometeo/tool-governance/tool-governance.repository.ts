import { Injectable, Optional } from "@nestjs/common";
import { PrismaService } from "../../../infrastructure/prisma/prisma.service.js";

export type ToolInvocationAuditInput = {
  tenantId: string;
  actorId: string;
  namespace: string;
  name: string;
  mode: string;
  status: string;
  blockedReason?: string;
  requestId: string;
};

@Injectable()
export class ToolGovernanceRepository {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async recordInvocation(input: ToolInvocationAuditInput): Promise<void> {
    if (!this.prisma) {
      return;
    }

    await this.prisma.prometeoToolInvocationAudit.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId,
        namespace: input.namespace,
        name: input.name,
        mode: input.mode,
        status: input.status,
        blockedReason: input.blockedReason,
        requestId: input.requestId,
      },
    });
  }
}
