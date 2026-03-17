import { getDefaultAppPath } from "@acre/auth";
import { getCurrentSessionContext, mustChangePassword } from "../../lib/auth-session";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

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
    redirect(mustChangePassword(context) ? "/change-password" : getDefaultAppPath(context.currentMembership));
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
            <p>Use your invited internal account email address and password to access the current Back Office workspace. Usernames like admin are not supported.</p>
          </div>

          <LoginForm errorMessage={errorMessage} />
        </section>
      </section>
    </main>
  );
}
