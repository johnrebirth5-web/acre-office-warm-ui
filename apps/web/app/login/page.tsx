import { getDefaultAppPath } from "@acre/auth";
import {
  getCurrentSessionContext,
  mustChangePassword,
  sanitizeLoginNextPath,
} from "../../lib/auth-session";
import { getServerI18n } from "../../lib/i18n/server";
import { redirect } from "next/navigation";
import { LocaleSwitcher } from "../_components/locale-switcher";
import { LoginForm } from "./login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    error?: string;
    next?: string;
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
  const nextPath = sanitizeLoginNextPath(params?.next);
  const { t } = await getServerI18n();
  const errorMessage =
    params?.error === "locked"
      ? t((messages) => messages.auth.accountLocked)
      : params?.error
        ? t((messages) => messages.auth.invalidCredentials)
        : "";

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-locale-switcher-row">
            <LocaleSwitcher className="auth-locale-switcher" />
          </div>
          <div className="auth-card-copy">
            <span className="auth-eyebrow">{t((messages) => messages.auth.internalAccess)}</span>
            <h2>{t((messages) => messages.auth.loginTitle)}</h2>
            <p>{t((messages) => messages.auth.loginDescription)}</p>
          </div>

          <LoginForm errorMessage={errorMessage} nextPath={nextPath} />
        </section>
      </section>
    </main>
  );
}
