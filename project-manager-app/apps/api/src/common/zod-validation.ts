import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

export function parseWithSchema<TOutput>(schema: ZodType<TOutput>, input: unknown): TOutput {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException(parsed.error.flatten());
  }
  return parsed.data;
}
