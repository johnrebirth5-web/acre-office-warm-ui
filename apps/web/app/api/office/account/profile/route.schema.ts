import { z } from "zod";

export const updateOfficeAccountProfileBodySchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  internalExtension: z.string().optional(),
  avatarUrl: z.string().optional(),
  bio: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseState: z.string().optional(),
  timezone: z.string().optional(),
  locale: z.string().optional()
});
