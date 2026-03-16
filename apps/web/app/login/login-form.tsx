"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@acre/ui";

type LoginFormProps = {
  errorMessage: string;
};

export function LoginForm({ errorMessage }: LoginFormProps) {
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const [emailReadOnly, setEmailReadOnly] = useState(true);
  const [passwordReadOnly, setPasswordReadOnly] = useState(true);

  useEffect(() => {
    const clearFields = () => {
      if (emailRef.current) {
        emailRef.current.value = "";
      }

      if (passwordRef.current) {
        passwordRef.current.value = "";
      }
    };

    clearFields();

    const handlePageShow = () => {
      clearFields();
      setEmailReadOnly(true);
      setPasswordReadOnly(true);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return (
    <form action="/api/auth/login" autoComplete="off" className="auth-form" method="post">
      <input autoComplete="off" name="fake-username" style={{ display: "none" }} tabIndex={-1} type="text" />
      <input autoComplete="off" name="fake-password" style={{ display: "none" }} tabIndex={-1} type="password" />

      <label className="auth-field">
        <span>Work email</span>
        <input
          ref={emailRef}
          autoCapitalize="none"
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          name="workEmail"
          onFocus={() => setEmailReadOnly(false)}
          readOnly={emailReadOnly}
          spellCheck="false"
          type="email"
        />
      </label>

      <label className="auth-field">
        <span>Password</span>
        <input
          ref={passwordRef}
          autoComplete="off"
          data-1p-ignore
          data-lpignore="true"
          name="workPassword"
          onFocus={() => setPasswordReadOnly(false)}
          readOnly={passwordReadOnly}
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
