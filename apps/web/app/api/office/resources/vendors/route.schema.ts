import { z } from "zod";

export const createOfficeVendorBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    category: z.string().optional(),
    name: z.string().optional(),
    headline: z.string().optional(),
    phone: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    neighborhoods: z.array(z.string()).optional(),
    notes: z.string().nullable().optional(),
    isFeatured: z.boolean().optional(),
    visibilityScope: z
      .enum(["organization_wide", "office_only"])
      .optional(),
  }),
);
