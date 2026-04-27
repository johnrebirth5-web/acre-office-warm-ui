import { z } from "zod";

const bankTaxIdTypeSchema = z.union([z.enum(["ssn", "ein"]), z.literal("")]).optional();
const bankAccountTypeSchema = z
  .union([z.enum(["checking", "savings", "business_checking", "business_savings", "other"]), z.literal("")])
  .optional();

export const saveAgentProfileBodySchema = z.object({
  displayName: z.string().optional(),
  bio: z.string().optional(),
  notes: z.string().optional(),
  licenseNumber: z.string().optional(),
  licenseState: z.string().optional(),
  startDate: z.string().optional(),
  commissionPlanName: z.string().optional(),
  splitTemplateId: z.string().optional(),
  customAgentPercent: z.string().optional(),
  commissionEffectiveFrom: z.string().optional(),
  commissionEffectiveTo: z.string().optional(),
  avatarUrl: z.string().optional(),
  internalExtension: z.string().optional(),
  quickBooksVendorId: z.string().optional(),
  bankPayeeName: z.string().optional(),
  bankFirstName: z.string().optional(),
  bankLastName: z.string().optional(),
  bankEmail: z.string().optional(),
  bankAddress: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankRoutingNumber: z.string().optional(),
  bankPhoneNumber: z.string().optional(),
  bankTaxIdType: bankTaxIdTypeSchema,
  bankTaxIdValue: z.string().optional(),
  bankDateOfBirth: z.string().optional(),
  bankAccountType: bankAccountTypeSchema
});
