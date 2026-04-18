import { canManageOfficeSignatures } from "@acre/auth";
import { getSignatureEditorSnapshot, updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { isSameOriginRequest } from "../../../../../../../lib/csrf";
import { getAppBaseUrl } from "../../../../../../../lib/request-origin";
import {
  buildRateLimitKey,
  consumeRateLimit,
  type RateLimitConsumer,
  type RateLimitOptions,
} from "../../../../../../../lib/rate-limit";
import {
  resolveSignatureRequestReplyTo,
  resolveSignatureSenderDisplayName,
  sendSignatureRequestEmail
} from "../../../../../../../lib/signature-email";
import { createSignatureToken } from "../../../../../../../lib/signature-token";
import { parseAllowedString, readJsonObject } from "../../../../../../../lib/validate";
import { withPermission } from "../../../../../../../lib/with-permission";

type RouteContext = {
  params: Promise<{
    transactionId: string;
    signatureRequestId: string;
  }>;
};

const signatureRequestActions = [
  "send",
  "resend",
  "viewed",
  "signed",
  "declined",
  "canceled",
  "expire",
] as const;

type SignatureRequestAction = (typeof signatureRequestActions)[number];

const DEFAULT_SIGNATURE_SEND_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 10 * 60 * 1000,
};

type SignatureRequestRouteDependencies = {
  csrf?: typeof isSameOriginRequest;
  createSignatureToken?: typeof createSignatureToken;
  getAppBaseUrl?: typeof getAppBaseUrl;
  getRequestSessionContext?: typeof getRequestSessionContext;
  getSignatureEditorSnapshot?: typeof getSignatureEditorSnapshot;
  rateLimit?: RateLimitConsumer;
  rateLimitOptions?: RateLimitOptions;
  sendSignatureRequestEmail?: typeof sendSignatureRequestEmail;
  updateSignatureRequest?: typeof updateSignatureRequest;
  withPermission?: typeof withPermission;
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

function buildSignatureActionErrorResponse(
  error: string,
  status: 400 | 403 | 429,
  retryAfterSeconds?: number,
) {
  const response = NextResponse.json({ error }, { status });
  response.headers.set("Cache-Control", "no-store");

  if (retryAfterSeconds) {
    response.headers.set("Retry-After", String(retryAfterSeconds));
  }

  return response;
}

function getSignatureSendRateLimitKey(
  request: NextRequest,
  membershipId: string,
  transactionId: string,
  signatureRequestId: string,
  action: Extract<SignatureRequestAction, "send" | "resend">,
) {
  return buildRateLimitKey(
    "office/signatures/send",
    request,
    membershipId,
    transactionId,
    signatureRequestId,
    action,
  );
}

export async function handleSignatureRequestPatch(
  request: NextRequest,
  routeContext: Awaited<RouteContext["params"]>,
  dependencies: SignatureRequestRouteDependencies = {},
) {
  const csrfCheck = dependencies.csrf ?? isSameOriginRequest;

  if (!csrfCheck(request)) {
    return buildSignatureActionErrorResponse("CSRF validation failed.", 403);
  }

  const withSignaturePermission =
    dependencies.withPermission ?? withPermission;

  return withSignaturePermission(
    request,
    canManageOfficeSignatures,
    async (context) => {
      const { transactionId, signatureRequestId } = routeContext;
      const body = await readJsonObject(request);
      const action = parseAllowedString(
        typeof body?.action === "string" ? body.action : null,
        signatureRequestActions,
      );

      if (!action) {
        return NextResponse.json(
          { error: "A valid signature action is required." },
          { status: 400 },
        );
      }

      if (action === "send" || action === "resend") {
        const rateLimitDecision = await (
          dependencies.rateLimit ?? consumeRateLimit
        )(
          getSignatureSendRateLimitKey(
            request,
            context.currentMembership.id,
            transactionId,
            signatureRequestId,
            action,
          ),
          dependencies.rateLimitOptions ??
            DEFAULT_SIGNATURE_SEND_RATE_LIMIT_OPTIONS,
        );

        if (!rateLimitDecision.allowed) {
          return buildSignatureActionErrorResponse(
            "Too many signature send attempts. Please try again in a moment.",
            429,
            rateLimitDecision.retryAfterSeconds,
          );
        }
      }

      try {
        let signatureRequest = null;

        if (action === "send" || action === "resend") {
          const loadSignatureEditorSnapshot =
            dependencies.getSignatureEditorSnapshot ??
            getSignatureEditorSnapshot;
          const persistSignatureRequest =
            dependencies.updateSignatureRequest ?? updateSignatureRequest;
          const sendSignatureEmail =
            dependencies.sendSignatureRequestEmail ?? sendSignatureRequestEmail;
          const createToken =
            dependencies.createSignatureToken ?? createSignatureToken;
          const baseUrl =
            (dependencies.getAppBaseUrl ?? getAppBaseUrl)(request);
          const snapshot = await loadSignatureEditorSnapshot(
            context.currentOrganization.id,
            transactionId,
            signatureRequestId,
          );

          if (!snapshot) {
            return NextResponse.json(
              { error: "Signature request not found." },
              { status: 404 },
            );
          }

          if (!snapshot.fields.length) {
            return NextResponse.json(
              { error: "Add at least one signature field before sending." },
              { status: 400 },
            );
          }

          const senderDisplayName = resolveSignatureSenderDisplayName(
            snapshot.signatureRequest.senderDisplayName,
            `${context.currentUser.firstName} ${context.currentUser.lastName}`.trim() ||
              context.currentUser.email,
          );
          const subject =
            snapshot.signatureRequest.emailSubject ||
            `Signature requested: ${snapshot.document.title}`;
          const message =
            snapshot.signatureRequest.emailBody ||
            `${senderDisplayName} sent you a document to review and sign in Acre.`;
          const actionableRecipients =
            snapshot.signatureRequest.recipients.filter(
              (recipient) => recipient.roleKey !== "cc",
            );

          if (actionableRecipients.length > 1) {
            const recipientIds = new Set(
              actionableRecipients.map((recipient) => recipient.id),
            );
            const unassignedField = snapshot.fields.find(
              (field) =>
                !field.assignedRecipientId ||
                !recipientIds.has(field.assignedRecipientId),
            );

            if (unassignedField) {
              return NextResponse.json(
                {
                  error:
                    "Assign every field to a specific signer or approver before sending multi-recipient requests.",
                },
                { status: 400 },
              );
            }
          }

          if (snapshot.signatureRequest.recipients.length > 0) {
            const activeRecipients = getActiveRecipients(
              snapshot.signatureRequest.recipients,
            );
            const recipientTokens = activeRecipients.map((recipient) => {
              const { rawToken, tokenHash } = createToken();
              return {
                recipient,
                rawToken,
                tokenHash,
              };
            });

            for (const entry of recipientTokens) {
              await sendSignatureEmail({
                organizationId: context.currentOrganization.id,
                to: entry.recipient.email,
                subject,
                message,
                signingLink: `${baseUrl}/sign/${encodeURIComponent(
                  entry.rawToken,
                )}`,
                documentTitle: snapshot.document.title,
                expiresAt: snapshot.signatureRequest.expiresAt || null,
                senderDisplayName,
                replyTo: resolveSignatureRequestReplyTo(
                  snapshot.signatureRequest.senderReplyTo,
                ),
              });
            }

            signatureRequest = await persistSignatureRequest({
              organizationId: context.currentOrganization.id,
              transactionId,
              signatureRequestId,
              actorMembershipId: context.currentMembership.id,
              action,
              recipientTokens: recipientTokens.map((entry) => ({
                recipientId: entry.recipient.id,
                tokenHash: entry.tokenHash,
              })),
            });
          } else {
            const { rawToken, tokenHash } = createToken();

            await sendSignatureEmail({
              organizationId: context.currentOrganization.id,
              to: snapshot.signatureRequest.recipientEmail,
              subject,
              message,
              signingLink: `${baseUrl}/sign/${encodeURIComponent(rawToken)}`,
              documentTitle: snapshot.document.title,
              expiresAt: snapshot.signatureRequest.expiresAt || null,
              senderDisplayName,
              replyTo: resolveSignatureRequestReplyTo(
                snapshot.signatureRequest.senderReplyTo,
              ),
            });

            signatureRequest = await persistSignatureRequest({
              organizationId: context.currentOrganization.id,
              transactionId,
              signatureRequestId,
              actorMembershipId: context.currentMembership.id,
              action,
              tokenHash,
            });
          }
        } else {
          signatureRequest = await (
            dependencies.updateSignatureRequest ?? updateSignatureRequest
          )({
            organizationId: context.currentOrganization.id,
            transactionId,
            signatureRequestId,
            actorMembershipId: context.currentMembership.id,
            action,
          });
        }

        if (!signatureRequest) {
          return NextResponse.json(
            { error: "Signature request not found." },
            { status: 404 },
          );
        }

        return NextResponse.json({ signatureRequest });
      } catch (error) {
        return NextResponse.json(
          {
            error:
              error instanceof Error
                ? error.message
                : "Signature request update failed.",
          },
          { status: 400 },
        );
      }
    },
    {
      forbiddenMessage: "Signature access required.",
      getRequestSessionContext: dependencies.getRequestSessionContext,
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return handleSignatureRequestPatch(request, await params);
}
