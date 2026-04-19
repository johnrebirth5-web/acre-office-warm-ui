import { z } from "zod";

export const signatureRequestActionBodySchema = z.object({
  action: z.enum([
    "send",
    "resend",
    "viewed",
    "signed",
    "declined",
    "canceled",
    "expire",
  ]),
});
