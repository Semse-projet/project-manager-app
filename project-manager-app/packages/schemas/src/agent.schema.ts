import { z } from "zod";

export const agentRunInputSchema = z.object({
  agentType: z.enum([
    "pricing",
    "job-planner",
    "evidence-coach",
    "risk",
    "dispute"
  ]),
  triggerType: z.enum(["manual", "event", "schedule"]).default("manual"),
  correlationId: z.string().min(1),
  payload: z.record(z.unknown())
});

export type AgentRunInput = z.infer<typeof agentRunInputSchema>;
