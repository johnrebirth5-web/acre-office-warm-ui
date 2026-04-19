import { z } from "zod";

const checklistItemSchema = z.object({
  checklistGroup: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  dueDaysOffset: z.string().optional(),
  requiresDocument: z.boolean().optional(),
  requiresDocumentApproval: z.boolean().optional(),
  requiresSecondaryApproval: z.boolean().optional()
});

export const createChecklistTemplateBodySchema = z.object({
  name: z.string().trim().min(1, "name is required."),
  description: z.string().optional(),
  transactionType: z.string().optional(),
  isActive: z.boolean().optional(),
  items: z.array(checklistItemSchema).optional()
});
