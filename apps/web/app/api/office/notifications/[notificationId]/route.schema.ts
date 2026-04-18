import { z } from "zod";

export const updateOfficeNotificationBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    action: z.enum(["mark_read", "mark_unread", "archive", "unarchive"]),
  }),
);
