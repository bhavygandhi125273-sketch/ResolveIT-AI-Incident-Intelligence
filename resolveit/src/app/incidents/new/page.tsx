import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/navigation/Sidebar";
import { Topbar } from "@/components/navigation/Topbar";
import { IncidentReportingExperience } from "@/features/incidents/components/IncidentReportingExperience";
import { getCurrentUser } from "@/server/auth/session";
import { serverEnv } from "@/server/config/env";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({ searchParams }: PageProps<"/incidents/new">) {
  const { mode } = await searchParams;
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const isIt = user.role === "IT_ADMIN";
  const backHref = isIt ? "/" : "/my-incidents";
  const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
  const assistantId = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;

  return (
    <div className="app-shell app-shell-light">
      <Sidebar user={user} active="report" theme="light" />

      <main className="main-content report-content">
        <Topbar
          light
          crumbs={[{ label: isIt ? "Incident queue" : "My tickets", href: backHref }, { label: "Report a problem" }]}
          label={isIt ? "IT SUPPORT" : "EMPLOYEE SUPPORT"}
          initial={user.displayName.charAt(0).toUpperCase()}
        />

        <div className="report-layout">
          <div className="report-heading">
            <Link href={backHref} className="back-link">
              <span aria-hidden="true">←</span> {isIt ? "Back to the queue" : "Back to my tickets"}
            </Link>

            <div className="eyebrow report-eyebrow"><span className="eyebrow-line" />REPORT A PROBLEM</div>

            <h1>Let’s get this<br /><span>sorted out.</span></h1>

            <p className="report-intro">
              Talk to the AI assistant or fill in the form. Either way, a ticket is created for your IT team automatically.
            </p>

            <div className="report-assurance">
              <span className="assurance-icon" aria-hidden="true">↗</span>
              <span>
                <strong>Urgent problem?</strong>
                <br />
                Critical issues are sent straight to IT support.
                {serverEnv.resolveItAiPhoneNumber && <> Away from your computer? Call the ResolveIT AI line at <strong>{serverEnv.resolveItAiPhoneNumber}</strong>.</>}
              </span>
            </div>
          </div>

          <IncidentReportingExperience
            initialMode={mode === "manual" || mode === "voice" ? mode : undefined}
            voiceConfigured={Boolean(publicKey && assistantId)}
            vapiPublicKey={publicKey}
            vapiAssistantId={assistantId}
          />
        </div>
      </main>
    </div>
  );
}
