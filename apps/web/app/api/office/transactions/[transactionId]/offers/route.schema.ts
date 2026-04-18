import { z } from "zod";

export const createOfficeOfferBodySchema = z.preprocess(
  (value) => value ?? {},
  z.object({}).passthrough(),
);
