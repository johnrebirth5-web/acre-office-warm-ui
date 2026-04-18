import { getDefaultAppPath } from "@acre/auth";
import { changeInternalPassword } from "@acre/db";
import { NextRequest, NextResponse } from "next/server";
import { parseFormData } from "../../../../lib/api/parse-body";
import { getRequestSessionContext, mustChangePassword } from "../../../../lib/auth-session";
import { getRequestOrigin } from "../../../../lib/request-origin";
import { changePasswordFormSchema } from "./route.schema";

function buildErrorRedirect(requestOrigin: string, error: string) {
  return NextResponse.redirect(new URL(`/change-password?error=${error}`, requestOrigin), 303);
}

export async function POST(request: NextRequest) {
  const requestOrigin = getRequestOrigin(request);
  const context = await getRequestSessionContext(request, {
    allowPasswordChangeRequired: true
  });

  if (!context) {
    return NextResponse.redirect(new URL("/login", requestOrigin), 303);
  }

  const formData = await request.formData();
  const parsedForm = parseFormData(formData, changePasswordFormSchema);
  const forced = mustChangePassword(context);

  if (!parsedForm.ok) {
    if (parsedForm.fieldErrors.newPassword === "missing_password") {
      return buildErrorRedirect(requestOrigin, "missing_password");
    }

    if (parsedForm.fieldErrors.confirmPassword === "mismatch") {
      return buildErrorRedirect(requestOrigin, "mismatch");
    }

    return buildErrorRedirect(requestOrigin, "unknown");
  }

  try {
    await changeInternalPassword({
      organizationId: context.currentOrganization.id,
      membershipId: context.currentMembership.id,
      currentPassword: forced ? undefined : parsedForm.data.currentPassword,
      newPassword: parsedForm.data.newPassword
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to change password.";

    if (message.includes("Current password is incorrect")) {
      return buildErrorRedirect(requestOrigin, "current_password");
    }

    if (message.includes("at least")) {
      return buildErrorRedirect(requestOrigin, "password_length");
    }

    return buildErrorRedirect(requestOrigin, "unknown");
  }

  const destination = forced ? getDefaultAppPath(context.currentMembership) : "/office/account";
  return NextResponse.redirect(new URL(destination, requestOrigin), 303);
}
