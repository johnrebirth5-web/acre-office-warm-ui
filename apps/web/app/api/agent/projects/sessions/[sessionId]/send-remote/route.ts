import { canCreateProjectSigning, issueProjectRemoteSigningTokens } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";
import { getAppBaseUrl } from "../../../../../../../lib/request-origin";
import { sendSignatureRequestEmail } from "../../../../../../../lib/signature-email";

type RouteContext = {
  params: Promise<{
    sessionId: string;
  }>;
};

function buildProjectSigningContext(context: NonNullable<Awaited<ReturnType<typeof getRequestSessionContext>>>) {
  return {
    organizationId: context.currentOrganization.id,
    officeId: context.currentOffice?.id ?? null,
    viewerMembershipId: context.currentMembership.id,
    viewerRole: context.currentMembership.role,
    viewerPermissions: context.currentMembership.permissions,
  };
}

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canCreateProjectSigning(context.currentMembership)) {
    return NextResponse.json({ error: "Project signing create access required." }, { status: 403 });
  }

  const { sessionId } = await routeContext.params;

  try {
    const tokens = await issueProjectRemoteSigningTokens({
      ...buildProjectSigningContext(context),
      sessionId,
    });
    const baseUrl = getAppBaseUrl(request);

    for (const token of tokens) {
      await sendSignatureRequestEmail({
        organizationId: context.currentOrganization.id,
        to: token.email,
        subject: "Project document signature requested",
        message: "Acre sent you project sales documents to review and sign securely.",
        signingLink: `${baseUrl}/sign/session/${encodeURIComponent(token.rawToken)}`,
        documentTitle: "Project signing session",
        expiresAt: token.expiresAt.toISOString(),
        senderDisplayName: "Acre Project Signing",
      });
    }

    return NextResponse.json({
      links: tokens.map((token) => ({
        recipientId: token.recipientId,
        email: token.email,
        name: token.name,
        expiresAt: token.expiresAt,
        signingUrl: `${baseUrl}/sign/session/${encodeURIComponent(token.rawToken)}`,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Remote signing links could not be sent." },
      { status: 400 },
    );
  }
}

