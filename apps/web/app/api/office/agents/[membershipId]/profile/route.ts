import { canManageOfficeAgents } from "@acre/auth";
import { saveAgentProfile } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    membershipId: string;
  }>;
};

type AgentProfilePatchBody = {
  displayName?: string;
  bio?: string;
  notes?: string;
  licenseNumber?: string;
  licenseState?: string;
  startDate?: string;
  commissionPlanName?: string;
  splitTemplateId?: string;
  customAgentPercent?: string;
  commissionEffectiveFrom?: string;
  commissionEffectiveTo?: string;
  avatarUrl?: string;
  internalExtension?: string;
  bankFirstName?: string;
  bankLastName?: string;
  bankEmail?: string;
  bankAddress?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankRoutingNumber?: string;
  bankPhoneNumber?: string;
  bankTaxIdType?: string;
  bankTaxIdValue?: string;
  bankDateOfBirth?: string;
  bankAccountType?: string;
};

function pickSelfServiceBankInformationInput(body: AgentProfilePatchBody | null): AgentProfilePatchBody {
  return {
    bankFirstName: body?.bankFirstName,
    bankLastName: body?.bankLastName,
    bankEmail: body?.bankEmail,
    bankAddress: body?.bankAddress,
    bankName: body?.bankName,
    bankAccountNumber: body?.bankAccountNumber,
    bankRoutingNumber: body?.bankRoutingNumber,
    bankPhoneNumber: body?.bankPhoneNumber,
    bankTaxIdType: body?.bankTaxIdType,
    bankTaxIdValue: body?.bankTaxIdValue,
    bankDateOfBirth: body?.bankDateOfBirth,
    bankAccountType: body?.bankAccountType
  };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { membershipId } = await params;
  const canManageAgents = canManageOfficeAgents(context.currentMembership);
  const canSelfManageBankInformation = context.currentMembership.id === membershipId;

  if (!canManageAgents && !canSelfManageBankInformation) {
    return NextResponse.json({ error: "Agent management or self bank information access required." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as AgentProfilePatchBody | null;
  const input = canManageAgents ? body : pickSelfServiceBankInformationInput(body);

  try {
    const profile = await saveAgentProfile({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      membershipId,
      actorMembershipId: context.currentMembership.id,
      displayName: input?.displayName,
      bio: input?.bio,
      notes: input?.notes,
      licenseNumber: input?.licenseNumber,
      licenseState: input?.licenseState,
      startDate: input?.startDate,
      commissionPlanName: input?.commissionPlanName,
      splitTemplateId: input?.splitTemplateId,
      customAgentPercent: input?.customAgentPercent,
      commissionEffectiveFrom: input?.commissionEffectiveFrom,
      commissionEffectiveTo: input?.commissionEffectiveTo,
      avatarUrl: input?.avatarUrl,
      internalExtension: input?.internalExtension,
      bankFirstName: input?.bankFirstName,
      bankLastName: input?.bankLastName,
      bankEmail: input?.bankEmail,
      bankAddress: input?.bankAddress,
      bankName: input?.bankName,
      bankAccountNumber: input?.bankAccountNumber,
      bankRoutingNumber: input?.bankRoutingNumber,
      bankPhoneNumber: input?.bankPhoneNumber,
      bankTaxIdType: input?.bankTaxIdType,
      bankTaxIdValue: input?.bankTaxIdValue,
      bankDateOfBirth: input?.bankDateOfBirth,
      bankAccountType: input?.bankAccountType
    });

    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save agent profile." }, { status: 400 });
  }
}
