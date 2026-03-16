import { getDefaultAppPath } from "@acre/auth";
import { authenticatePasswordUser } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createSessionCookieValue, getSessionCookieName, getSessionCookieSettings, mustChangePassword } from "../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../lib/request-origin";

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const formData = await request.formData();
  const email = String(formData.get("workEmail") ?? formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("workPassword") ?? formData.get("password") ?? "");
  const result = await authenticatePasswordUser(email, password);

  if (result.status === "locked") {
    return NextResponse.redirect(new URL("/login?error=locked", requestOrigin), 303);
  }

  if (result.status !== "success") {
    return NextResponse.redirect(new URL("/login?error=invalid_credentials", requestOrigin), 303);
  }

  const redirectPath = mustChangePassword(result.context) ? "/change-password" : getDefaultAppPath(result.context.currentMembership.role);
  const response = NextResponse.redirect(new URL(redirectPath, requestOrigin), 303);

  response.cookies.set(getSessionCookieName(), createSessionCookieValue(result.context.currentMembership.id), getSessionCookieSettings());

  return response;
}
