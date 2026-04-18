import { z } from "zod";

export const updateOfficeMailThreadBodySchema = z.object({
  action: z.enum(["mark_read", "mark_unread", "archive", "unarchive"], {
    error: () => ({
      message: "A supported mail thread action is required."
    })
  })
});
