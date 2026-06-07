import { Injectable, NotFoundException } from "@nestjs/common";
import { getRepoKnowledgeBase } from "@semse/knowledge";
import type { RepoQuery } from "@semse/schemas";

@Injectable()
export class RepoKnowledgeService {
  async getTree() {
    const knowledgeBase = await getRepoKnowledgeBase();
    return knowledgeBase.getTree("semse_root");
  }

  async getNode(id: string) {
    const knowledgeBase = await getRepoKnowledgeBase();
    const node = knowledgeBase.getNodeById(id);
    if (!node) {
      throw new NotFoundException({ message: `Repo node '${id}' not found` });
    }

    return node;
  }

  async getChildren(id: string) {
    const knowledgeBase = await getRepoKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getChildren(id);
  }

  async getRelations(id: string) {
    const knowledgeBase = await getRepoKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getRelations(id);
  }

  async query(input: RepoQuery) {
    const knowledgeBase = await getRepoKnowledgeBase();
    const lookup = input.nodeId ?? input.search ?? "semse_root";
    const match = input.nodeId ? knowledgeBase.getNodeById(input.nodeId) : knowledgeBase.findNodes(lookup).at(0);
    const node = match ?? knowledgeBase.getNodeById("semse_root");

    return {
      actionType: "answer",
      summary: node
        ? `Resolved repo query for ${node.name}`
        : "No repo node matched the query",
      confidence: node ? 0.92 : 0.35,
      answer: node
        ? `${node.name} es un nodo de repositorio tipo ${node.kind} con ${knowledgeBase.getChildren(node.id).length} hijos directos y ${knowledgeBase.getRelations(node.id).length} relaciones.`
        : `No encontré un nodo de repositorio para '${lookup}'.`,
      node: node ?? null,
      children: node ? knowledgeBase.getChildren(node.id) : [],
      relations: node ? knowledgeBase.getRelations(node.id) : [],
      path: node ? knowledgeBase.getPathToRoot(node.id) : [],
      includeRelations: input.includeRelations,
      includePath: input.includePath
    };
  }
}
