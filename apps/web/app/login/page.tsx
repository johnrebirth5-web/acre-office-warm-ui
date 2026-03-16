import { getDefaultAppPath } from "@acre/auth";
import { getCurrentSessionContext, mustChangePassword } from "../../lib/auth-session";
import { Button } from "@acre/ui";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const context = await getCurrentSessionContext({
    allowPasswordChangeRequired: true
  });

  if (context) {
    redirect(mustChangePassword(context) ? "/change-password" : getDefaultAppPath(context.currentMembership.role));
  }

  const params = searchParams ? await searchParams : undefined;
  const errorMessage =
    params?.error === "locked"
      ? "This account is temporarily locked. Ask an admin to unlock it or try again later."
      : params?.error
        ? "Email or password is incorrect."
        : "";

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-card-copy">
            <span className="auth-eyebrow">Internal Access</span>
            <h2>Acre internal login</h2>
            <p>Use your invited internal account email and password to access the current Back Office workspace.</p>
          </div>

          <form action="/api/auth/login" className="auth-form" method="post">
            <label className="auth-field">
              <span>Email</span>
              <input autoComplete="email" name="email" placeholder="you@acreny.us" type="email" />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input autoComplete="current-password" name="password" placeholder="Enter your password" type="password" />
            </label>

            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

            <div className="auth-actions">
              <Button className="auth-submit" type="submit">
                Log in
              </Button>
            </div>
          </form>
        </section>
      </section>
    </main>
  );
}
