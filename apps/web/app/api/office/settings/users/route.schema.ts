import { z } from "zod";

const creatableUserRoles = [
  "owner",
  "office_admin",
  "accountant",
  "human_resources",
  "team_lead",
  "agent",
] as const;

export const createOfficeUserBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    email: z.string().optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z
      .string()
      .trim()
      .min(1, "A supported Back Office role is required.")
      .refine(
        (value) =>
          creatableUserRoles.includes(
            value as (typeof creatableUserRoles)[number],
          ),
        "A supported Back Office role is required.",
      ),
    defaultOfficeId: z.union([z.string(), z.null()]).optional(),
    accessibleOfficeIds: z.array(z.string()).optional(),
    officeId: z.union([z.string(), z.null()]).optional(),
    title: z.union([z.string(), z.null()]).optional(),
    splitTemplateId: z.union([z.string(), z.null()]).optional(),
    customAgentPercent: z.union([z.string(), z.null()]).optional(),
    commissionEffectiveFrom: z.union([z.string(), z.null()]).optional(),
    teamId: z.union([z.string(), z.null()]).optional(),
    reportsToTeamMembershipId: z.union([z.string(), z.null()]).optional(),
  }),
);
