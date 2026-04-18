import { z } from "zod";

export const changePasswordFormSchema = z
  .object({
    currentPassword: z.string().optional().default(""),
    newPassword: z.string().min(1, "missing_password"),
    confirmPassword: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.newPassword && value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "mismatch",
      });
    }
  });
