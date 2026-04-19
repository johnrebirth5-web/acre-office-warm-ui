import { z } from "zod";

const officeFieldModuleSchema = z.enum(["transaction", "contact", "offer"]);

export const updateOfficeCustomFieldDefinitionBodySchema = z.object({
  module: officeFieldModuleSchema.optional(),
  label: z.string().optional(),
  type: z.string().optional(),
  isRequired: z.boolean().optional(),
  isVisible: z.boolean().optional(),
  isDeletionLocked: z.boolean().optional(),
  sortOrder: z.number().optional(),
  options: z.array(z.string()).optional()
});
