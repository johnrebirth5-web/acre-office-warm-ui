import { z } from "zod";

const officeTransactionTaskStatuses = [
  "Todo",
  "In progress",
  "Review requested",
  "Completed",
  "Reopened",
] as const;

export const createOfficeTransactionTaskBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    checklistGroup: z.string().optional(),
    title: z.string().trim().min(1, "Task title is required."),
    description: z.string().optional(),
    assigneeMembershipId: z.string().optional(),
    dueAt: z.string().optional(),
    status: z
      .enum(officeTransactionTaskStatuses, {
        error: "A supported task status is required.",
      })
      .optional(),
    requiresDocument: z.boolean().optional(),
    requiresDocumentApproval: z.boolean().optional(),
    requiresSecondaryApproval: z.boolean().optional(),
  }),
);

export const updateOfficeTransactionTaskBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    checklistGroup: z.string().optional(),
    title: z.string().trim().optional(),
    description: z.string().optional(),
    assigneeMembershipId: z.string().optional(),
    dueAt: z.string().optional(),
    status: z
      .enum(officeTransactionTaskStatuses, {
        error: "A supported task status is required.",
      })
      .optional(),
    sortOrder: z.number().finite().optional(),
    requiresDocument: z.boolean().optional(),
    requiresDocumentApproval: z.boolean().optional(),
    requiresSecondaryApproval: z.boolean().optional(),
  }),
);
