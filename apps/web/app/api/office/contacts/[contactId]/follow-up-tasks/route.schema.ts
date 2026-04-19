import { z } from "zod";

export const createContactFollowUpTaskBodySchema = z.object({
  title: z.string().trim().min(1, "title is required."),
  dueAt: z.string().optional()
});
