import { canManageOfficeSignatures } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../../lib/auth-session";
import { attemptSignatureDriveSync } from "../../../../../../lib/signature-drive-sync";

type RouteContext = {
  params: Promise<{
    signatureRequestId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: RouteContext) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  if (!canManageOfficeSignatures(context.currentMembership)) {
    return NextResponse.json({ error: "Signature management permission required." }, { status: 403 });
  }

  const { signatureRequestId } = await params;

  try {
    const result = await attemptSignatureDriveSync({
      organizationId: context.currentOrganization.id,
      signatureRequestId
    });

    return NextResponse.json(result, {
      status: result.ok ? 200 : 400
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Drive sync retry failed." },
      { status: 400 }
    );
  }
}
