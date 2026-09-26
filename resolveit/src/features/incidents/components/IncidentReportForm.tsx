"use client";

import { useState } from "react";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "../types";
import type { IncidentCategory, IncidentUrgency } from "../types";
import { categoryLabels } from "../labels";
import { IncidentApiError, submitIncident, type IncidentSubmissionResult } from "../client";
import { SubmissionOutcome } from "./SubmissionOutcome";

type FormValues = {
  title: string;
  description: string;
  category: IncidentCategory | "";
  affectedUsers: string;
  businessImpact: string;
  urgency: IncidentUrgency | "";
  affectedSystem: string;
  startedAt: string;
  currentlyAffected: "" | "yes" | "no";
  symptoms: string;
  errorMessages: string;
  troubleshootingAttempted: string;
  additionalContext: string;
};

const initialValues: FormValues = {
  title: "",
  description: "",
  category: "",
  affectedUsers: "1",
  businessImpact: "",
  urgency: "",
  affectedSystem: "",
  startedAt: "",
  currentlyAffected: "",
  symptoms: "",
  errorMessages: "",
  troubleshootingAttempted: "",
  additionalContext: "",
};

const urgencyHelp: Record<IncidentUrgency, string> = {
  LOW: "Low — inconvenient, I can keep working",
  MEDIUM: "Medium — slowing me down",
  HIGH: "High — I can't do important work",
  CRITICAL: "Critical — work is stopped for many people, or security/data is at risk",
};

function lines(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function optional(value: string) {
  return value.trim() || null;
}

/** Client-side checks mirror the server's rules so employees get instant feedback. */
function validate(values: FormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (values.title.trim().length < 5) errors.title = "Enter at least 5 characters.";
  if (!values.category) errors.category = "Choose a category.";
  const affected = Number(values.affectedUsers);
  if (!Number.isInteger(affected) || affected < 1) errors.affectedUsers = "Enter a whole number of 1 or more.";
  if (!values.urgency) errors.urgency = "Choose how urgent this is.";
  if (values.description.trim().length < 10) errors.description = "Add a little more detail (at least 10 characters).";
  if (values.businessImpact.trim().length < 3) errors.businessImpact = "Describe how work is affected.";
  return errors;
}

export function IncidentReportForm() {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [requestError, setRequestError] = useState("");
  const [result, setResult] = useState<IncidentSubmissionResult | null>(null);
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

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setRequestError("Please correct the highlighted fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      setResult(await submitIncident({
        title: values.title,
        description: values.description,
        category: values.category,
        affectedUsers: Number(values.affectedUsers),
        businessImpact: values.businessImpact,
        urgency: values.urgency,
        source: "manual",
        affectedSystem: optional(values.affectedSystem),
        startedAt: optional(values.startedAt),
        currentlyAffected: values.currentlyAffected === "" ? null : values.currentlyAffected === "yes",
        symptoms: optional(values.symptoms),
        errorMessages: lines(values.errorMessages),
        troubleshootingAttempted: lines(values.troubleshootingAttempted),
        additionalContext: optional(values.additionalContext),
      }));
    } catch (error) {
      if (error instanceof IncidentApiError) {
        if (error.details) {
          setFieldErrors(Object.fromEntries(error.details.map(({ field, message }) => [field, message])));
        }
        setRequestError(error.status === 401 ? "Your session has expired. Sign in again to submit." : error.message);
      } else {
        setRequestError("We couldn’t reach the incident service. Check your connection and try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (result) {
    return (
      <SubmissionOutcome
        result={result}
        source="manual"
        onReportAnother={() => { setResult(null); setValues(initialValues); }}
      />
    );
  }

  const errorProps = (field: string) => ({
    "aria-invalid": Boolean(fieldErrors[field]),
    "aria-describedby": fieldErrors[field] ? `${field}-error` : undefined,
  });
  const errorFor = (field: string) =>
    fieldErrors[field] && <span className="field-error" id={`${field}-error`}>{fieldErrors[field]}</span>;

  return (
    <section className="report-form-card" aria-labelledby="form-heading">
      <div className="form-card-header"><span className="form-step">01 <span className="step-line" /> WHAT HAPPENED</span><span className="required-note"><span aria-hidden="true">*</span> Required</span></div>
      <h2 id="form-heading">What’s going on?</h2>
      <p className="form-description">Describe the problem and how it’s affecting your work. Your ticket is created as soon as you submit.</p>

      <form className="incident-form" onSubmit={submit} noValidate>
        <label className="field-label" htmlFor="incident-title">Short title <span>*</span></label>
        <input className="text-input" id="incident-title" value={values.title} onChange={(event) => update("title", event.target.value)} placeholder="e.g. I can’t connect to the office Wi-Fi" maxLength={160} {...errorProps("title")} />
        {errorFor("title")}

        <div className="form-field-row">
          <div className="form-field">
            <label className="field-label" htmlFor="incident-category">Category <span>*</span></label>
            <div className="select-wrap"><select className="text-input select-input" id="incident-category" value={values.category} onChange={(event) => update("category", event.target.value as IncidentCategory | "")} required {...errorProps("category")}><option value="">Select a category</option>{INCIDENT_CATEGORIES.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>
            {errorFor("category")}
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="incident-urgency">How urgent is it? <span>*</span></label>
            <div className="select-wrap"><select className="text-input select-input" id="incident-urgency" value={values.urgency} onChange={(event) => update("urgency", event.target.value as IncidentUrgency | "")} required {...errorProps("urgency")}><option value="">Select urgency</option>{INCIDENT_URGENCIES.map((urgency) => <option value={urgency} key={urgency}>{urgencyHelp[urgency]}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>
            {errorFor("urgency")}
          </div>
        </div>

        <label className="field-label" htmlFor="incident-description">Describe the problem <span>*</span></label>
        <textarea className="text-input description-input" id="incident-description" value={values.description} onChange={(event) => update("description", event.target.value)} placeholder="What were you trying to do? What happened instead?" rows={4} maxLength={5000} {...errorProps("description")} />
        {errorFor("description")}

        <div className="form-field-row">
          <div className="form-field">
            <label className="field-label" htmlFor="affected-users">People affected <span>*</span></label>
            <input className="text-input" id="affected-users" type="number" min="1" max="100000" step="1" value={values.affectedUsers} onChange={(event) => update("affectedUsers", event.target.value)} {...errorProps("affectedUsers")} />
            {errorFor("affectedUsers")}
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="affected-system">Affected system or app</label>
            <input className="text-input" id="affected-system" value={values.affectedSystem} onChange={(event) => update("affectedSystem", event.target.value)} placeholder="e.g. Outlook, VPN, my laptop" maxLength={200} />
          </div>
        </div>

        <label className="field-label" htmlFor="business-impact">How is your work affected? <span>*</span></label>
        <textarea className="text-input impact-input" id="business-impact" value={values.businessImpact} onChange={(event) => update("businessImpact", event.target.value)} placeholder="For example, which work or team is blocked?" rows={3} maxLength={2000} {...errorProps("businessImpact")} />
        {errorFor("businessImpact")}

        <div className="form-divider" />
        <div className="form-step form-section-label">02 <span className="step-line" /> MORE DETAILS (OPTIONAL)</div>

        <div className="form-field-row">
          <div className="form-field">
            <label className="field-label" htmlFor="started-at">When did it start?</label>
            <input className="text-input" id="started-at" value={values.startedAt} onChange={(event) => update("startedAt", event.target.value)} placeholder="e.g. This morning around 9am" maxLength={100} />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="currently-affected">Is it still happening?</label>
            <div className="select-wrap"><select className="text-input select-input" id="currently-affected" value={values.currentlyAffected} onChange={(event) => update("currentlyAffected", event.target.value as FormValues["currentlyAffected"])}><option value="">Not sure</option><option value="yes">Yes, still happening</option><option value="no">No, it stopped</option></select><span className="select-chevron" aria-hidden="true">⌄</span></div>
          </div>
        </div>

        <label className="field-label" htmlFor="symptoms">What do you see? (symptoms)</label>
        <textarea className="text-input impact-input" id="symptoms" value={values.symptoms} onChange={(event) => update("symptoms", event.target.value)} placeholder="e.g. The page loads forever, then shows a blank screen" rows={2} maxLength={5000} />

        <label className="field-label" htmlFor="error-messages">Error messages</label>
        <textarea className="text-input impact-input" id="error-messages" value={values.errorMessages} onChange={(event) => update("errorMessages", event.target.value)} placeholder="Copy the exact text. One message per line." rows={2} {...errorProps("errorMessages")} />
        {errorFor("errorMessages")}

        <label className="field-label" htmlFor="troubleshooting">What have you already tried?</label>
        <textarea className="text-input impact-input" id="troubleshooting" value={values.troubleshootingAttempted} onChange={(event) => update("troubleshootingAttempted", event.target.value)} placeholder="e.g. Restarted my laptop. One step per line." rows={2} {...errorProps("troubleshootingAttempted")} />
        {errorFor("troubleshootingAttempted")}

        <label className="field-label" htmlFor="additional-context">Anything else IT should know?</label>
        <textarea className="text-input impact-input" id="additional-context" value={values.additionalContext} onChange={(event) => update("additionalContext", event.target.value)} placeholder="e.g. Deadline today, working from home, recently changed password" rows={2} maxLength={5000} />

        <div className="form-divider" />
        {requestError && <div className="form-error" role="alert"><span aria-hidden="true">!</span><p>{requestError}</p></div>}
        <button className="button button-submit button-submit-active" type="submit" disabled={isSubmitting}>{isSubmitting ? <><span className="loading-spinner" aria-hidden="true" /> Creating your ticket…</> : <>Submit <span aria-hidden="true">→</span></>}</button>
        <p className="privacy-note">Don’t include passwords or security codes. Your report is only visible to you and your IT team.</p>
      </form>
    </section>
  );
}
