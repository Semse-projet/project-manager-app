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

@Injectable()
export class RuntimeKnowledgeService {
  private resolveProbeTargets(node: RuntimeNode): string[] {
    const configuredTargets = node.healthCheck?.targets ?? [];

    if (node.id === "api_service") {
      const host = process.env.HOST ?? "127.0.0.1";
      const port = process.env.PORT ?? "4121";
      return [`http://${host}:${port}/v1/health`, ...configuredTargets];
    }

    if (node.id === "web_service") {
      const webBaseUrl = process.env.SEMSE_WEB_BASE_URL;
      return webBaseUrl ? [`${webBaseUrl.replace(/\/+$/, "")}/knowledge`, ...configuredTargets] : configuredTargets;
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
