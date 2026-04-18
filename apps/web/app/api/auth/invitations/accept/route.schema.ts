import { z } from "zod";

export const acceptInvitationFormSchema = z
  .object({
    token: z.string().trim().min(1, "missing_token"),
    firstName: z.string().optional().default(""),
    lastName: z.string().optional().default(""),
    password: z.string().min(1, "missing_password"),
    confirmPassword: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.password && value.password !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "mismatch",
      });
    }
  });
