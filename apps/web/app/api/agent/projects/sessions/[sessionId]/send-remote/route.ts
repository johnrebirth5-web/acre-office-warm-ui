import { canCreateProjectSigning, issueProjectRemoteSigningTokens } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getPublicAppBaseUrl, getRequestOrigin } from "../../../../../../../lib/request-origin";
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

function normalizeHostname(hostname: string) {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, "");
}

function isLoopbackHost(hostname: string) {
  const normalized = normalizeHostname(hostname);

  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1"
  );
}

function isPrivateIpv4Host(hostname: string) {
  const parts = normalizeHostname(hostname).split(".").map((part) => Number(part));

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first = 0, second = 0] = parts;

  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127)
  );
}

function isLocalDevelopmentHost(hostname: string) {
  const normalized = normalizeHostname(hostname);

  return (
    isLoopbackHost(normalized) ||
    isPrivateIpv4Host(normalized) ||
    normalized === "host.docker.internal" ||
    normalized === "host.orb.internal"
  );
}

function isCrossEnvironmentSigningBaseUrl(input: {
  baseUrl: string;
  requestOrigin: string;
}) {
  try {
    const baseUrl = new URL(input.baseUrl);
    const requestOrigin = new URL(input.requestOrigin);

    return isLocalDevelopmentHost(requestOrigin.hostname) && !isLocalDevelopmentHost(baseUrl.hostname);
  } catch {
    return false;
  }
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
    const baseUrl = resolveBaseUrl();
    const requestOrigin = getRequestOrigin(request);

    if (isCrossEnvironmentSigningBaseUrl({ baseUrl, requestOrigin })) {
      return NextResponse.json(
        {
          error:
            "Remote signing email was not sent because this local request would create a production URL backed by a local-only token. Set ACRE_BASE_URL to this local app origin and restart dev, or open https://acresystem.us/agent/projects and send the remote link from production.",
        },
        { status: 409 },
      );
    }

    const tokens = await issueRemoteTokens({
      ...buildProjectSigningContext(context),
      sessionId: params.sessionId,
    });
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
