"use client";

import { useState, type FormEvent } from "react";

type FieldErrors = { email?: string; password?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!email.trim()) errors.email = "Enter your email address.";
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = "Enter a valid email address, like name@company.com.";
  if (!password) errors.password = "Enter your password.";
  return errors;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const errors = validate(email, password);
    setFieldErrors(errors);
    if (errors.email || errors.password) return;

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json().catch(() => null) as
        | { success: true; data: { role: "EMPLOYEE" | "IT_ADMIN" } }
        | { success: false; error?: { message?: string } }
        | null;

      if (!response.ok || !result?.success) {
        setError(
          response.status === 401
            ? "That email and password don’t match. Check them and try again."
            : (result && !result.success && result.error?.message) || "Sign-in is temporarily unavailable. Please try again.",
        );
        setPassword("");
        return;
      }

      window.location.assign(result.data.role === "IT_ADMIN" ? "/" : "/my-incidents");
    } catch {
      setError("We couldn’t connect to ResolveIT. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    // method="post": if JavaScript fails to load, the browser must never put credentials in the URL.
    <form className="login-form" method="post" onSubmit={handleSubmit} noValidate>
      <div className="login-field">
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          placeholder="you@company.com"
          value={email}
          onChange={(event) => { setEmail(event.target.value); setFieldErrors((current) => ({ ...current, email: undefined })); }}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          disabled={loading}
          autoFocus
        />
        {fieldErrors.email && <span className="login-field-error" id="email-error">{fieldErrors.email}</span>}
      </div>

      <div className="login-field">
        <label htmlFor="password">Password</label>
        <div className="password-wrap">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) => { setPassword(event.target.value); setFieldErrors((current) => ({ ...current, password: undefined })); }}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            disabled={loading}
          />
          <button
            type="button"
            className="password-toggle"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
        {fieldErrors.password && <span className="login-field-error" id="password-error">{fieldErrors.password}</span>}
      </div>

      {error && (
        <div className="login-error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      <button className="button button-primary login-button" type="submit" disabled={loading}>
        {loading ? <><span className="loading-spinner" aria-hidden="true" /> Signing in…</> : <>Sign in <span aria-hidden="true">→</span></>}
      </button>
    </form>
  );
}
