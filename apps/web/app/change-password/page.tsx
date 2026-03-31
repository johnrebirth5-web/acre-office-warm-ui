import { getDefaultAppPath } from "@acre/auth";
import { getMinimumPasswordLength } from "@acre/db";
import { Button } from "@acre/ui";
import { redirect } from "next/navigation";
import { getCurrentSessionContext, mustChangePassword } from "../../lib/auth-session";

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

export default async function ChangePasswordPage({ searchParams }: ChangePasswordPageProps) {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true
  });

  if (!context) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : undefined;
  const forced = mustChangePassword(context);

  if (!forced && !context.currentCredential) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Account Security</span>
            <h2>{forced ? "Change your password before continuing" : "Change password"}</h2>
            <p>
              {forced
                ? "This internal account requires a password change before you can continue into Back Office."
                : "Update the password for your internal Acre account."}
            </p>
          </div>

          <form action="/api/auth/change-password" className="auth-form" method="post">
            {!forced ? (
              <label className="auth-field">
                <span>Current password</span>
                <input autoComplete="current-password" name="currentPassword" type="password" />
              </label>
            ) : null}

            <label className="auth-field">
              <span>New password</span>
              <input autoComplete="new-password" name="newPassword" type="password" />
            </label>

            <label className="auth-field">
              <span>Confirm new password</span>
              <input autoComplete="new-password" name="confirmPassword" type="password" />
            </label>

            {params?.error ? <p className="auth-error">{getErrorMessage(params.error)}</p> : null}

            <div className="auth-actions">
              <Button className="auth-submit" type="submit">
                Save password
              </Button>
            </div>
          </form>

          {!forced ? (
            <form action="/api/auth/logout" method="post">
              <button className="office-button-secondary office-button-sm" type="submit">
                Sign out
              </button>
            </form>
          ) : null}
        </section>
      </section>
    </main>
  );
}
