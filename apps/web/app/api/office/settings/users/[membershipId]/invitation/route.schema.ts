import { z } from "zod";

const invitationActions = ["issue", "revoke"] as const;

export const updateOfficeUserInvitationBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    action: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length === 0 ||
          invitationActions.includes(
            value as (typeof invitationActions)[number],
          ),
        "Invitation action must be issue or revoke.",
      )
      .optional(),
  }),
);
