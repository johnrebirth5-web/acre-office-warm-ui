import { NextRequest, NextResponse } from "next/server";
import { buildAdminGptContextResponse } from "../../../../lib/admin-gpt/actions";
import {
  buildAdminGptErrorResponse,
  resolveAdminGptActionContext,
} from "../../../../lib/admin-gpt/route-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const context = await resolveAdminGptActionContext(request);

    return NextResponse.json(buildAdminGptContextResponse(context), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return buildAdminGptErrorResponse(error);
  }
}
