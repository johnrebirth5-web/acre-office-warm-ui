import { z } from "zod";

const officeFieldModuleSchema = z.enum(["transaction", "contact", "offer"]);

export const reorderOfficeFieldsBodySchema = z.object({
  module: officeFieldModuleSchema.optional(),
  fieldOrder: z
    .array(
      z.object({
        kind: z.enum(["builtIn", "custom"]).optional(),
        fieldKey: z.string().trim().min(1, "fieldKey is required.")
      })
    )
    .optional()
});
