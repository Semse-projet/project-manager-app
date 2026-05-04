import { BadRequestException, Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { generateContractSchema, signContractSchema } from "@semse/schemas";
import { ok } from "../../common/api-response.js";
import { toVisibleContract } from "../../common/visible-response.js";
import { RequirePermissions } from "../../common/permissions.decorator.js";
import { resolveRequestContext } from "../../common/request-context.js";
import { resolveRequestId } from "../../common/request-id.js";
import { ContractsService } from "./contracts.service.js";

const createContractSchema = generateContractSchema.omit({ jobId: true });
const signCurrentContractSchema = signContractSchema.omit({ contractId: true });

@Controller()
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Post("v1/jobs/:jobId/contracts")
  @RequirePermissions("contracts:create")
  async create(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("jobId") jobId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = createContractSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.contractsService.create({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId,
      termsJson: parsed.data.termsJson,
      requestId
    });

    return ok(requestId, toVisibleContract(data));
  }

  @Get("v1/jobs/:jobId/contracts/current")
  @RequirePermissions("contracts:read")
  async current(@Req() req: { headers?: Record<string, unknown> }, @Param("jobId") jobId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.contractsService.current({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      jobId
    });

    return ok(resolveRequestId(req.headers ?? {}), toVisibleContract(data));
  }

  @Get("v1/contracts/:contractId")
  @RequirePermissions("contracts:read")
  async byId(@Req() req: { headers?: Record<string, unknown> }, @Param("contractId") contractId: string) {
    const actor = resolveRequestContext(req);
    const data = await this.contractsService.byId({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      contractId
    });

    return ok(resolveRequestId(req.headers ?? {}), toVisibleContract(data));
  }

  @Post("v1/contracts/:contractId/sign")
  @RequirePermissions("contracts:sign")
  async sign(
    @Req() req: { headers?: Record<string, unknown> },
    @Param("contractId") contractId: string,
    @Body() body: Record<string, unknown>
  ) {
    const parsed = signCurrentContractSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const actor = resolveRequestContext(req);
    const requestId = resolveRequestId(req.headers ?? {});
    const data = await this.contractsService.sign({
      tenantId: actor.tenantId,
      orgId: actor.orgId,
      userId: actor.userId,
      roles: actor.roles,
      contractId,
      signAs: parsed.data.signAs,
      documentHash: parsed.data.documentHash,
      pdfUrl: parsed.data.pdfUrl,
      requestId
    });

    return ok(requestId, toVisibleContract(data));
  }
}
