import { z } from "zod";

export const createOfficeOfferCommentBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    body: z
      .string()
      .trim()
      .min(1, "Comment body is required."),
  }),
);
