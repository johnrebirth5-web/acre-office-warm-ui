import { getDefaultAppPath } from "@acre/auth";
import { getMinimumPasswordLength } from "@acre/db";
import { Button } from "@acre/ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getCurrentSessionContext,
  mustChangePassword,
} from "../../lib/auth-session";
import { getServerI18n } from "../../lib/i18n/server";
import { LocaleSwitcher } from "../_components/locale-switcher";

type ChangePasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(
  error: string | undefined,
  t: Awaited<ReturnType<typeof getServerI18n>>["t"],
) {
  switch (error) {
    case "mismatch":
      return t((messages) => messages.auth.errorMismatch);
    case "current_password":
      return t((messages) => messages.auth.errorCurrentPassword);
    case "password_length":
      return t((messages) => messages.auth.errorPasswordLength, {
        min: getMinimumPasswordLength(),
      });
    case "missing_password":
      return t((messages) => messages.auth.errorMissingPassword);
    default:
      return error ? t((messages) => messages.auth.errorUnknown) : "";
  }
}

function formatDateTimeLabel(
  value: Date | null | undefined,
  formatDateTime: Awaited<ReturnType<typeof getServerI18n>>["formatDateTime"],
) {
  if (!value) {
    return "";
  }

  return formatDateTime(value);
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
  const { t, formatDateTime } = await getServerI18n({
    userLocale: context.currentUser.locale,
  });
  const forced = mustChangePassword(context);
  const credential = context.currentCredential;
  const isLocked = Boolean(
    credential?.lockedUntil && credential.lockedUntil > new Date(),
  );
  const passwordStatusLabel = forced
    ? t((messages) => messages.auth.statusPasswordChangeRequired)
    : isLocked
      ? t((messages) => messages.auth.statusTemporarilyLocked)
      : t((messages) => messages.auth.statusPasswordSet);
  const passwordStatusDescription = forced
    ? t((messages) => messages.auth.forcedDescription)
    : isLocked
      ? t((messages) => messages.auth.lockedDescription)
      : t((messages) => messages.auth.regularDescription);
  const passwordChangedAtLabel =
    formatDateTimeLabel(credential?.passwordChangedAt, formatDateTime) ||
    t((messages) => messages.common.notRecordedYet);
  const lastLoginAtLabel =
    formatDateTimeLabel(credential?.lastLoginAt, formatDateTime) ||
    t((messages) => messages.common.noSuccessfulSignInRecorded);
  const lastFailedLoginAtLabel =
    formatDateTimeLabel(credential?.lastFailedLoginAt, formatDateTime) ||
    t((messages) => messages.common.noFailedSignInsRecorded);
  const lockedUntilLabel = isLocked
    ? formatDateTimeLabel(credential?.lockedUntil, formatDateTime) ||
      t((messages) => messages.auth.statusTemporarilyLocked)
    : t((messages) => messages.common.notLocked);

  if (!forced && !context.currentCredential) {
    redirect(getDefaultAppPath(context.currentMembership));
  }

  return (
    <main className="auth-shell">
      <section className="auth-layout">
        <section className="auth-card">
          <div className="auth-locale-switcher-row">
            <LocaleSwitcher authenticated className="auth-locale-switcher" />
          </div>
          <div className="auth-card-copy">
            <span className="auth-eyebrow">
              {t((messages) => messages.auth.accountSecurity)}
            </span>
            <h2>
              {forced
                ? t((messages) => messages.auth.changePasswordRequiredTitle)
                : t((messages) => messages.auth.changePasswordTitle)}
            </h2>
            <p>
              {forced
                ? t((messages) => messages.auth.changePasswordRequiredLead)
                : t((messages) => messages.auth.changePasswordLead)}
            </p>
            <p>{passwordStatusDescription}</p>
            <p>
              {t((messages) => messages.auth.passwordLengthRule, {
                min: getMinimumPasswordLength(),
              })}
            </p>
          </div>

          <div className="office-detail-grid">
            <div className="office-detail-field office-detail-field-wide">
              <span className="office-form-helper">
                {t((messages) => messages.auth.signInEmail)}
              </span>
              <strong>{context.currentUser.email}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                {t((messages) => messages.auth.currentStatus)}
              </span>
              <strong>{passwordStatusLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                {t((messages) => messages.auth.passwordLastChanged)}
              </span>
              <strong>{passwordChangedAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                {t((messages) => messages.auth.lastSuccessfulSignIn)}
              </span>
              <strong>{lastLoginAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                {t((messages) => messages.auth.lastFailedSignIn)}
              </span>
              <strong>{lastFailedLoginAtLabel}</strong>
            </div>
            <div className="office-detail-field">
              <span className="office-form-helper">
                {t((messages) => messages.auth.lockUntil)}
              </span>
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
                {t((messages) => messages.auth.currentPasswordNotRequired)}
              </p>
            ) : null}

            {!forced ? (
              <label className="auth-field">
                <span>{t((messages) => messages.auth.currentPassword)}</span>
                <input
                  autoComplete="current-password"
                  name="currentPassword"
                  type="password"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>{t((messages) => messages.auth.newPassword)}</span>
              <input
                autoComplete="new-password"
                name="newPassword"
                type="password"
              />
            </label>

            <label className="auth-field">
              <span>{t((messages) => messages.auth.confirmNewPassword)}</span>
              <input
                autoComplete="new-password"
                name="confirmPassword"
                type="password"
              />
            </label>

            {params?.error ? (
              <p className="auth-error">{getErrorMessage(params.error, t)}</p>
            ) : null}

            <div className="auth-actions">
              <Button className="auth-submit" type="submit">
                {t((messages) => messages.auth.savePassword)}
              </Button>
            </div>
          </form>

          {!forced ? (
            <div className="auth-actions">
              <Link
                className="office-button-secondary office-button-sm"
                href="/office/account"
              >
                {t((messages) => messages.auth.backToMyProfile)}
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  className="office-button-secondary office-button-sm"
                  type="submit"
                >
                  {t((messages) => messages.auth.signOut)}
                </button>
              </form>
            </div>
          ) : null}

          <p>
            {t((messages) => messages.auth.noResetFlow)}
          </p>
        </section>
      </section>
    </main>
  );
}
