import { Injectable, Logger } from "@nestjs/common";
import { execFile } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";
import { promisify } from "util";

const exec = promisify(execFile);
const TIMEOUT_MS = 15_000;

export type GraphifyResult = { available: boolean; result: string };

@Injectable()
export class GraphifyService {
  private readonly logger = new Logger(GraphifyService.name);
  readonly graphPath: string;
  private readonly bin: string;

  constructor() {
    this.graphPath =
      process.env["GRAPHIFY_GRAPH_PATH"] ??
      resolve(process.cwd(), "graphify-out/graph.json");
    this.bin = process.env["GRAPHIFY_BIN"] ?? "graphify";
  }

  get isAvailable(): boolean {
    return existsSync(this.graphPath);
  }

  async query(question: string, budget = 2000): Promise<GraphifyResult> {
    return this.run(["query", question, "--graph", this.graphPath, "--budget", String(budget)]);
  }

  async path(from: string, to: string): Promise<GraphifyResult> {
    return this.run(["path", from, to, "--graph", this.graphPath]);
  }

  async explain(concept: string): Promise<GraphifyResult> {
    return this.run(["explain", concept, "--graph", this.graphPath]);
  }

  async affected(node: string, relation?: string): Promise<GraphifyResult> {
    const args = ["affected", node, "--graph", this.graphPath];
    if (relation) args.push("--relation", relation);
    return this.run(args);
  }

  /** Builds a structural context block for RAG prompt injection. */
  async buildStructuralContext(question: string): Promise<string> {
    const r = await this.query(question, 1500);
    if (!r.available || !r.result) return "";
    return `## Contexto estructural del código (Graphify)\n${r.result}`;
  }

  private async run(args: string[]): Promise<GraphifyResult> {
    if (!this.isAvailable) return { available: false, result: "" };
    try {
      const { stdout } = await exec(this.bin, args, { timeout: TIMEOUT_MS });
      return { available: true, result: stdout.trim() };
    } catch (err) {
      this.logger.warn(`[graphify] ${args[0]} failed: ${(err as Error).message}`);
      return { available: false, result: "" };
    }
  }
}
