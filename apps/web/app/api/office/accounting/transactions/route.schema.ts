import { z } from "zod";

const accountingTransactionLineItemSchema = z.object({
  id: z.string().optional(),
  ledgerAccountId: z.string().optional(),
  description: z.string().optional(),
  amount: z.string().optional(),
  entrySide: z.enum(["debit", "credit"]).optional()
});

export const saveAccountingTransactionBodySchema = z.object({
  type: z
    .enum([
      "invoice",
      "bill",
      "credit_memo",
      "deposit",
      "received_payment",
      "made_payment",
      "journal_entry",
      "transfer",
      "refund"
    ])
    .optional(),
  status: z.enum(["draft", "open", "posted", "completed", "void"]).optional(),
  accountingDate: z.string().optional(),
  dueDate: z.string().optional(),
  paymentMethod: z.enum(["ach", "check", "wire", "cash", "internal_transfer", "other"]).optional(),
  referenceNumber: z.string().optional(),
  counterpartyName: z.string().optional(),
  memo: z.string().optional(),
  notes: z.string().optional(),
  totalAmount: z.string().optional(),
  relatedTransactionId: z.string().optional(),
  relatedMembershipId: z.string().optional(),
  lineItems: z.array(accountingTransactionLineItemSchema).optional()
});
