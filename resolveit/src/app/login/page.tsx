"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(
          result?.error?.message ||
            "Invalid email or password.",
        );
        return;
      }

      window.location.href =
        result.data.role === "IT_ADMIN"
          ? "/"
          : "/my-incidents";
    } catch {
      setError(
        "We couldn't connect to ResolveIT. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path
                d="M18.7 3.5 7.2 17h7.4l-1.3 11.5L25 15h-7.6l1.3-11.5Z"
                fill="currentColor"
              />
            </svg>
          </span>

          <span className="brand-name">
            resolve<span>it</span>
          </span>
        </div>

        <div className="login-heading">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            SECURE ACCESS
          </div>

          <h1>Welcome back.</h1>

          <p>
            Sign in to report incidents and track your IT
            support requests.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label htmlFor="email">
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
          />

          <label htmlFor="password">
            Password
          </label>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
          />

          {error && (
            <div
              className="login-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            className="button button-primary login-button"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
            {!loading && (
              <span aria-hidden="true">→</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <span>ResolveIT</span>
          <span>Incident intelligence for IT support</span>
        </div>
      </div>
    </main>
  );
}