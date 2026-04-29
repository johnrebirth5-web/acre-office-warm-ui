"use client";

import { useEffect, useState } from "react";
import { Button } from "@acre/ui";
import { useI18n } from "../../lib/i18n/client";

type LoginFormProps = {
  errorMessage: string;
  nextPath?: string | null;
};

export function LoginForm({ errorMessage, nextPath }: LoginFormProps) {
  const { t } = useI18n();
  const [workEmail, setWorkEmail] = useState("");
  const [workPassword, setWorkPassword] = useState("");
  const [manualEntryEnabled, setManualEntryEnabled] = useState(false);

  useEffect(() => {
    setWorkEmail("");
    setWorkPassword("");
    setManualEntryEnabled(false);
  }, [errorMessage]);

  function enableManualEntry() {
    if (!manualEntryEnabled) {
      setManualEntryEnabled(true);
    }
  }

  return (
    <form action="/api/auth/login" autoComplete={manualEntryEnabled ? "on" : "off"} className="auth-form" method="post">
      {nextPath ? <input name="next" type="hidden" value={nextPath} /> : null}
      <label className="auth-field">
        <span>{t((messages) => messages.auth.workEmail)}</span>
        <input
          autoCapitalize="none"
          autoComplete={manualEntryEnabled ? "username" : "off"}
          inputMode="email"
          name="workEmail"
          onChange={(event) => setWorkEmail(event.target.value)}
          onFocus={enableManualEntry}
          onPointerDown={enableManualEntry}
          readOnly={!manualEntryEnabled}
          spellCheck="false"
          type="email"
          value={workEmail}
        />
      </label>

      <label className="auth-field">
        <span>{t((messages) => messages.auth.password)}</span>
        <input
          autoComplete={manualEntryEnabled ? "current-password" : "off"}
          name="workPassword"
          onChange={(event) => setWorkPassword(event.target.value)}
          onFocus={enableManualEntry}
          onPointerDown={enableManualEntry}
          readOnly={!manualEntryEnabled}
          type="password"
          value={workPassword}
        />
      </label>

      {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

      <div className="auth-actions">
        <Button className="auth-submit" type="submit">
          {t((messages) => messages.auth.logIn)}
        </Button>
      </div>
    </form>
  );
}
