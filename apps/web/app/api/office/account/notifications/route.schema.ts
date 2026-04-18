import { z } from "zod";

export const updateOfficeAccountNotificationsBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    inAppEnabled: z.boolean(),
    approvalAlertsEnabled: z.boolean(),
    taskRemindersEnabled: z.boolean(),
    offerAlertsEnabled: z.boolean(),
    messageAlertsEnabled: z.boolean(),
  }),
);
