import Link from "next/link";
import { Sidebar } from "@/components/navigation/Sidebar";
import { IncidentReportingExperience } from "@/features/incidents/components/IncidentReportingExperience";

export const dynamic = "force-dynamic";

export default function NewIncidentPage() {
  return (
    <div className="app-shell app-shell-light">
      <Sidebar active="report" theme="light" />
      <main className="main-content report-content">
        <header className="topbar report-topbar">
          <div className="breadcrumb"><Link href="/">Workspace</Link><span className="crumb-divider">/</span><strong>Report an issue</strong></div>
          <div className="topbar-right"><span className="today-label">IT SUPPORT</span><div className="topbar-avatar light-avatar">R</div></div>
        </header>

        <div className="report-layout">
          <div className="report-heading">
            <Link href="/" className="back-link"><span aria-hidden="true">←</span> Back to overview</Link>
            <div className="eyebrow report-eyebrow"><span className="eyebrow-line" /> EMPLOYEE SUPPORT</div>
            <h1>Let’s get this<br /><span>sorted out.</span></h1>
            <p className="report-intro">A few details help your IT team understand what’s happening and what you need.</p>
            <div className="report-assurance"><span className="assurance-icon" aria-hidden="true">↗</span><span><strong>Your IT team is here to help.</strong><br />Share only the details that are relevant to your issue.</span></div>
          </div>

          <IncidentReportingExperience
            voiceConfigured={Boolean(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY && process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID)}
            vapiPublicKey={process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY}
            vapiAssistantId={process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID}
          />
        </div>
      </main>
    </div>
  );
}
