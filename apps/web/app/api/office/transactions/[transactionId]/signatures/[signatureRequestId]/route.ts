import { canManageOfficeSignatures } from "@acre/auth";
import { getSignatureEditorSnapshot, updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../../lib/request-origin";
import { sendSignatureRequestEmail } from "../../../../../../../lib/signature-email";
import { createSignatureToken } from "../../../../../../../lib/signature-token";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature access required." }, { status: 403 });
  }

  const { transactionId, signatureRequestId } = await params;
  const body = (await request.json().catch(() => null)) as { action?: string } | null;

  const action = body?.action;

  if (!action || !["send", "resend", "viewed", "signed", "declined", "canceled", "expire"].includes(action)) {
    return NextResponse.json({ error: "A valid signature action is required." }, { status: 400 });
  }

  try {
    let signatureRequest = null;

    if (action === "send" || action === "resend") {
      const snapshot = await getSignatureEditorSnapshot(context.currentOrganization.id, transactionId, signatureRequestId);

      if (!snapshot) {
        return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
      }

      if (!snapshot.fields.length) {
        return NextResponse.json({ error: "Add at least one signature field before sending." }, { status: 400 });
      }

      const { rawToken, tokenHash } = createSignatureToken();
      const baseUrl = getAppBaseUrl(request);
      const signingLink = `${baseUrl}/sign/${encodeURIComponent(rawToken)}`;
      const senderDisplayName =
        snapshot.signatureRequest.senderDisplayName ||
        `${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
        context.currentUser.email;
      const subject =
        snapshot.signatureRequest.emailSubject ||
        `Signature requested: ${snapshot.document.title}`;
      const message =
        snapshot.signatureRequest.emailBody ||
        `${senderDisplayName} sent you a document to review and sign in Acre.`;

      await sendSignatureRequestEmail({
        to: snapshot.signatureRequest.recipientEmail,
        subject,
        message,
        signingLink,
        documentTitle: snapshot.document.title,
        expiresAt: snapshot.signatureRequest.expiresAt || null,
        senderDisplayName,
        replyTo: snapshot.signatureRequest.senderReplyTo || context.currentUser.email
      });

      signatureRequest = await updateSignatureRequest({
        organizationId: context.currentOrganization.id,
        transactionId,
        signatureRequestId,
        actorMembershipId: context.currentMembership.id,
        action: action as "send" | "resend",
        tokenHash
      });
    } else {
      signatureRequest = await updateSignatureRequest({
        organizationId: context.currentOrganization.id,
        transactionId,
        signatureRequestId,
        actorMembershipId: context.currentMembership.id,
        action: action as "viewed" | "signed" | "declined" | "canceled" | "expire"
      });
    }

    if (!signatureRequest) {
      return NextResponse.json({ error: "Signature request not found." }, { status: 404 });
    }

    return NextResponse.json({ signatureRequest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Signature request update failed." },
      { status: 400 }
    );
  }
}
