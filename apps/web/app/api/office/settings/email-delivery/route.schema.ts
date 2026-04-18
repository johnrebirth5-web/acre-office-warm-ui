import { z } from "zod";

export const saveEmailDeliveryBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    isEnabled: z.boolean().optional(),
    host: z.string().optional(),
    port: z.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    user: z.string().optional(),
    password: z.string().optional(),
    fromEmail: z.string().optional(),
    fromName: z.string().optional(),
    replyTo: z.string().optional(),
  }),
);
