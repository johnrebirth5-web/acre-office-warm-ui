import { z } from "zod";

const officeFieldModuleSchema = z.enum(["transaction", "contact", "offer"]);

const selectOptionSchema = z.object({
  value: z.string().optional(),
  label: z.string().optional(),
  isEnabled: z.boolean().optional()
});

export const officeFieldSettingsBodySchema = z.object({
  module: officeFieldModuleSchema.optional(),
  contactRoleSettings: z
    .array(
      z.object({
        role: z.string().optional(),
        isRequired: z.boolean().optional()
      })
    )
    .optional(),
  builtInFieldSettings: z
    .array(
      z.object({
        fieldKey: z.string().optional(),
        label: z.string().optional(),
        isRequired: z.boolean().optional(),
        isVisible: z.boolean().optional(),
        sortOrder: z.number().optional(),
        selectOptions: z.array(selectOptionSchema).optional()
      })
    )
    .optional(),
  customFieldDefinitions: z
    .array(
      z.object({
        fieldKey: z.string().optional(),
        label: z.string().optional(),
        type: z.string().optional(),
        isRequired: z.boolean().optional(),
        isVisible: z.boolean().optional(),
        isDeletionLocked: z.boolean().optional(),
        sortOrder: z.number().optional(),
        options: z.array(z.string()).optional()
      })
    )
    .optional()
});
