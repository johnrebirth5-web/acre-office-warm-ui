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
import { withApiGuard } from "../../../../../lib/with-api-guard";
import { acceptInvitationFormSchema } from "./route.schema";

const INVITATION_ACCEPT_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

type AcceptInvitationRouteDependencies = {
  acceptInvitation?: typeof acceptInvitation;
  getRequestOrigin?: typeof getRequestOrigin;
  rateLimit?: typeof consumeRateLimit;
  withApiGuard?: typeof withApiGuard;
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

export async function handleInvitationAcceptPost(
  request: NextRequest,
  dependencies: AcceptInvitationRouteDependencies = {},
) {
  return (dependencies.withApiGuard ?? withApiGuard)<{
    parsedForm: ReturnType<typeof parseFormData<typeof acceptInvitationFormSchema>>;
    requestOrigin: string;
    token: string;
  }>(
    request,
    async ({ prepared }) => {
      if (!prepared.token) {
        return NextResponse.redirect(
          new URL("/login", prepared.requestOrigin),
          303,
        );
      }

      if (!prepared.parsedForm.ok) {
        if (prepared.parsedForm.fieldErrors.password === "missing_password") {
          return buildInviteRedirect(
            prepared.requestOrigin,
            prepared.token,
            "missing_password",
          );
        }

        if (prepared.parsedForm.fieldErrors.confirmPassword === "mismatch") {
          return buildInviteRedirect(
            prepared.requestOrigin,
            prepared.token,
            "mismatch",
          );
        }

        return buildInviteRedirect(prepared.requestOrigin, prepared.token, "unknown");
      }

      let result;
      try {
        result = await (dependencies.acceptInvitation ?? acceptInvitation)({
          token: prepared.parsedForm.data.token,
          firstName: prepared.parsedForm.data.firstName,
          lastName: prepared.parsedForm.data.lastName,
          password: prepared.parsedForm.data.password
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to accept invitation.";
        return buildInviteRedirect(
          prepared.requestOrigin,
          prepared.token,
          message.includes("at least") ? "password_length" : "unknown",
        );
      }

      if (result.status !== "success") {
        return NextResponse.redirect(
          new URL(`/invite/${prepared.token}`, prepared.requestOrigin),
          303,
        );
      }

      const response = NextResponse.redirect(
        new URL(getDefaultAppPath(result.context.currentMembership), prepared.requestOrigin),
        303,
      );
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
    },
    {
      prepare: async ({ request: guardedRequest }) => {
        const formData = await guardedRequest.formData();
        return {
          parsedForm: parseFormData(formData, acceptInvitationFormSchema),
          requestOrigin: (dependencies.getRequestOrigin ?? getRequestOrigin)(
            guardedRequest,
          ),
          token: String(formData.get("token") ?? "").trim(),
        };
      },
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: ({ prepared, request: guardedRequest }) =>
          getInvitationAcceptRateLimitKey(guardedRequest, prepared.token),
        message: "Too many invitation accept attempts. Please try again in a moment.",
        onRejected: ({ prepared }) =>
          buildInviteRedirect(prepared.requestOrigin, prepared.token, "rate_limited"),
        options: INVITATION_ACCEPT_RATE_LIMIT_OPTIONS,
      },
    },
  );
}

export async function POST(request: NextRequest) {
  return handleInvitationAcceptPost(request);
}
