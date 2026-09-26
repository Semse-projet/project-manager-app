import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  AdminIntegrationCheck,
  AdminIntegrationId,
  AdminIntegrationState,
  AdminIntegrationStatus,
  AdminSettings,
} from "@semse/schemas";
import { adminIntegrationIdSchema } from "@semse/schemas";
import { AdminService } from "./admin.service.js";

type StoredCheck = AdminIntegrationCheck | undefined;

type IntegrationRuntime = {
  id: AdminIntegrationId;
  label: string;
  purpose: string;
  requiredVariables: string[];
  missingVariables: string[];
  simulation: boolean;
  simulationMessage?: string;
};

export function resolveAdminIntegrationState(input: {
  simulation: boolean;
  missingVariables: string[];
  check?: StoredCheck;
}): AdminIntegrationState {
  if (input.simulation) return "SIMULATION";
  if (input.missingVariables.length > 0) return "UNCONFIGURED";
  if (input.check?.state === "VERIFIED") return "VERIFIED";
  if (input.check?.state === "ERROR") return "ERROR";
  return "CONFIGURED_UNVERIFIED";
}

@Injectable()
export class AdminIntegrationsService {
  private readonly logger = new Logger(AdminIntegrationsService.name);

  constructor(
    private readonly admin: AdminService,
    private readonly config: ConfigService,
  ) {}

  async list(tenantId: string): Promise<AdminIntegrationStatus[]> {
    const settings = await this.admin.getSettings(tenantId);
    return this.runtimeDefinitions().map((runtime) => this.toStatus(runtime, settings));
  }

  async verify(
    tenantId: string,
    rawIntegrationId: string,
    actor: { userId: string; requestId: string },
  ): Promise<AdminIntegrationStatus> {
    const parsed = adminIntegrationIdSchema.safeParse(rawIntegrationId);
    if (!parsed.success) {
      throw new BadRequestException("Unknown integration");
    }

    const integrationId = parsed.data;
    const settings = await this.admin.getSettings(tenantId);
    const runtime = this.runtimeDefinitions().find((item) => item.id === integrationId)!;
    const current = this.toStatus(runtime, settings);

    if (!current.canVerify) {
      return current;
    }

    const checkedAt = new Date().toISOString();
    const result = await this.probe(integrationId);
    const check: AdminIntegrationCheck = {
      state: result.ok ? "VERIFIED" : "ERROR",
      checkedAt,
      message: result.message.slice(0, 240),
    };

    const saved = await this.admin.recordIntegrationCheck(tenantId, integrationId, check, actor);

    this.logger.log({ integrationId, state: check.state }, "Admin integration verification completed");
    return this.toStatus(runtime, saved);
  }

  private toStatus(runtime: IntegrationRuntime, settings: AdminSettings): AdminIntegrationStatus {
    const check = settings.integrations.checks[runtime.id];
    const state = resolveAdminIntegrationState({
      simulation: runtime.simulation,
      missingVariables: runtime.missingVariables,
      check,
    });
    const enabledForTenant = runtime.id === "openai" || runtime.id === "github"
      ? settings.integrations[runtime.id]
      : null;

    return {
      id: runtime.id,
      label: runtime.label,
      purpose: runtime.purpose,
      state,
      enabledForTenant,
      requiredVariables: runtime.requiredVariables,
      missingVariables: runtime.missingVariables,
      checkedAt: state === "VERIFIED" || state === "ERROR" ? check?.checkedAt ?? null : null,
      message: this.statusMessage(state, runtime, check),
      canVerify: state === "CONFIGURED_UNVERIFIED" || state === "VERIFIED" || state === "ERROR",
    };
  }

  private statusMessage(
    state: AdminIntegrationState,
    runtime: IntegrationRuntime,
    check?: StoredCheck,
  ): string {
    switch (state) {
      case "SIMULATION":
        return runtime.simulationMessage ?? "La integración está operando en modo simulado.";
      case "UNCONFIGURED":
        return `Faltan variables del servidor: ${runtime.missingVariables.join(", ")}.`;
      case "CONFIGURED_UNVERIFIED":
        return "Las variables necesarias están presentes, pero la conexión todavía no ha sido comprobada.";
      case "VERIFIED":
      case "ERROR":
        return check?.message ?? "No hay resultado de comprobación disponible.";
    }
  }

  private runtimeDefinitions(): IntegrationRuntime[] {
    const has = (name: string) => Boolean(this.read(name));
    const missing = (names: string[]) => names.filter((name) => !has(name));
    const communicationsMode = this.read("SEMSE_COMMUNICATIONS_MODE") ?? "mock";
    const paymentProvider = this.read("PAYMENT_PROVIDER") ?? "mock";
    const localPrMode = this.read("SEMSE_AUTONOMY_LOCAL_PR_MODE") === "true";

    const githubToken = this.read("SEMSE_AUTONOMY_GITHUB_TOKEN") ?? this.read("GITHUB_TOKEN");
    const githubRepo = this.read("SEMSE_AUTONOMY_REPO_NAME") ?? this.read("REPO_NAME");
    const githubMissing = [
      !githubToken ? "SEMSE_AUTONOMY_GITHUB_TOKEN" : null,
      !githubRepo ? "SEMSE_AUTONOMY_REPO_NAME" : null,
    ].filter((value): value is string => Boolean(value));

    return [
      {
        id: "openai",
        label: "OpenAI",
        purpose: "Modelos y automatizaciones de IA autorizadas por SEMSE.",
        requiredVariables: ["OPENAI_API_KEY"],
        missingVariables: missing(["OPENAI_API_KEY"]),
        simulation: false,
      },
      {
        id: "github",
        label: "GitHub",
        purpose: "Ramas, pull requests y automatización gobernada del repositorio.",
        requiredVariables: ["SEMSE_AUTONOMY_GITHUB_TOKEN", "SEMSE_AUTONOMY_REPO_NAME"],
        missingVariables: githubMissing,
        simulation: localPrMode || (!githubToken && process.env.NODE_ENV !== "production"),
        simulationMessage: "Autonomy usa repositorios y pull requests locales; no publica en GitHub.",
      },
      {
        id: "whatsapp",
        label: "WhatsApp Cloud",
        purpose: "Mensajes operativos y recepción de solicitudes mediante Meta.",
        requiredVariables: [
          "WHATSAPP_CLOUD_ACCESS_TOKEN",
          "WHATSAPP_CLOUD_PHONE_NUMBER_ID",
          "WHATSAPP_CLOUD_VERIFY_TOKEN",
          "WHATSAPP_APP_SECRET",
        ],
        missingVariables: missing([
          "WHATSAPP_CLOUD_ACCESS_TOKEN",
          "WHATSAPP_CLOUD_PHONE_NUMBER_ID",
          "WHATSAPP_CLOUD_VERIFY_TOKEN",
          "WHATSAPP_APP_SECRET",
        ]),
        simulation: communicationsMode !== "live",
        simulationMessage: "SEMSE_COMMUNICATIONS_MODE no está en live; los mensajes son simulados.",
      },
      {
        id: "stripe",
        label: "Stripe",
        purpose: "Cobros, escrow, transferencias y reembolsos gobernados.",
        requiredVariables: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
        missingVariables: missing(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"]),
        simulation: paymentProvider === "mock",
        simulationMessage: "PAYMENT_PROVIDER está en mock; no se realizan operaciones reales en Stripe.",
      },
      {
        id: "hellosign",
        label: "Dropbox Sign",
        purpose: "Solicitudes de firma para contratos de SEMSE.",
        requiredVariables: ["HELLOSIGN_API_KEY"],
        missingVariables: missing(["HELLOSIGN_API_KEY"]),
        simulation: !has("HELLOSIGN_API_KEY"),
        simulationMessage: "Sin HELLOSIGN_API_KEY, Contratos genera resultados simulados de firma.",
      },
    ];
  }

  private async probe(integrationId: AdminIntegrationId): Promise<{ ok: boolean; message: string }> {
    try {
      const response = await fetch(this.probeUrl(integrationId), {
        method: "GET",
        headers: this.probeHeaders(integrationId),
        signal: AbortSignal.timeout(8_000),
      });

      if (!response.ok) {
        return { ok: false, message: `El proveedor respondió HTTP ${response.status}; revisa la credencial y sus permisos.` };
      }

      return { ok: true, message: "Conexión de solo lectura verificada con el proveedor." };
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError"
        ? "La prueba excedió 8 segundos."
        : "No fue posible alcanzar al proveedor.";
      return { ok: false, message: reason };
    }
  }

  private probeUrl(integrationId: AdminIntegrationId): string {
    switch (integrationId) {
      case "openai":
        return "https://api.openai.com/v1/models";
      case "github":
        return "https://api.github.com/user";
      case "whatsapp": {
        const version = this.read("WHATSAPP_CLOUD_API_VERSION") ?? "v20.0";
        const phoneNumberId = this.read("WHATSAPP_CLOUD_PHONE_NUMBER_ID")!;
        return `https://graph.facebook.com/${version}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number`;
      }
      case "stripe":
        return "https://api.stripe.com/v1/balance";
      case "hellosign":
        return "https://api.hellosign.com/v3/account";
    }
  }

  private probeHeaders(integrationId: AdminIntegrationId): Record<string, string> {
    switch (integrationId) {
      case "openai":
        return { authorization: `Bearer ${this.read("OPENAI_API_KEY")!}` };
      case "github":
        return {
          accept: "application/vnd.github+json",
          authorization: `Bearer ${this.read("SEMSE_AUTONOMY_GITHUB_TOKEN") ?? this.read("GITHUB_TOKEN")!}`,
          "user-agent": "semse-integration-check",
          "x-github-api-version": "2022-11-28",
        };
      case "whatsapp":
        return { authorization: `Bearer ${this.read("WHATSAPP_CLOUD_ACCESS_TOKEN")!}` };
      case "stripe":
        return { authorization: `Basic ${Buffer.from(`${this.read("STRIPE_SECRET_KEY")!}:`).toString("base64")}` };
      case "hellosign":
        return { authorization: `Basic ${Buffer.from(`${this.read("HELLOSIGN_API_KEY")!}:`).toString("base64")}` };
    }
  }

  private read(name: string): string | undefined {
    const value = this.config.get<string>(name)?.trim();
    return value || undefined;
  }
}
