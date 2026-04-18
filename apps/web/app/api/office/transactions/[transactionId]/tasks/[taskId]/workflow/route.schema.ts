import { z } from "zod";

const officeTransactionTaskWorkflowActions = [
  "complete",
  "reopen",
  "request_review",
  "approve",
  "reject",
] as const;

export const runOfficeTransactionTaskWorkflowBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    action: z.preprocess(
      (value) => (typeof value === "string" ? value.trim() : value),
      z.enum(officeTransactionTaskWorkflowActions, {
        error: "A valid workflow action is required.",
      }),
    ),
    rejectionReason: z
      .preprocess(
        (value) => (typeof value === "string" ? value.trim() : value),
        z.string(),
      )
      .optional(),
    source: z.string().optional(),
  }),
);
