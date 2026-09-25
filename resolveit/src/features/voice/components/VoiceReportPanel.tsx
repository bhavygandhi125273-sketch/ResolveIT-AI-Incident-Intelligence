"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreateIncidentSchema } from "@/features/incidents/validation";
import { IncidentApiError } from "@/features/incidents/client";
import type { IncidentSubmissionResult } from "@/features/incidents/client";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "@/features/incidents/types";
import type { IncidentCategory, IncidentUrgency } from "@/features/incidents/types";
import { VoiceIncidentDraftSchema, VoiceIncidentSubmissionSchema } from "../schema";
import { IncompleteVoiceDraftError, submitVoiceIncidentDraft } from "../submission";
import type { VoiceIncidentDraft } from "../schema";
import { VapiVoiceProvider } from "../providers/vapi";
import type { VoiceConnectionState, VoiceTranscriptEntry } from "../providers/types";

const categoryLabels: Record<IncidentCategory, string> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS: "Software & applications",
  EMAIL_COLLABORATION: "Email & collaboration",
  OTHER: "Other",
};

type TranscriptLine = VoiceTranscriptEntry & { id: number };

function VoiceSession({ configured, publicKey, assistantId }: { configured: boolean; publicKey?: string; assistantId?: string }) {
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [draft, setDraft] = useState<VoiceIncidentDraft | null>(null);
  const [voiceError, setVoiceError] = useState(configured ? "" : "Voice reporting needs a Vapi public API key and assistant ID. You can use Manual Report until these are configured.");
  const [draftMessage, setDraftMessage] = useState("");
  const [reviewErrors, setReviewErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<VoiceConnectionState>("ready");
  const [isStarting, setIsStarting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [created, setCreated] = useState<IncidentSubmissionResult | null>(null);
  const providerRef = useRef<VapiVoiceProvider | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const messageId = useRef(0);
  const startAttempt = useRef(0);

  useEffect(() => () => { void providerRef.current?.stop(); }, []);

  function appendTranscript(entry: VoiceTranscriptEntry) {
    const line = { ...entry, id: ++messageId.current };
    transcriptRef.current = [...transcriptRef.current, line];
    setTranscript(transcriptRef.current);
  }

  function prepareIncident(parameters: unknown) {
    const parsedDraft = VoiceIncidentDraftSchema.safeParse(parameters);
    if (!parsedDraft.success) {
      setDraftMessage("The agent could not prepare an incident draft. Continue the conversation or use the manual report.");
      return;
    }
    const transcriptText = transcriptRef.current.map((line) => (line.role === "assistant" ? "ResolveIT: " : "Employee: ") + line.text).join("\n").slice(0, 12_000);
    const nextDraft = { ...parsedDraft.data, transcript: transcriptText };
    setDraft(nextDraft);
    const issues = CreateIncidentSchema.safeParse(nextDraft);
    if (!issues.success) {
      const missing = [...new Set(issues.error.issues.map((issue) => String(issue.path[0])))];
      setDraftMessage("Please review the draft and provide: " + missing.join(", ") + ". Unknown details remain blank.");
      return;
    }
    setDraftMessage("Review the details below. Nothing is submitted until you confirm it.");
  }

  async function startConversation() {
    if (!configured || !publicKey || !assistantId) {
      setVoiceError("Vapi voice is not configured yet. Use the manual report or ask your administrator to configure the Vapi public key and assistant ID.");
      return;
    }
    setVoiceError("");
    setDraftMessage("");
    setDraft(null);
    setIsStarting(true);
    setState("connecting");
    const attempt = ++startAttempt.current;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires a secure browser connection. Use the manual report if it is unavailable.");
      }
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (attempt !== startAttempt.current) {
        microphone.getTracks().forEach((track) => track.stop());
        return;
      }
      microphone.getTracks().forEach((track) => track.stop());
      setTranscript([]);
      transcriptRef.current = [];
      messageId.current = 0;
      const provider = new VapiVoiceProvider(publicKey, assistantId, {
        onStateChange: setState,
        onTranscript: appendTranscript,
        onIncidentDraft: prepareIncident,
        onError: (error) => {
          setVoiceError(error.message);
          setState("ready");
          void providerRef.current?.stop().catch(() => undefined);
          providerRef.current = null;
        },
      });
      if (attempt !== startAttempt.current) return;
      providerRef.current = provider;
      await provider.start();
    } catch (error) {
      if (attempt !== startAttempt.current) return;
      providerRef.current = null;
      setState("ready");
      if (error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError")) {
        setVoiceError("Microphone permission was denied. Allow microphone access in your browser settings, or use the manual report.");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setVoiceError("No microphone was found. Connect a microphone or use the manual report.");
      } else {
        setVoiceError(error instanceof Error ? error.message : "Voice could not be started. Retry or use the manual report.");
      }
    } finally {
      if (attempt === startAttempt.current) setIsStarting(false);
    }
  }

  async function endConversation() {
    startAttempt.current += 1;
    setIsStarting(false);
    try {
      await providerRef.current?.stop();
    } catch {
      setVoiceError("The conversation could not be ended cleanly. You can still review any prepared incident.");
    } finally {
      providerRef.current = null;
      setState("ready");
    }
  }

  async function submitDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const parsed = VoiceIncidentSubmissionSchema.safeParse(draft);
    if (!parsed.success) {
      setReviewErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setReviewErrors({});
    setDraftMessage("");
    setIsSubmitting(true);
    try {
      setCreated(await submitVoiceIncidentDraft(parsed.data));
    } catch (error) {
      if (error instanceof IncompleteVoiceDraftError) {
        setReviewErrors(Object.fromEntries(error.fields.map((field) => [field, "Please complete this field."])));
      }
      if (error instanceof IncidentApiError && error.details) {
        setReviewErrors(Object.fromEntries(error.details.map((issue) => [issue.field, issue.message])));
      }
      setDraftMessage(error instanceof Error ? error.message : "We could not save this incident. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (created) {
    return (
      <section className="voice-card voice-success" aria-live="polite">
        <div className="success-mark" aria-hidden="true">✓</div>
        <span className="voice-kicker">VOICE REPORT SUBMITTED</span>
        <h2>Your IT team has the details.</h2>
        <p>Your reviewed voice report was validated and saved.</p>
        <div className="success-reference"><span>REFERENCE</span><strong>{created.incident.id.slice(0, 8).toUpperCase()}</strong></div>
        {created.workflow?.decision.action === "OFFER_RESOLUTION" && <div className="workflow-result"><strong>Suggested safe next step</strong><p>{created.workflow.decision.resolution}</p><small>Review this suggestion before trying it. No change was made to your device.</small></div>}
        {created.workflow?.decision.action === "ESCALATE_TO_HUMAN" && <div className="workflow-result"><strong>Immediate human follow-up is required.</strong><p>The external escalation handoff is not configured yet. Contact your IT support team directly.</p></div>}
        {created.workflow?.investigation.status === "complete" && (created.workflow.decision.action === "CREATE_TICKET" || created.workflow.decision.action === "CREATE_PRIORITIZED_TICKET") && <div className="workflow-result"><strong>IT follow-up is required.</strong><p>The ticketing integration is not configured yet. Your incident was saved for review.</p></div>}
        {created.workflow?.investigation.status === "not_configured" && <div className="workflow-result"><strong>AI investigation is not configured.</strong><p>Your report was saved. IT staff will need to review it.</p></div>}
        {created.workflow?.investigation.status === "unavailable" && <div className="workflow-result"><strong>AI investigation could not run.</strong><p>Your report was saved. IT staff will need to review it.</p></div>}
        <Link className="button button-primary" href="/">View dashboard <span aria-hidden="true">→</span></Link>
      </section>
    );
  }

  const inCall = state === "listening" || state === "speaking" || state === "processing";
  const labels: Record<VoiceConnectionState, string> = {
    ready: "Ready when you are",
    connecting: "Connecting to Vapi…",
    listening: "Listening — tell me what’s happening",
    speaking: "ResolveIT is speaking",
    processing: "Preparing the incident summary…",
  };

  return (
    <section className="voice-card" aria-labelledby="voice-heading">
      <div className="voice-card-top"><div className="voice-kicker"><span className="voice-kicker-dot" /> LIVE VOICE INTAKE</div><span className="voice-provider">VAPI VOICE AGENT</span></div>
      <div className={"voice-orb" + (inCall ? " voice-orb-active" : "") + (state === "speaking" ? " voice-orb-speaking" : "")} aria-hidden="true"><span className="voice-orb-inner">{inCall ? "✳" : "◉"}</span></div>
      <h2 id="voice-heading">Talk through the issue.</h2>
      <p className="voice-explainer">ResolveIT will collect the details IT needs, then prepare an incident for you to review.</p>
      <div className={"voice-status" + (inCall ? " voice-status-active" : "")} role="status"><span className="voice-status-dot" />{labels[state]}</div>
      {state === "connecting"
        ? <button className="button voice-end-button" type="button" onClick={endConversation}>Cancel connection <span aria-hidden="true">■</span></button>
        : inCall
          ? <button className="button voice-end-button" type="button" onClick={endConversation}>End call <span aria-hidden="true">■</span></button>
        : <button className="button voice-start-button" type="button" onClick={startConversation} disabled={!configured || isStarting}><span aria-hidden="true">{isStarting ? "◌" : "●"}</span>{!configured ? "Voice setup required" : isStarting ? "Connecting…" : "Start voice report"}</button>}
      <p className="voice-microphone-note">{configured ? "Vapi will request microphone access when the session starts." : "Voice requires a Vapi public API key and assistant ID. Manual reporting remains available."}</p>
      {voiceError && <div className="voice-error" role="alert"><span aria-hidden="true">!</span><p>{voiceError}</p></div>}
      {transcript.length > 0 && <div className="voice-transcript" aria-label="Conversation transcript" aria-live="polite">{transcript.map((line) => <p className={"transcript-line transcript-" + (line.role === "assistant" ? "agent" : "user")} key={line.id}><strong>{line.role === "assistant" ? "ResolveIT" : "You"}</strong><span>{line.text}</span></p>)}</div>}

      {draft && <form className="voice-review" onSubmit={submitDraft}>
        <div className="voice-review-heading"><span className="form-step">INCIDENT SUMMARY</span><span className="review-pill">Review before submitting</span></div>
        <p className="voice-review-intro">Check what the conversation established. Complete required details before submission.</p>
        <label className="field-label" htmlFor="voice-title">Issue title <span>*</span></label>
        <input className="text-input" id="voice-title" value={draft.title ?? ""} onChange={(event) => setDraft({ ...draft, title: event.target.value || null })} aria-invalid={Boolean(reviewErrors.title)} />
        {reviewErrors.title && <span className="field-error">{reviewErrors.title}</span>}
        <label className="field-label" htmlFor="voice-category">Category <span>*</span></label>
        <div className="select-wrap"><select className="text-input select-input" id="voice-category" value={draft.category ?? ""} onChange={(event) => setDraft({ ...draft, category: event.target.value ? event.target.value as IncidentCategory : null })}><option value="">Unknown — please choose</option>{INCIDENT_CATEGORIES.map((category) => <option value={category} key={category}>{categoryLabels[category]}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>
        {reviewErrors.category && <span className="field-error">{reviewErrors.category}</span>}
        <div className="form-field-row"><div className="form-field"><label className="field-label" htmlFor="voice-affected-users">People affected <span>*</span></label><input className="text-input" id="voice-affected-users" type="number" min="1" max="100000" step="1" value={draft.affectedUsers ?? ""} placeholder="Unknown" onChange={(event) => setDraft({ ...draft, affectedUsers: event.target.value ? Number(event.target.value) : null })} aria-invalid={Boolean(reviewErrors.affectedUsers)} />{reviewErrors.affectedUsers && <span className="field-error">{reviewErrors.affectedUsers}</span>}</div>
          <div className="form-field"><label className="field-label" htmlFor="voice-urgency">Urgency <span>*</span></label><div className="select-wrap"><select className="text-input select-input" id="voice-urgency" value={draft.urgency ?? ""} onChange={(event) => setDraft({ ...draft, urgency: event.target.value ? event.target.value as IncidentUrgency : null })}><option value="">Unknown — please choose</option>{INCIDENT_URGENCIES.map((urgency) => <option value={urgency} key={urgency}>{urgency.charAt(0) + urgency.slice(1).toLowerCase()}</option>)}</select><span className="select-chevron" aria-hidden="true">⌄</span></div>{reviewErrors.urgency && <span className="field-error">{reviewErrors.urgency}</span>}</div></div>
        <label className="field-label" htmlFor="voice-description">Issue details <span>*</span></label>
        <textarea className="text-input description-input" id="voice-description" rows={4} value={draft.description ?? ""} onChange={(event) => setDraft({ ...draft, description: event.target.value || null })} aria-invalid={Boolean(reviewErrors.description)} />
        {reviewErrors.description && <span className="field-error">{reviewErrors.description}</span>}
        <label className="field-label" htmlFor="voice-impact">Business impact <span>*</span></label>
        <textarea className="text-input impact-input" id="voice-impact" rows={3} value={draft.businessImpact ?? ""} onChange={(event) => setDraft({ ...draft, businessImpact: event.target.value || null })} aria-invalid={Boolean(reviewErrors.businessImpact)} />
        {reviewErrors.businessImpact && <span className="field-error">{reviewErrors.businessImpact}</span>}
        <label className="field-label" htmlFor="voice-system">Affected application or system</label>
        <input className="text-input" id="voice-system" value={draft.affectedSystem ?? ""} onChange={(event) => setDraft({ ...draft, affectedSystem: event.target.value || null })} />
        <label className="field-label" htmlFor="voice-symptoms">Symptoms</label>
        <textarea className="text-input" id="voice-symptoms" rows={2} value={draft.symptoms ?? ""} onChange={(event) => setDraft({ ...draft, symptoms: event.target.value || null })} />
        <label className="field-label" htmlFor="voice-started">When did it start?</label>
        <input className="text-input" id="voice-started" value={draft.startedAt ?? ""} onChange={(event) => setDraft({ ...draft, startedAt: event.target.value || null })} />
        <label className="field-label" htmlFor="voice-errors">Error messages</label>
        <textarea className="text-input" id="voice-errors" rows={2} value={(draft.errorMessages ?? []).join("\n")} onChange={(event) => setDraft({ ...draft, errorMessages: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        <label className="field-label" htmlFor="voice-troubleshooting">Troubleshooting already tried</label>
        <textarea className="text-input" id="voice-troubleshooting" rows={2} value={(draft.troubleshootingAttempted ?? []).join("\n")} onChange={(event) => setDraft({ ...draft, troubleshootingAttempted: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} />
        {draftMessage && <div className="voice-review-note" role="status">{draftMessage}</div>}
        <button className="button button-submit button-submit-active" type="submit" disabled={isSubmitting}>{isSubmitting ? "Submitting…" : "Confirm and submit incident"}<span aria-hidden="true">→</span></button>
      </form>}
    </section>
  );
}

export function VoiceReportPanel({ configured, publicKey, assistantId }: { configured: boolean; publicKey?: string; assistantId?: string }) {
  return <VoiceSession configured={configured} publicKey={publicKey} assistantId={assistantId} />;
}
