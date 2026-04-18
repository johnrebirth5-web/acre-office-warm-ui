import { LibraryDocumentVisibility } from "@prisma/client";
import { z } from "zod";

export const createLibraryFolderBodySchema = z.object({
  name: z.string().trim().min(1, "Folder name is required."),
  description: z.string().nullable().optional(),
  parentFolderId: z.string().nullable().optional(),
  scope: z.nativeEnum(LibraryDocumentVisibility).optional()
});
