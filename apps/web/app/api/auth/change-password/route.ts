import { getDefaultAppPath } from "@acre/auth";
import { changeInternalPassword } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseFormData } from "../../../../lib/api/parse-body";
import {
  createSessionCookieValueWithOfficeSelection,
  getRequestSessionContext,
  getSessionCookieName,
  getSessionCookieSettings,
  mustChangePassword,
} from "../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../lib/request-origin";
import { buildRateLimitKey, consumeRateLimit } from "../../../../lib/rate-limit";
import { withApiGuard } from "../../../../lib/with-api-guard";
import { changePasswordFormSchema } from "./route.schema";

const CHANGE_PASSWORD_RATE_LIMIT_OPTIONS = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
};

type ChangePasswordRouteDependencies = {
  changeInternalPassword?: typeof changeInternalPassword;
  getRequestOrigin?: typeof getRequestOrigin;
  getRequestSessionContext?: typeof getRequestSessionContext;
  rateLimit?: typeof consumeRateLimit;
  withApiGuard?: typeof withApiGuard;
};

function buildErrorRedirect(requestOrigin: string, error: string) {
  return NextResponse.redirect(new URL(`/change-password?error=${error}`, requestOrigin), 303);
}

function getChangePasswordRateLimitKey(request: NextRequest, membershipId: string) {
  return buildRateLimitKey(
    "auth/change-password",
    request,
    membershipId || "anonymous",
  );
}

export async function handleChangePasswordPost(
  request: NextRequest,
  dependencies: ChangePasswordRouteDependencies = {},
) {
  return (dependencies.withApiGuard ?? withApiGuard)<{
    parsedForm: ReturnType<typeof parseFormData<typeof changePasswordFormSchema>>;
    requestOrigin: string;
  }>(
    request,
    async ({ context, prepared }) => {
      const forced = mustChangePassword(context!);

      if (!prepared.parsedForm.ok) {
        if (prepared.parsedForm.fieldErrors.newPassword === "missing_password") {
          return buildErrorRedirect(prepared.requestOrigin, "missing_password");
        }

        if (prepared.parsedForm.fieldErrors.confirmPassword === "mismatch") {
          return buildErrorRedirect(prepared.requestOrigin, "mismatch");
        }

        return buildErrorRedirect(prepared.requestOrigin, "unknown");
      }

      try {
        await (dependencies.changeInternalPassword ?? changeInternalPassword)({
          organizationId: context!.currentOrganization.id,
          membershipId: context!.currentMembership.id,
          currentPassword: forced
            ? undefined
            : prepared.parsedForm.data.currentPassword,
          newPassword: prepared.parsedForm.data.newPassword,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to change password.";

        if (message.includes("Current password is incorrect")) {
          return buildErrorRedirect(prepared.requestOrigin, "current_password");
        }

        if (message.includes("at least")) {
          return buildErrorRedirect(prepared.requestOrigin, "password_length");
        }

        return buildErrorRedirect(prepared.requestOrigin, "unknown");
      }

      const destination = forced
        ? getDefaultAppPath(context!.currentMembership)
        : "/office/account";
      const response = NextResponse.redirect(
        new URL(destination, prepared.requestOrigin),
        303,
      );
      response.cookies.set(
        getSessionCookieName(),
        createSessionCookieValueWithOfficeSelection(
          context!.currentMembership.id,
          context!.currentOffice?.id ?? null,
        ),
        getSessionCookieSettings(),
      );

      return response;
    },
    {
      getRequestSessionContext: (guardedRequest) =>
        (dependencies.getRequestSessionContext ?? getRequestSessionContext)(
          guardedRequest,
          {
            allowPasswordChangeRequired: true,
          },
        ),
      onUnauthorized: ({ request: guardedRequest }) =>
        NextResponse.redirect(
          new URL(
            "/login",
            (dependencies.getRequestOrigin ?? getRequestOrigin)(guardedRequest),
          ),
          303,
        ),
      prepare: async ({ request: guardedRequest }) => {
        const formData = await guardedRequest.formData();
        return {
          parsedForm: parseFormData(formData, changePasswordFormSchema),
          requestOrigin: (dependencies.getRequestOrigin ?? getRequestOrigin)(
            guardedRequest,
          ),
        };
      },
      rateLimit: {
        consumer: dependencies.rateLimit ?? consumeRateLimit,
        key: ({ context, request: guardedRequest }) =>
          getChangePasswordRateLimitKey(
            guardedRequest,
            context!.currentMembership.id,
          ),
        message: "Too many change-password attempts. Please try again in a moment.",
        onRejected: ({ prepared }) =>
          buildErrorRedirect(prepared.requestOrigin, "rate_limited"),
        options: CHANGE_PASSWORD_RATE_LIMIT_OPTIONS,
      },
      requireAuth: true,
    },
  );
}

export async function POST(request: NextRequest) {
  return handleChangePasswordPost(request);
}
