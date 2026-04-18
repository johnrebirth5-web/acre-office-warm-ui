import { z } from "zod";

export const createOfficeActivityCommentBodySchema = z.object({
  body: z.string().trim().min(1, "Comment body is required."),
  officeId: z.string().nullable().optional(),
  scopeLabel: z.string().optional()
});
