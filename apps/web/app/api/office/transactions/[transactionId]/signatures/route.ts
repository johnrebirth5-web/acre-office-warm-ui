import { canManageOfficeSignatures } from "@acre/auth";
import { createSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
};

type RecipientRequestBody = {
  id?: string | null;
  role?: "signer" | "approver" | "cc";
  name?: string;
  email?: string;
  recipientRole?: string;
  routingStep?: number | null;
  sortOrder?: number | null;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature access required." }, { status: 403 });
  }

  const { transactionId } = await params;
  const body = (await request.json().catch(() => null)) as
    | {
        signatureRequestId?: string | null;
        formId?: string | null;
        documentId?: string | null;
        offerId?: string | null;
        templateId?: string | null;
        subjectMembershipId?: string | null;
        contextType?: "transaction" | "membership" | "finance_request" | "admin_request" | "generic";
        contextId?: string | null;
        contextLabel?: string | null;
        recipientName?: string;
        recipientEmail?: string;
        recipientRole?: string;
        recipients?: RecipientRequestBody[];
        ccRecipients?: RecipientRequestBody[];
        emailSubject?: string | null;
        emailBody?: string | null;
        expiresAt?: string | null;
        senderDisplayName?: string | null;
        senderReplyTo?: string | null;
        signingOrder?: number | null;
      }
    | null;
  const safeBody = body ?? {};

  const recipients =
    safeBody.recipients?.filter(
      (recipient) =>
        recipient.role !== "cc" &&
        recipient.name?.trim() &&
        recipient.email?.trim() &&
        recipient.recipientRole?.trim()
    ) ?? [];
  const primaryRecipient = recipients[0];
  const legacyRecipientName = safeBody.recipientName?.trim() || primaryRecipient?.name?.trim() || "";
  const legacyRecipientEmail = safeBody.recipientEmail?.trim() || primaryRecipient?.email?.trim() || "";
  const legacyRecipientRole = safeBody.recipientRole?.trim() || primaryRecipient?.recipientRole?.trim() || "";

  if (!recipients.length && (!legacyRecipientName || !legacyRecipientEmail || !legacyRecipientRole)) {
    return NextResponse.json({ error: "At least one signer or approver recipient is required." }, { status: 400 });
  }

  try {
    const signatureRequest = await createSignatureRequest({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      signatureRequestId: safeBody.signatureRequestId?.trim() || null,
      formId: safeBody.formId?.trim() || null,
      documentId: safeBody.documentId?.trim() || null,
      offerId: safeBody.offerId?.trim() || null,
      templateId: safeBody.templateId?.trim() || null,
      subjectMembershipId: safeBody.subjectMembershipId?.trim() || null,
      contextType: safeBody.contextType,
      contextId: safeBody.contextId?.trim() || null,
      contextLabel: safeBody.contextLabel?.trim() || null,
      recipientName: legacyRecipientName,
      recipientEmail: legacyRecipientEmail,
      recipientRole: legacyRecipientRole,
      recipients: recipients.map((recipient, index) => ({
        id: recipient.id?.trim() || null,
        role: recipient.role === "approver" ? "approver" : "signer",
        name: recipient.name!.trim(),
        email: recipient.email!.trim(),
        recipientRole: recipient.recipientRole!.trim(),
        routingStep: typeof recipient.routingStep === "number" ? recipient.routingStep : null,
        sortOrder: typeof recipient.sortOrder === "number" ? recipient.sortOrder : index
      })),
      ccRecipients:
        safeBody.ccRecipients
          ?.filter((recipient) => recipient.name?.trim() && recipient.email?.trim())
          .map((recipient, index) => ({
            id: recipient.id?.trim() || null,
            name: recipient.name!.trim(),
            email: recipient.email!.trim(),
            recipientRole: recipient.recipientRole?.trim() || "CC",
            sortOrder: typeof recipient.sortOrder === "number" ? recipient.sortOrder : recipients.length + index
          })) ?? [],
      emailSubject: safeBody.emailSubject?.trim() || null,
      emailBody: safeBody.emailBody?.trim() || null,
      expiresAt: safeBody.expiresAt?.trim() || null,
      senderDisplayName: safeBody.senderDisplayName?.trim() || null,
      senderReplyTo: safeBody.senderReplyTo?.trim() || null,
      signingOrder: typeof safeBody.signingOrder === "number" ? safeBody.signingOrder : null
    });

    if (!signatureRequest) {
      return NextResponse.json({ error: "Signature request could not be prepared." }, { status: 404 });
    }

    return NextResponse.json({ signatureRequest }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature request could not be prepared." },
      { status: 400 }
    );
  }
}
