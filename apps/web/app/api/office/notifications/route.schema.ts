import { z } from "zod";

export const markOfficeNotificationsBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    action: z.literal("mark_all_read"),
    notificationIds: z.array(z.string()).optional(),
    type: z.string().optional(),
    category: z.string().optional(),
  }),
);
