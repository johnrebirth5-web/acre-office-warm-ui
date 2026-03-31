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

function isRecipientTerminalStatus(statusKey: string) {
  return statusKey === "acted" || statusKey === "declined" || statusKey === "voided" || statusKey === "expired";
}

function getActiveRecipients(
  recipients: Array<{
    id: string;
    email: string;
    roleKey: string;
    routingStep: number;
    statusKey: string;
  }>
) {
  const actionable = recipients.filter((recipient) => recipient.roleKey !== "cc" && !isRecipientTerminalStatus(recipient.statusKey));

  if (actionable.length === 0) {
    return [];
  }

  const routingStep = actionable.reduce((minimum, recipient) => Math.min(minimum, recipient.routingStep), actionable[0]!.routingStep);
  return actionable.filter((recipient) => recipient.routingStep === routingStep);
}

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
      const baseUrl = getAppBaseUrl(request);
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
      const actionableRecipients = snapshot.signatureRequest.recipients.filter((recipient) => recipient.roleKey !== "cc");

      if (actionableRecipients.length > 1) {
        const recipientIds = new Set(actionableRecipients.map((recipient) => recipient.id));
        const unassignedField = snapshot.fields.find((field) => !field.assignedRecipientId || !recipientIds.has(field.assignedRecipientId));

        if (unassignedField) {
          return NextResponse.json(
            { error: "Assign every field to a specific signer or approver before sending multi-recipient requests." },
            { status: 400 }
          );
        }
      }

      if (snapshot.signatureRequest.recipients.length > 0) {
        const activeRecipients = getActiveRecipients(snapshot.signatureRequest.recipients);
        const recipientTokens = activeRecipients.map((recipient) => {
          const { rawToken, tokenHash } = createSignatureToken();
          return {
            recipient,
            rawToken,
            tokenHash
          };
        });

        for (const entry of recipientTokens) {
          await sendSignatureRequestEmail({
            organizationId: context.currentOrganization.id,
            to: entry.recipient.email,
            subject,
            message,
            signingLink: `${baseUrl}/sign/${encodeURIComponent(entry.rawToken)}`,
            documentTitle: snapshot.document.title,
            expiresAt: snapshot.signatureRequest.expiresAt || null,
            senderDisplayName,
            replyTo: snapshot.signatureRequest.senderReplyTo || context.currentUser.email
          });
        }

        signatureRequest = await updateSignatureRequest({
          organizationId: context.currentOrganization.id,
          transactionId,
          signatureRequestId,
          actorMembershipId: context.currentMembership.id,
          action: action as "send" | "resend",
          recipientTokens: recipientTokens.map((entry) => ({
            recipientId: entry.recipient.id,
            tokenHash: entry.tokenHash
          }))
        });
      } else {
        const { rawToken, tokenHash } = createSignatureToken();

        await sendSignatureRequestEmail({
          organizationId: context.currentOrganization.id,
          to: snapshot.signatureRequest.recipientEmail,
          subject,
          message,
          signingLink: `${baseUrl}/sign/${encodeURIComponent(rawToken)}`,
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
      }
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
