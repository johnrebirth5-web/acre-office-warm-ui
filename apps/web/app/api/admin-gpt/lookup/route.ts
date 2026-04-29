import { NextRequest, NextResponse } from "next/server";
import { lookupAdminGptHelp, type AdminGptLookupInput } from "../../../../lib/admin-gpt/actions";
import {
  buildAdminGptErrorResponse,
  resolveAdminGptActionContext,
} from "../../../../lib/admin-gpt/route-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    await resolveAdminGptActionContext(request);

    const body = (await request.json().catch(() => ({}))) as AdminGptLookupInput;

    return NextResponse.json(lookupAdminGptHelp(body), {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return buildAdminGptErrorResponse(error);
  }
}
