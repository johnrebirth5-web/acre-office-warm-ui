import { NextRequest, NextResponse } from "next/server";
import { buildAdminGptOpenApiDocument } from "../../../../lib/admin-gpt/openapi";
import { getAppBaseUrl } from "../../../../lib/request-origin";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return NextResponse.json(buildAdminGptOpenApiDocument(getAppBaseUrl(request)), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
