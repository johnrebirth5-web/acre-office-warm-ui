import { LibraryDocumentVisibility } from "@prisma/client";
import { z } from "zod";

export const updateLibraryDocumentBodySchema = z.object({
  title: z.string().optional(),
  folderId: z.string().nullable().optional(),
  summary: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  visibility: z.nativeEnum(LibraryDocumentVisibility).optional()
});
