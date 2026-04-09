import { canViewOfficeContacts } from "@acre/auth";
import { NextRequest, NextResponse } from "next/server";
import { getRequestSessionContext } from "../../../../../lib/auth-session";
import {
  extractFrontOfficeLeadIntakeAssistServer,
  readFrontOfficeLeadIntakeAssistServerFormData,
} from "../../../../../lib/front-office-intake-assist-server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const context = await getRequestSessionContext(request);

  if (!context) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (!canViewOfficeContacts(context.currentMembership)) {
    return NextResponse.json(
      { error: "Lead intake review access required." },
      { status: 403 },
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      { error: "Invalid intake assist payload." },
      { status: 400 },
    );
  }

  const { transcriptText, image, sourceSurface } =
    readFrontOfficeLeadIntakeAssistServerFormData(formData);
  const extraction = await extractFrontOfficeLeadIntakeAssistServer({
    transcriptText,
    image,
  });

  if (!extraction.rawText) {
    return NextResponse.json(
      {
        error:
          "Add a screenshot or paste the chat transcript first so Acre has something to extract from.",
        sourceSurface,
        ...extraction,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ...extraction,
    sourceSurface,
  });
}

