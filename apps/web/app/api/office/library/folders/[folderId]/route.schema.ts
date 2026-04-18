import { z } from "zod";

export const updateLibraryFolderBodySchema = z.object({
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});
