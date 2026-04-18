import { ResourceType } from "@prisma/client";
import { z } from "zod";

export const updateOfficeResourceBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    title: z.string().optional(),
    summary: z.string().optional(),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    type: z.literal(ResourceType.training_video),
    visibilityScope: z
      .enum(["organization_wide", "office_only"])
      .optional(),
  }),
);
