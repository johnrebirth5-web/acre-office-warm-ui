import { z } from "zod";

const officeFieldModuleSchema = z.enum(["transaction", "contact", "offer"]);

export const createOfficeCustomFieldDefinitionBodySchema = z.object({
  module: officeFieldModuleSchema.optional(),
  label: z.string().trim().min(1, "label is required."),
  type: z.string().trim().min(1, "type is required."),
  isRequired: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isDeletionLocked: z.boolean().optional(),
  options: z.array(z.string()).optional()
});
