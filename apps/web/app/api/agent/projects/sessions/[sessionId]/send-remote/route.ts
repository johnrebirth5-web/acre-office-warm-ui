import { canCreateProjectSigning, issueProjectRemoteSigningTokens } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getPublicAppBaseUrl } from "../../../../../../../lib/request-origin";
import { sendSignatureRequestEmail } from "../../../../../../../lib/signature-email";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

type SendProjectRemoteDependencies = {
  canCreateProjectSigning?: typeof canCreateProjectSigning;
  getAppBaseUrl?: typeof getPublicAppBaseUrl;
  getRequestSessionContext?: typeof getRequestSessionContext;
  issueProjectRemoteSigningTokens?: typeof issueProjectRemoteSigningTokens;
  sendSignatureRequestEmail?: typeof sendSignatureRequestEmail;
};

type ProjectRemoteToken = Awaited<ReturnType<typeof issueProjectRemoteSigningTokens>>[number];

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

function buildSigningLink(baseUrl: string, token: ProjectRemoteToken) {
  return `${baseUrl}/sign/session/${encodeURIComponent(token.rawToken)}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Signature request email could not be sent.";
}

function buildDeliveryWarning(input: {
  deliveredCount: number;
  failedEmails: string[];
}) {
  const failedLabel = input.failedEmails.join(", ");

  if (input.deliveredCount > 0) {
    return `Remote links were created, but email delivery failed for ${failedLabel}. Copy the secure link below for those recipients, then check Settings > Email delivery.`;
  }

  return `Remote links were created, but email delivery failed for ${failedLabel}. Copy the secure link below, then check Settings > Email delivery.`;
}

export async function handleSendProjectRemotePost(
  request: NextRequest,
  params: { sessionId: string },
  dependencies: SendProjectRemoteDependencies = {},
) {
  const resolveSessionContext = dependencies.getRequestSessionContext ?? getRequestSessionContext;
  const checkCreateProjectSigning = dependencies.canCreateProjectSigning ?? canCreateProjectSigning;
  const issueRemoteTokens = dependencies.issueProjectRemoteSigningTokens ?? issueProjectRemoteSigningTokens;
  const sendRequestEmail = dependencies.sendSignatureRequestEmail ?? sendSignatureRequestEmail;
  const resolveBaseUrl = dependencies.getAppBaseUrl ?? getPublicAppBaseUrl;
  const context = await resolveSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!checkCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  try {
    const tokens = await issueRemoteTokens({
      ...buildProjectSigningContext(context),
      sessionId: params.sessionId,
    });
    const baseUrl = resolveBaseUrl();
    const links = tokens.map((token) => ({
      recipientId: token.recipientId,
      email: token.email,
      name: token.name,
      expiresAt: token.expiresAt,
      signingUrl: buildSigningLink(baseUrl, token),
    }));
    const delivered = [];
    const emailDeliveryFailures = [];

    for (const token of tokens) {
      try {
        await sendRequestEmail({
          organizationId: context.currentOrganization.id,
          to: token.email,
          subject: "Project document signature requested",
          message: "Acre sent you project sales documents to review and sign securely.",
          signingLink: buildSigningLink(baseUrl, token),
          documentTitle: "Project signing session",
          expiresAt: token.expiresAt.toISOString(),
          senderDisplayName: "Acre Project Signing",
        });
        delivered.push({
          recipientId: token.recipientId,
          email: token.email,
          name: token.name,
        });
      } catch (emailError) {
        emailDeliveryFailures.push({
          recipientId: token.recipientId,
          email: token.email,
          name: token.name,
          error: getErrorMessage(emailError),
        });
      }
    }

    if (emailDeliveryFailures.length > 0) {
      return NextResponse.json(
        {
          links,
          delivered,
          emailDeliveryFailures,
          emailDeliveryWarning: buildDeliveryWarning({
            deliveredCount: delivered.length,
            failedEmails: emailDeliveryFailures.map((failure) => failure.email),
          }),
        },
        { status: delivered.length > 0 ? 207 : 502 },
      );
    }

    return NextResponse.json({
      links,
      delivered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Remote signing links could not be sent." },
      { status: 400 },
    );
  }
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const { sessionId } = await routeContext.params;

  return handleSendProjectRemotePost(request, { sessionId });
}
