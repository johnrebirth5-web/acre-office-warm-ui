import { canManageOfficeSignatures } from "@acre/auth";
import { createSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";

type RouteContext = {
  params: Promise<{
    transactionId: string;
  }>;
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
        recipientName?: string;
        recipientEmail?: string;
        recipientRole?: string;
        emailSubject?: string | null;
        emailBody?: string | null;
        expiresAt?: string | null;
        senderDisplayName?: string | null;
        senderReplyTo?: string | null;
        signingOrder?: number | null;
      }
    | null;

  if (!body?.recipientName?.trim() || !body.recipientEmail?.trim() || !body.recipientRole?.trim()) {
    return NextResponse.json({ error: "Recipient name, email, and role are required." }, { status: 400 });
  }

  try {
    const signatureRequest = await createSignatureRequest({
      organizationId: context.currentOrganization.id,
      officeId: context.currentOffice?.id ?? null,
      transactionId,
      actorMembershipId: context.currentMembership.id,
      signatureRequestId: body.signatureRequestId?.trim() || null,
      formId: body.formId?.trim() || null,
      documentId: body.documentId?.trim() || null,
      offerId: body.offerId?.trim() || null,
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail,
      recipientRole: body.recipientRole,
      emailSubject: body.emailSubject?.trim() || null,
      emailBody: body.emailBody?.trim() || null,
      expiresAt: body.expiresAt?.trim() || null,
      senderDisplayName: body.senderDisplayName?.trim() || null,
      senderReplyTo: body.senderReplyTo?.trim() || null,
      signingOrder: typeof body.signingOrder === "number" ? body.signingOrder : null
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
