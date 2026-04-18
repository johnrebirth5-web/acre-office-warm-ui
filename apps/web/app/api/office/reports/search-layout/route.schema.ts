import { z } from "zod";

export const updateOfficeTransactionReportSearchLayoutBodySchema = z.object({
  fields: z.array(z.string().trim().min(1, "Search layout field key is required.")).optional()
});
