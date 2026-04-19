import { AgentPaymentMethodStatus, AgentPaymentMethodType } from "@prisma/client";
import { z } from "zod";

export const updateAgentBillingPaymentMethodBodySchema = z.object({
  officeId: z.union([z.string(), z.null()]).optional(),
  membershipId: z.string().optional(),
  type: z
    .enum([
      AgentPaymentMethodType.card_on_file,
      AgentPaymentMethodType.bank_account,
      AgentPaymentMethodType.check,
      AgentPaymentMethodType.manual,
      AgentPaymentMethodType.other
    ])
    .optional(),
  label: z.string().optional(),
  provider: z.string().optional(),
  last4: z.string().optional(),
  isDefault: z.boolean().optional(),
  autoPayEnabled: z.boolean().optional(),
  externalReferenceId: z.string().optional(),
  status: z
    .enum([
      AgentPaymentMethodStatus.active,
      AgentPaymentMethodStatus.inactive,
      AgentPaymentMethodStatus.invalid,
      AgentPaymentMethodStatus.expired,
      AgentPaymentMethodStatus.removed
    ])
    .optional()
});
