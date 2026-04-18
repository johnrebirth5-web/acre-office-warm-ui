import { z } from "zod";

const manageablePermissionOverrideEffects = ["allow", "deny"] as const;
const permissionOverrideScopes = ["global", "company"] as const;

export const membershipPermissionOverrideSchema = z.object({
  permissionKey: z
    .string()
    .trim()
    .min(1, "Permission key is required."),
  effect: z
    .string()
    .trim()
    .refine(
      (value) =>
        manageablePermissionOverrideEffects.includes(
          value as (typeof manageablePermissionOverrideEffects)[number],
        ),
      "Permission override effect must be allow or deny.",
    ),
});

export const updateOfficeUserPermissionsBodySchema = z
  .preprocess(
    (value) => value ?? {},
    z.object({
      overrides: z.array(membershipPermissionOverrideSchema).optional(),
      scope: z
        .string()
        .trim()
        .refine(
          (value) =>
            value.length === 0 ||
            permissionOverrideScopes.includes(
              value as (typeof permissionOverrideScopes)[number],
            ),
          "Permission override scope must be global or company.",
        )
        .optional(),
      officeId: z.string().trim().optional(),
    }),
  )
  .superRefine((value, ctx) => {
    if (value.scope === "company" && !value.officeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["officeId"],
        message: "Company scope requires an officeId.",
      });
    }
  });

export const resetOfficeUserPermissionsQuerySchema = z
  .object({
    scope: z
      .string()
      .trim()
      .refine(
        (value) =>
          value.length === 0 ||
          permissionOverrideScopes.includes(
            value as (typeof permissionOverrideScopes)[number],
          ),
        "Permission override scope must be global or company.",
      )
      .optional(),
    officeId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.scope === "company" && !value.officeId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["officeId"],
        message: "Company scope requires an officeId.",
      });
    }
  });
