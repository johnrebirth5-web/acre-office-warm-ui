import { z } from "zod";

export const createCommissionStatementBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  startDate: z.string().trim().min(1, "startDate is required."),
  endDate: z.string().trim().min(1, "endDate is required.")
});
