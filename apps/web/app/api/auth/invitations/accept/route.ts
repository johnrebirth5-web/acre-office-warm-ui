import { getDefaultAppPath } from "@acre/auth";
import { acceptInvitation } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import {
  createSessionCookieValueWithOfficeSelection,
  getSessionCookieName,
  getSessionCookieSettings,
} from "../../../../../lib/auth-session";
import { parseFormData } from "../../../../../lib/api/parse-body";
import { coerceLocaleCode, getLocaleCookieOptions, localeCookieName } from "../../../../../lib/i18n/config";
import { getRequestOrigin } from "../../../../../lib/request-origin";
import { buildRateLimitKey, consumeRateLimit, hashRateLimitSegment } from "../../../../../lib/rate-limit";
import { acceptInvitationFormSchema } from "./route.schema";

const INVITATION_ACCEPT_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

function buildInviteRedirect(requestOrigin: string, token: string, error: string) {
  return NextResponse.redirect(new URL(`/invite/${token}?error=${error}`, requestOrigin), 303);
}

function getInvitationAcceptRateLimitKey(request: NextRequest, token: string) {
  return buildRateLimitKey(
    "auth/invitations/accept",
    request,
    hashRateLimitSegment(token),
  );
}

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const formData = await request.formData();
  const token = String(formData.get("token") ?? "").trim();

  if (!token) {
    return NextResponse.redirect(new URL("/login", requestOrigin), 303);
  }

  const rateLimitDecision = await consumeRateLimit(
    getInvitationAcceptRateLimitKey(request, token),
    INVITATION_ACCEPT_RATE_LIMIT_OPTIONS,
  );

  if (!rateLimitDecision.allowed) {
    return buildInviteRedirect(requestOrigin, token, "rate_limited");
  }

  const parsedForm = parseFormData(formData, acceptInvitationFormSchema);

  if (!parsedForm.ok) {
    if (parsedForm.fieldErrors.password === "missing_password") {
      return buildInviteRedirect(requestOrigin, token, "missing_password");
    }

    if (parsedForm.fieldErrors.confirmPassword === "mismatch") {
      return buildInviteRedirect(requestOrigin, token, "mismatch");
    }

    return buildInviteRedirect(requestOrigin, token, "unknown");
  }

  let result;
  try {
    result = await acceptInvitation({
      token: parsedForm.data.token,
      firstName: parsedForm.data.firstName,
      lastName: parsedForm.data.lastName,
      password: parsedForm.data.password
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to accept invitation.";
    return buildInviteRedirect(requestOrigin, token, message.includes("at least") ? "password_length" : "unknown");
  }

  if (result.status !== "success") {
    return NextResponse.redirect(new URL(`/invite/${token}`, requestOrigin), 303);
  }

  const response = NextResponse.redirect(new URL(getDefaultAppPath(result.context.currentMembership), requestOrigin), 303);
  response.cookies.set(
    getSessionCookieName(),
    createSessionCookieValueWithOfficeSelection(
      result.context.currentMembership.id,
      result.context.currentOffice?.id ?? null,
    ),
    getSessionCookieSettings()
  );
  response.cookies.set(
    localeCookieName,
    coerceLocaleCode(result.context.currentUser.locale),
    getLocaleCookieOptions()
  );

  return response;
}
