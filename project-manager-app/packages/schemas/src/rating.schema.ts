import { z } from "zod";

// Matches RatingRecord in apps/api/src/modules/ratings/ratings.repository.ts —
// the shape returned by GET /v1/ratings, GET /v1/ratings/:ratingId and
// POST /v1/ratings. `createdAt` is a Date server-side but serializes to an
// ISO string over the wire, same convention as evidenceRecordSchema.
export const ratingRecordSchema = z.object({
  id: z.string().min(1),
  jobId: z.string().min(1),
  score: z.number(),
  comment: z.string().optional(),
  createdAt: z.string().min(1),
  job: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
  }),
  fromUser: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
  }),
  toUser: z.object({
    id: z.string().min(1),
    email: z.string().min(1),
  }),
});

export type RatingRecordView = z.infer<typeof ratingRecordSchema>;
