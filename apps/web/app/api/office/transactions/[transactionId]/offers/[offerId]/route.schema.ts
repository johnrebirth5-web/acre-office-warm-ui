import { z } from "zod";

const officeOfferActions = [
  "submit",
  "receive",
  "review",
  "counter",
  "accept",
  "reject",
  "withdraw",
  "expire",
] as const;

export const updateOfficeOfferBodySchema = z.preprocess(
  (value) => value ?? {},
  z
    .object({
      action: z
        .preprocess(
          (value) => (typeof value === "string" ? value.trim() : value),
          z.enum(officeOfferActions, {
            error: "A valid offer action is required.",
          }),
        )
        .optional(),
      isPrimaryOffer: z.boolean().optional(),
    })
    .passthrough(),
);
