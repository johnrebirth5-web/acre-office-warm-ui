import { z } from "zod";

export const reviewOfficeIncomingUpdateBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    action: z.enum(["accept", "reject"], {
      error: "A valid review action is required.",
    }),
  }),
);
