import { z } from "zod";

const transactionSearchFieldKinds = ["system", "builtin", "custom"] as const;

export const updateOfficeTransactionSearchLayoutBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({
    fields: z
      .array(
        z.object({
          kind: z.enum(transactionSearchFieldKinds, {
            error: "A supported search layout field kind is required.",
          }),
          key: z.string(),
        }),
      )
      .optional(),
  }),
);
