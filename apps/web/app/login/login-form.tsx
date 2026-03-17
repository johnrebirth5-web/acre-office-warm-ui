"use client";

import { Button } from "@acre/ui";

type LoginFormProps = {
  errorMessage: string;
};

export function LoginForm({ errorMessage }: LoginFormProps) {
  return (
    <form action="/api/auth/login" autoComplete="on" className="auth-form" method="post">
      <label className="auth-field">
        <span>Work email</span>
        <input
          autoCapitalize="none"
          autoComplete="username"
          name="email"
          spellCheck="false"
          type="email"
        />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          autoComplete="current-password"
          name="password"
          type="password"
        />
      </label>

      {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}

      <div className="auth-actions">
        <Button className="auth-submit" type="submit">
          Log in
        </Button>
      </div>
    </form>
  );
}
