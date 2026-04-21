import { z } from "zod";

const manageableUserStatuses = ["active", "invited", "disabled"] as const;
const manageableUserRoles = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
  "office_manager",
  "office_user",
] as const;

export const updateOfficeUserBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    firstName: z.string().trim().min(1, "First name is required.").optional(),
    lastName: z.string().trim().min(1, "Last name is required.").optional(),
    role: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length === 0 ||
          manageableUserRoles.includes(
            value as (typeof manageableUserRoles)[number],
          ),
        "A supported Back Office role is required.",
      )
      .optional(),
    status: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length === 0 ||
          manageableUserStatuses.includes(
            value as (typeof manageableUserStatuses)[number],
          ),
        "A supported user status is required.",
      )
      .optional(),
    defaultOfficeId: z.union([z.string(), z.null()]).optional(),
    accessibleOfficeIds: z.array(z.string()).optional(),
    officeId: z.union([z.string(), z.null()]).optional(),
  }),
);
