import { AgentPaymentMethodStatus, AgentPaymentMethodType } from "@prisma/client";
import { z } from "zod";

export const createAgentBillingPaymentMethodBodySchema = z.object({
  membershipId: z.string().trim().min(1, "membershipId is required."),
  type: z.enum([
    AgentPaymentMethodType.card_on_file,
    AgentPaymentMethodType.bank_account,
    AgentPaymentMethodType.check,
    AgentPaymentMethodType.manual,
    AgentPaymentMethodType.other
  ]),
  label: z.string().trim().min(1, "label is required."),
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
