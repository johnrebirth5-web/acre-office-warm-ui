import { z } from "zod";

const signatureDriveFolderMappingsSchema = z
  .object({
    hr: z.string().optional(),
    finance: z.string().optional(),
    admin: z.string().optional(),
    transaction: z.string().optional(),
    generic: z.string().optional(),
  })
  .optional();

export const saveSignatureDriveBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    isEnabled: z.boolean().optional(),
    projectId: z.string().optional(),
    clientEmail: z.string().optional(),
    clientId: z.string().optional(),
    privateKeyId: z.string().optional(),
    privateKey: z.string().optional(),
    sharedDriveId: z.string().optional(),
    rootFolderId: z.string().optional(),
    folderMappings: signatureDriveFolderMappingsSchema,
  }),
);
