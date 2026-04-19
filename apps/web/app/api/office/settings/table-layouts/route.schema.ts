import { z } from "zod";

export const saveOfficeTableLayoutBodySchema = z.object({
  tableKey: z.string().trim().min(1, "tableKey is required."),
  columns: z
    .array(
      z.object({
        key: z.string().trim().min(1, "key is required."),
        width: z.number()
      })
    )
    .optional()
});
