import { resolveProjectHandoffToken, verifyProjectHandoffPin } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "../../../../../../lib/api/parse-body";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

const exitBodySchema = z.object({
  pin: z.string().trim().min(4).max(6),
});

export async function POST(request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const session = await resolveProjectHandoffToken(token);

  if (!session) {
    return NextResponse.json({ error: "Handoff token is invalid or expired." }, { status: 404 });
  }

  const parsedBody = await parseJsonBody(request, exitBodySchema, {
    error: "PIN payload is invalid.",
  });

  if (!parsedBody.ok) {
    return parsedBody.response;
  }

  const result = await verifyProjectHandoffPin(session.id, parsedBody.data.pin);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.locked ? "PIN is locked. Try again later." : "PIN is incorrect.", locked: result.locked },
      { status: 400 },
    );
  }

  return NextResponse.json({ exited: true, redirectTo: "/agent/projects" });
}

