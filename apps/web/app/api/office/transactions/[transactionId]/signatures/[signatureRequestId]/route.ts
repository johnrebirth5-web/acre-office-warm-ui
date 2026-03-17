import { canManageOfficeSignatures } from "@acre/auth";
import { updateSignatureRequest } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../../lib/auth-session";

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

  if (!action || !["send", "viewed", "signed", "declined", "canceled"].includes(action)) {
    return NextResponse.json({ error: "A valid signature action is required." }, { status: 400 });
  }

  try {
    const signatureRequest = await updateSignatureRequest({
      organizationId: context.currentOrganization.id,
      transactionId,
      signatureRequestId,
      actorMembershipId: context.currentMembership.id,
      action: action as "send" | "viewed" | "signed" | "declined" | "canceled"
    });

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
