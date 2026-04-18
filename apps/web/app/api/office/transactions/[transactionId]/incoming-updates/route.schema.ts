import { z } from "zod";

export const createOfficeIncomingUpdateBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    sourceSystem: z
      .string()
      .trim()
      .min(1, "Source system is required."),
    sourceReference: z
      .string()
      .trim()
      .min(1, "Source reference is required."),
    summary: z
      .string()
      .trim()
      .min(1, "Summary is required."),
    payload: z.record(z.string(), z.unknown()).optional(),
  }),
);
