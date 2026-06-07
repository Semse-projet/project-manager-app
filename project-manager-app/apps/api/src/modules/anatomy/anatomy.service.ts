import { Injectable, NotFoundException } from "@nestjs/common";
import { getAnatomyKnowledgeBase } from "@semse/knowledge";
import {
  runAnatomyTutorAgent,
  runAnatomyValidatorAgent
} from "@semse/agents/anatomy";
import type {
  AnatomyQuery,
  AnatomyValidationInput
} from "@semse/schemas";

@Injectable()
export class AnatomyService {
  async getTree() {
    const knowledgeBase = await getAnatomyKnowledgeBase();
    return knowledgeBase.getTree("body");
  }

  async getNode(id: string) {
    const knowledgeBase = await getAnatomyKnowledgeBase();
    const node = knowledgeBase.getNodeById(id);
    if (!node) {
      throw new NotFoundException({ message: `Anatomy node '${id}' not found` });
    }

    return node;
  }

  async getChildren(id: string) {
    const knowledgeBase = await getAnatomyKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getChildren(id);
  }

  async getRelations(id: string) {
    const knowledgeBase = await getAnatomyKnowledgeBase();
    await this.getNode(id);
    return knowledgeBase.getRelations(id);
  }

  async query(input: AnatomyQuery) {
    const result = await runAnatomyTutorAgent({
      nodeId: input.nodeId,
      question: input.search,
      search: input.search
    });

    return {
      ...result,
      includeRelations: input.includeRelations,
      includePath: input.includePath
    };
  }

  async validate(input: AnatomyValidationInput) {
    const result = await runAnatomyValidatorAgent();

    return input.nodes?.length
      ? {
          ...result,
          issues: result.issues.filter((issue) => input.nodes?.some((nodeId) => issue.includes(nodeId)))
        }
      : result;
  }
}
