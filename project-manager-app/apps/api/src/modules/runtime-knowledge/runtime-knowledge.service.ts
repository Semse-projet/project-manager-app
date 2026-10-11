import net from "node:net";
import { Injectable, NotFoundException } from "@nestjs/common";
import { getRuntimeKnowledgeBase } from "@semse/knowledge";
import type { RuntimeNode, RuntimeQuery, RuntimeServiceStatus } from "@semse/schemas";

async function probeHttpTarget(target: string, timeoutMs: number): Promise<Omit<RuntimeServiceStatus, "id" | "name" | "kind">> {
  const startedAt = Date.now();

  try {
    const response = await fetch(target, {
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store"
    });
    const latencyMs = Date.now() - startedAt;
    return {
      status: response.ok ? "online" : "degraded",
      checkedAt: new Date().toISOString(),
      detail: `HTTP ${response.status}`,
      target,
      latencyMs
    };
  } catch (error) {
    return {
      status: "offline",
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : "HTTP probe failed",
      target
    };
  }
}

async function probeTcpTarget(target: string, timeoutMs: number): Promise<Omit<RuntimeServiceStatus, "id" | "name" | "kind">> {
  const startedAt = Date.now();
  const [host, portText] = target.split(":");
  const port = Number(portText);

  if (!host || !portText || !Number.isInteger(port) || port <= 0 || port > 65535) {
    return {
      status: "offline",
      checkedAt: new Date().toISOString(),
      detail: "Invalid TCP target",
      target
    };
  }

  return await new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (result: Omit<RuntimeServiceStatus, "id" | "name" | "kind">) => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () =>
      finish({
        status: "online",
        checkedAt: new Date().toISOString(),
        detail: "TCP connect OK",
        target,
        latencyMs: Date.now() - startedAt
      })
    );
    socket.once("timeout", () =>
      finish({
        status: "offline",
        checkedAt: new Date().toISOString(),
        detail: "TCP timeout",
        target
      })
    );
    socket.once("error", (error) =>
      finish({
        status: "offline",
        checkedAt: new Date().toISOString(),
        detail: error.message,
        target
      })
    );
  });
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

/** `host:port` of a connection URL (credentials never included), or null if unusable. */
function hostPortFromUrl(raw: string | undefined, defaultPort: number): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.hostname ? `${url.hostname}:${url.port || defaultPort}` : null;
  } catch {
    return null;
  }
}

function isLoopbackTarget(target: string): boolean {
  try {
    const host = target.includes("://") ? new URL(target).hostname : target.split(":")[0];
    return LOOPBACK_HOSTS.has(host.replace(/^\[|\]$/g, ""));
  } catch {
    return false;
  }
}

@Injectable()
export class RuntimeKnowledgeService {
  private resolveProbeTargets(node: RuntimeNode): string[] {
    const seedTargets = node.healthCheck?.targets ?? [];
    // The seed targets are the local docker-compose addresses (127.0.0.1:5433, :6379, :9001, :8025).
    // In production they point at this very container, where nothing listens, so they would report
    // every real service as offline. Drop them there; real targets come from the environment.
    const configuredTargets =
      process.env.NODE_ENV === "production" ? seedTargets.filter((target) => !isLoopbackTarget(target)) : seedTargets;

    if (node.id === "api_service") {
      const host = process.env.HOST ?? "127.0.0.1";
      const port = process.env.PORT ?? "4121";
      return [`http://${host}:${port}/v1/health`, ...seedTargets];
    }

    if (node.id === "web_service") {
      const webBaseUrl = process.env.SEMSE_WEB_BASE_URL;
      return webBaseUrl ? [`${webBaseUrl.replace(/\/+$/, "")}/knowledge`, ...seedTargets] : seedTargets;
    }

    if (node.id === "postgres_service") {
      const fromEnv = hostPortFromUrl(process.env.DATABASE_URL, 5432);
      return fromEnv ? [fromEnv, ...configuredTargets] : configuredTargets;
    }

    if (node.id === "redis_service") {
      const fromEnv = hostPortFromUrl(process.env.REDIS_URL, 6379);
      return fromEnv ? [fromEnv, ...configuredTargets] : configuredTargets;
    }

    return configuredTargets;
  }

  async getTree() {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    return knowledgeBase.getTree("semse_runtime");
  }

  async getNode(id: string) {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    const node = knowledgeBase.getNodeById(id);
    if (!node) {
      throw new NotFoundException({ message: `Runtime node '${id}' not found` });
    }

    return node;
  }

  async getChildren(id: string) {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getChildren(id);
  }

  async getRelations(id: string) {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getRelations(id);
  }

  async query(input: RuntimeQuery) {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    const lookup = input.nodeId ?? input.search ?? "semse_runtime";
    const match = input.nodeId ? knowledgeBase.getNodeById(input.nodeId) : knowledgeBase.findNodes(lookup).at(0);
    const node = match ?? knowledgeBase.getNodeById("semse_runtime");

    return {
      actionType: "answer",
      summary: node ? `Resolved runtime query for ${node.name}` : "No runtime node matched the query",
      confidence: node ? 0.93 : 0.36,
      answer: node
        ? `${node.name} es un servicio runtime tipo ${node.kind} con ${knowledgeBase.getChildren(node.id).length} hijos directos y ${knowledgeBase.getRelations(node.id).length} relaciones.`
        : `No encontré un nodo runtime para '${lookup}'.`,
      node: node ?? null,
      children: node ? knowledgeBase.getChildren(node.id) : [],
      relations: node ? knowledgeBase.getRelations(node.id) : [],
      path: node ? knowledgeBase.getPathToRoot(node.id) : [],
      includeRelations: input.includeRelations,
      includePath: input.includePath
    };
  }

  async getServiceStatuses() {
    const knowledgeBase = await getRuntimeKnowledgeBase();
    return Promise.all(knowledgeBase.getServiceNodes().map((node) => this.probeNodeStatus(node)));
  }

  protected async probeNodeStatus(node: RuntimeNode): Promise<RuntimeServiceStatus> {
    if (!node.healthCheck) {
      return {
        id: node.id,
        name: node.name,
        kind: node.kind,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        detail: "No probe configured"
      };
    }

    if (node.healthCheck.type === "internal") {
      return {
        id: node.id,
        name: node.name,
        kind: node.kind,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        detail: "Internal service requires process-level instrumentation",
        target: node.healthCheck.targets[0]
      };
    }

    const timeoutMs = node.healthCheck.timeoutMs ?? 2_500;
    const targets = this.resolveProbeTargets(node);
    if (targets.length === 0) {
      return {
        id: node.id,
        name: node.name,
        kind: node.kind,
        status: "unknown",
        checkedAt: new Date().toISOString(),
        detail: "No probe target configured for this environment"
      };
    }

    const results =
      node.healthCheck.type === "http"
        ? await Promise.all(targets.map((target) => probeHttpTarget(target, timeoutMs)))
        : await Promise.all(targets.map((target) => probeTcpTarget(target, timeoutMs)));
    const preferred = results.find((result) => result.status === "online") ?? results[0];

    return {
      id: node.id,
      name: node.name,
      kind: node.kind,
      ...preferred
    };
  }
}
