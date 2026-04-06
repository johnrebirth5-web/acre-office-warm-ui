import { getDefaultAppPath } from "@acre/auth";
import { getMinimumPasswordLength } from "@acre/db";
import { Button } from "@acre/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentSessionContext,
  mustChangePassword,
} from "../../lib/auth-session";

type ChangePasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  switch (error) {
    case "mismatch":
      return "New password and confirmation must match.";
    case "current_password":
      return "Current password is incorrect.";
    case "password_length":
      return `Password must be at least ${getMinimumPasswordLength()} characters.`;
    case "missing_password":
      return "Enter a new password to continue.";
    default:
      return error ? "Unable to change password. Try again." : "";
  }
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  return value.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ChangePasswordPage({
  searchParams,
}: ChangePasswordPageProps) {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true,
  });

  if (!context) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const forced = mustChangePassword(context);
  const credential = context.currentCredential;
  const isLocked = Boolean(
    credential?.lockedUntil && credential.lockedUntil > new Date(),
  );
  const passwordStatusLabel = forced
    ? "Password change required"
    : isLocked
      ? "Temporarily locked"
      : "Password set";
  const passwordStatusDescription = forced
    ? "This signed-in session is blocked from entering Back Office until a new password is saved."
    : isLocked
      ? "New sign-ins are temporarily locked. Saving a new password here clears the lock and failed-attempt counter."
      : "Use this page to rotate the current internal Acre password. After save, you will return to My profile.";
  const passwordChangedAtLabel =
    formatDateTimeLabel(credential?.passwordChangedAt) || "Not recorded yet";
  const lastLoginAtLabel =
    formatDateTimeLabel(credential?.lastLoginAt) ||
    "No successful sign-in recorded";
  const lastFailedLoginAtLabel =
    formatDateTimeLabel(credential?.lastFailedLoginAt) ||
    "No failed sign-ins recorded";
  const lockedUntilLabel = isLocked
    ? formatDateTimeLabel(credential?.lockedUntil) || "Locked"
    : "Not locked";

  if (!forced && !context.currentCredential) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Account Security</span>
            <h2>
              {forced
                ? "Change your password before continuing"
                : "Change password"}
            </h2>
            <p>
              {forced
                ? "This internal account is marked as requiring a password change before Back Office access can continue."
                : "Update the password for your internal Acre account without changing any other sign-in settings."}
            </p>
            <p>{passwordStatusDescription}</p>
            <p>
              Passwords must be at least {getMinimumPasswordLength()}{" "}
              characters.
            </p>
          </div>

          <div className="office-detail-grid">
            <div className="office-detail-field office-detail-field-wide">
              <span className="office-form-helper">Sign-in email</span>
              <strong>{context.currentUser.email}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">Current status</span>
              <strong>{passwordStatusLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">Password last changed</span>
              <strong>{passwordChangedAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                Last successful sign-in
              </span>
              <strong>{lastLoginAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">Last failed sign-in</span>
              <strong>{lastFailedLoginAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">Lock until</span>
              <strong>{lockedUntilLabel}</strong>
            </div>
          </div>

          <form
            action="/api/auth/change-password"
            className="auth-form"
            method="post"
          >
            {forced ? (
              <p className="office-form-helper">
                Current password is not requested here because this signed-in
                session is already verified and the password change is required.
              </p>
            ) : null}

            {!forced ? (
              <label className="auth-field">
                <span>Current password</span>
                <input
                  autoComplete="current-password"
                  name="currentPassword"
                  type="password"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>New password</span>
              <input
                autoComplete="new-password"
                name="newPassword"
                type="password"
              />
            </label>

            <label className="auth-field">
              <span>Confirm new password</span>
              <input
                autoComplete="new-password"
                name="confirmPassword"
                type="password"
              />
            </label>

            {params?.error ? (
              <p className="auth-error">{getErrorMessage(params.error)}</p>
            ) : null}

            <div className="auth-actions">
              <Button className="auth-submit" type="submit">
                Save password
              </Button>
            </div>
          </form>

          {!forced ? (
            <div className="auth-actions">
              <Link
                className="office-button-secondary office-button-sm"
                href="/office/account"
              >
                Back to My profile
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="office-button-secondary office-button-sm"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : null}

          <p>
            No self-service forgot-password or email reset flow exists yet. If
            you cannot sign in at all, an admin must issue a fresh setup link
            from the Users workspace.
          </p>
        </section>
      </section>
    </main>
  );
}
