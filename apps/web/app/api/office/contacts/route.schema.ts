import { z } from "zod";

export const officeContactPayloadSchema = z.object({}).catchall(z.unknown());
