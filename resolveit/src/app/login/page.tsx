import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/features/auth/LoginForm";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in — ResolveIT",
};

export default async function LoginPage() {
  const user = await getCurrentUser();

  // Signed-in users go straight to their workspace.
  if (user) {
    redirect(user.role === "IT_ADMIN" ? "/" : "/my-incidents");
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-hidden="true">
        <div className="brand login-brand">
          <span className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M18.7 3.5 7.2 17h7.4l-1.3 11.5L25 15h-7.6l1.3-11.5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-name">resolve<span>it</span></span>
        </div>
        <div className="login-pitch">
          <h2>IT help, without the runaround.</h2>
          <p>Report a problem by talking to the AI assistant or filling in a short form. Follow every ticket until it is resolved.</p>
        </div>
        <ul className="login-points">
          <li><span>◉</span> Talk to AI or report manually</li>
          <li><span>✳</span> AI investigation on every ticket</li>
          <li><span>↗</span> Urgent issues go straight to IT</li>
        </ul>
      </section>

      <section className="login-card" aria-labelledby="login-heading">
        <div className="brand login-brand-compact">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M18.7 3.5 7.2 17h7.4l-1.3 11.5L25 15h-7.6l1.3-11.5Z" fill="currentColor" />
            </svg>
          </span>
          <span className="brand-name">resolve<span>it</span></span>
        </div>
        <h1 id="login-heading">Sign in</h1>
        <p className="login-subtitle">Use your work account to report problems and track your tickets.</p>
        <LoginForm />
        <p className="login-help">Trouble signing in? Contact your IT support team.</p>
      </section>
    </main>
  );
}
