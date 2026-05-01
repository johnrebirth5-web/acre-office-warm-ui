import { exitProjectSigningHandoff, resolveProjectHandoffToken } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    token: string;
  }>;
};

export async function POST(_request: NextRequest, routeContext: RouteContext) {
  const { token } = await routeContext.params;
  const session = await resolveProjectHandoffToken(token);

  if (!session) {
    return NextResponse.json({ error: "Handoff token is invalid or expired." }, { status: 404 });
  }

  await exitProjectSigningHandoff(session.id);

  return NextResponse.json({ exited: true, redirectTo: "/agent/projects" });
}
