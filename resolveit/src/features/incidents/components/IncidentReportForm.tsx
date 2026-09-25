"use client";

import { useState } from "react";
import Link from "next/link";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "../types";
import type { Incident, IncidentCategory, IncidentUrgency } from "../types";
import type { IncidentWorkflow } from "@/features/decisions/engine";

type FormValues = {
  title: string;
  description: string;
  category: IncidentCategory | "";
  affectedUsers: string;
  businessImpact: string;
  urgency: IncidentUrgency | "";
};

type ApiResult = { success: true; data: Incident } | {
  success: false;
  error: { code: string; message: string; details?: Array<{ field: string; message: string }> };
};
type IntakeApiResult = ApiResult | ({ success: true; data: Incident; workflow?: IncidentWorkflow });

const initialValues: FormValues = {
  title: "",
  description: "",
  category: "",
  affectedUsers: "1",
  businessImpact: "",
  urgency: "",
};

const categoryLabels: Record<IncidentCategory, string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

export function IncidentReportForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const [createdIncident, setCreatedIncident] = useState<Incident | null>(null);
  const [workflow, setWorkflow] = useState<IncidentWorkflow | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/incidents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...values, affectedUsers: Number(values.affectedUsers) }),
      });
      const result = await response.json() as IntakeApiResult;

      if (!response.ok || !result.success) {
        if (!result.success && result.error.details) {
          setFieldErrors(Object.fromEntries(result.error.details.map(({ field, message }) => [field, message])));
        }
        setRequestError(result.success ? "We could not save your incident. Please try again." : result.error.message);
        return;
      }

      setCreatedIncident(result.data);
      setWorkflow("workflow" in result ? result.workflow : undefined);
    } catch {
      setRequestError("We couldn’t reach the incident service. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (createdIncident) {
    return (
      <section className="report-form-card success-card" aria-live="polite" aria-labelledby="success-heading">
        <div className="success-mark" aria-hidden="true">✓</div>
        <div className="form-step">INCIDENT RECEIVED</div>
        <h2 id="success-heading">Your IT team has the details.</h2>
        <p className="form-description">Your report was saved successfully. You can find it on the workspace dashboard.</p>
        <div className="success-reference"><span>REFERENCE</span><strong>{createdIncident.id.slice(0, 8).toUpperCase()}</strong></div>
        {workflow?.decision.action === "OFFER_RESOLUTION" && <div className="workflow-result"><strong>Suggested safe next step</strong><p>{workflow.decision.resolution}</p><small>Review this suggestion before trying it. No change was made to your device.</small></div>}
        {workflow?.decision.action === "ESCALATE_TO_HUMAN" && <div className="workflow-result"><strong>Immediate human follow-up is required.</strong><p>The external escalation handoff is not configured yet. Contact your IT support team directly.</p></div>}
        {workflow?.investigation.status === "complete" && (workflow.decision.action === "CREATE_TICKET" || workflow.decision.action === "CREATE_PRIORITIZED_TICKET") && <div className="workflow-result"><strong>IT follow-up is required.</strong><p>The ticketing integration is not configured yet. Your incident was saved for review.</p></div>}
        {workflow?.investigation.status === "not_configured" && <div className="workflow-result"><strong>AI investigation is not configured.</strong><p>Your report was saved. IT staff will need to review it.</p></div>}
        {workflow?.investigation.status === "unavailable" && <div className="workflow-result"><strong>AI investigation could not run.</strong><p>Your report was saved. IT staff will need to review it.</p></div>}
        <div className="success-actions"><Link className="button button-primary" href="/">View dashboard <span aria-hidden="true">→</span></Link><button className="text-button" type="button" onClick={() => { setCreatedIncident(null); setWorkflow(undefined); setValues(initialValues); }}>Report another issue</button></div>
      </section>
    );
  }

  return (
    <section className="report-form-card" aria-labelledby="form-heading">
      <div className="form-card-header"><span className="form-step">01 <span className="step-line" /> INCIDENT DETAILS</span><span className="required-note"><span aria-hidden="true">*</span> Required</span></div>
      <h2 id="form-heading">What’s going on?</h2>
      <p className="form-description">Describe the issue and how it’s affecting your work.</p>

      <form className="incident-form" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="incident-title">Give your issue a short title <span>*</span></label>
        <input className="text-input" id="incident-title" name="title" value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. I can’t connect to the office Wi-Fi" required aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? "title-error" : undefined} />
        {fieldErrors.title && <span className="field-error" id="title-error">{fieldErrors.title}</span>}

        <label className="field-label" htmlFor="incident-category">What is this about? <span>*</span></label>
        <div className="select-wrap"><select className="text-input select-input" id="incident-category" name="category" value={values.category} onChange={(event) => update("category", event.target.value as IncidentCategory | "")} required aria-invalid={Boolean(fieldErrors.category)} aria-describedby={fieldErrors.category ? "category-error" : undefined}><option value="">Select a category</option>{INCIDENT_CATEGORIES.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>
        {fieldErrors.category && <span className="field-error" id="category-error">{fieldErrors.category}</span>}

        <div className="form-field-row">
          <div className="form-field"><label className="field-label" htmlFor="affected-users">People affected <span>*</span></label><input className="text-input" id="affected-users" name="affectedUsers" type="number" min="1" max="100000" step="1" value={values.affectedUsers} onChange={(event) => update("affectedUsers", event.target.value)} required aria-invalid={Boolean(fieldErrors.affectedUsers)} aria-describedby={fieldErrors.affectedUsers ? "affected-users-error" : undefined} />{fieldErrors.affectedUsers && <span className="field-error" id="affected-users-error">{fieldErrors.affectedUsers}</span>}</div>
          <div className="form-field"><label className="field-label" htmlFor="incident-urgency">How urgent is it? <span>*</span></label><div className="select-wrap"><select className="text-input select-input" id="incident-urgency" name="urgency" value={values.urgency} onChange={(event) => update("urgency", event.target.value as IncidentUrgency | "")} required aria-invalid={Boolean(fieldErrors.urgency)} aria-describedby={fieldErrors.urgency ? "urgency-error" : undefined}><option value="">Select urgency</option>{INCIDENT_URGENCIES.map((urgency) => <option value={urgency} key={urgency}>{urgency.charAt(0) + urgency.slice(1).toLowerCase()}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>{fieldErrors.urgency && <span className="field-error" id="urgency-error">{fieldErrors.urgency}</span>}</div>
        </div>

        <label className="field-label" htmlFor="incident-description">Tell us a little more <span>*</span></label>
        <textarea className="text-input description-input" id="incident-description" name="description" value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="What were you trying to do? What happened instead? Include any error messages you saw." required rows={4} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error" : undefined} />
        {fieldErrors.description ? <span className="field-error" id="description-error">{fieldErrors.description}</span> : <div className="field-hint">A clear description helps your IT team get started.</div>}

        <label className="field-label" htmlFor="business-impact">How is work affected? <span>*</span></label>
        <textarea className="text-input impact-input" id="business-impact" name="businessImpact" value={values.businessImpact} onChange={(event) => update("businessImpact", event.target.value)} placeholder="For example, which work or team is blocked?" required rows={3} aria-invalid={Boolean(fieldErrors.businessImpact)} aria-describedby={fieldErrors.businessImpact ? "impact-error" : undefined} />
        {fieldErrors.businessImpact && <span className="field-error" id="impact-error">{fieldErrors.businessImpact}</span>}

        <div className="form-divider" />
        {requestError && <div className="form-error" role="alert"><span aria-hidden="true">!</span><p>{requestError}</p></div>}
        <button className="button button-submit button-submit-active" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="loading-spinner" aria-hidden="true" /> Submitting…</> : <>Submit incident <span aria-hidden="true">→</span></>}</button>
        <p className="privacy-note">Your information is only for your organization’s IT support team.</p>
      </form>
    </section>
  );
}
