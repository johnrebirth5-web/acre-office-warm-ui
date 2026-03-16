import { getDefaultAppPath } from "@acre/auth";
import { acceptInvitation } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { createSessionCookieValue, getSessionCookieName, getSessionCookieSettings } from "../../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../../lib/request-origin";

function buildInviteRedirect(requestOrigin: string, token: string, error: string) {
  return NextResponse.redirect(new URL(`/invite/${token}?error=${error}`, requestOrigin), 303);
}

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) {
    return NextResponse.redirect(new URL("/login", requestOrigin), 303);
  }

  if (!password) {
    return buildInviteRedirect(requestOrigin, token, "missing_password");
  }

  if (password !== confirmPassword) {
    return buildInviteRedirect(requestOrigin, token, "mismatch");
  }

  let result;
  try {
    result = await acceptInvitation({
      token,
      firstName,
      lastName,
      password
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept invitation.";
    return buildInviteRedirect(requestOrigin, token, message.includes("at least") ? "password_length" : "unknown");
  }

  if (result.status !== "success") {
    return NextResponse.redirect(new URL(`/invite/${token}`, requestOrigin), 303);
  }

  const response = NextResponse.redirect(new URL(getDefaultAppPath(result.context.currentMembership.role), requestOrigin), 303);
  response.cookies.set(
    getSessionCookieName(),
    createSessionCookieValue(result.context.currentMembership.id),
    getSessionCookieSettings()
  );

  return response;
}
