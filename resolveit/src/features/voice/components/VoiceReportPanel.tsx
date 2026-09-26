"use client";

import { useEffect, useRef, useState } from "react";
import type { IncidentSubmissionResult } from "@/features/incidents/client";
import { SubmissionOutcome } from "@/features/incidents/components/SubmissionOutcome";
import { describeField } from "../agentMessages";
import { VapiVoiceProvider } from "../providers/vapi";
import type { VoiceConnectionState, VoiceTranscriptEntry } from "../providers/types";
import { processIncidentDraft } from "../session";

type TranscriptLine = VoiceTranscriptEntry & { id: number };

type Props = {
  configured: boolean;
  publicKey?: string;
  assistantId?: string;
  onUseManualForm?: () => void;
};

const STATE_LABELS: Record<VoiceConnectionState, string> = {
  ready: "Ready when you are",
  connecting: "Connecting…",
  listening: "Listening — tell me what’s happening",
  speaking: "The assistant is speaking",
  processing: "Creating your ticket…",
};

// If the closing message does not end the call (for example, a dropped connection), end it here.
const HANG_UP_FALLBACK_MS = 30_000;

export function VoiceReportPanel({ configured, publicKey, assistantId, onUseManualForm }: Props) {
  const [state, setState] = useState<VoiceConnectionState>("ready");
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [error, setError] = useState(configured ? "" : "Voice reporting is not set up yet. Please use the manual report.");
  const [notice, setNotice] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [created, setCreated] = useState<IncidentSubmissionResult | null>(null);
  const [failed, setFailed] = useState(false);

  const providerRef = useRef<VapiVoiceProvider | null>(null);
  const transcriptRef = useRef<TranscriptLine[]>([]);
  const lineId = useRef(0);
  const startAttempt = useRef(0);
  const handlingDraft = useRef(false);
  const createdRef = useRef(false);
  const hangUpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (hangUpTimer.current) clearTimeout(hangUpTimer.current);
    void providerRef.current?.stop().catch(() => undefined);
  }, []);

  function appendTranscript(entry: VoiceTranscriptEntry) {
    transcriptRef.current = [...transcriptRef.current, { ...entry, id: ++lineId.current }];
    setTranscript(transcriptRef.current);
  }

  function transcriptText() {
    return transcriptRef.current
      .map((line) => `${line.role === "assistant" ? "ResolveIT" : "Employee"}: ${line.text}`)
      .join("\n")
      .slice(-12000);
  }

  async function handleDraft(rawDraft: unknown) {
    // One draft at a time, and never a second ticket from the same call.
    if (handlingDraft.current || createdRef.current) return;
    handlingDraft.current = true;
    setNotice("Creating your ticket…");

    try {
      const outcome = await processIncidentDraft(rawDraft, transcriptText());
      const provider = providerRef.current;

      if (outcome.kind === "created") {
        createdRef.current = true;
        setCreated(outcome.result);
        setNotice("");
        if (provider) {
          provider.say(outcome.speech, true);
          hangUpTimer.current = setTimeout(() => void providerRef.current?.stop().catch(() => undefined), HANG_UP_FALLBACK_MS);
        }
        return;
      }

      if (outcome.kind === "needs-info") {
        setNotice(outcome.fields.length
          ? `A few more details are needed: ${outcome.fields.map(describeField).join("; ")}.`
          : "The assistant is re-checking the details.");
        provider?.sendSystemMessage(outcome.instruction);
        return;
      }

      setFailed(true);
      setError(outcome.message);
      setNotice("");
      provider?.sendSystemMessage(outcome.instruction);
    } finally {
      handlingDraft.current = false;
    }
  }

  function handleCallEnd() {
    providerRef.current = null;
    if (hangUpTimer.current) clearTimeout(hangUpTimer.current);
    setState("ready");
    if (!createdRef.current && transcriptRef.current.length > 0) {
      setNotice("The call ended before a ticket was created. Start again, or use the manual report.");
    }
  }

  async function endConversation() {
    startAttempt.current += 1;
    setIsStarting(false);
    const provider = providerRef.current;
    providerRef.current = null;
    if (provider) {
      await provider.stop().catch(() => undefined);
    }
    setState("ready");
  }

  async function startConversation() {
    if (!configured || !publicKey || !assistantId) {
      setError("Voice reporting is not set up yet. Please use the manual report.");
      return;
    }

    setError("");
    setNotice("");
    setFailed(false);
    setCreated(null);
    createdRef.current = false;
    handlingDraft.current = false;
    transcriptRef.current = [];
    lineId.current = 0;
    setTranscript([]);
    setIsStarting(true);
    setState("connecting");
    const attempt = ++startAttempt.current;

    try {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone access requires a secure browser connection.");
      }
      // Ask for the microphone first so permission problems get a clear message.
      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone.getTracks().forEach((track) => track.stop());
      if (attempt !== startAttempt.current) return;

      const provider = new VapiVoiceProvider(publicKey, assistantId, {
        onStateChange: setState,
        onTranscript: appendTranscript,
        onIncidentDraft: (draft) => void handleDraft(draft),
        onCallEnd: handleCallEnd,
        onError: (voiceError) => setError(voiceError.message),
      });
      providerRef.current = provider;
      await provider.start();
    } catch (cause) {
      if (attempt !== startAttempt.current) return;
      providerRef.current = null;
      setState("ready");
      if (cause instanceof DOMException && (cause.name === "NotAllowedError" || cause.name === "SecurityError")) {
        setError("Microphone permission was denied. Allow microphone access in your browser settings.");
      } else if (cause instanceof DOMException && cause.name === "NotFoundError") {
        setError("No microphone was found.");
      } else {
        setError(cause instanceof Error ? cause.message : "Voice could not be started.");
      }
    } finally {
      if (attempt === startAttempt.current) setIsStarting(false);
    }
  }

  if (created) {
    return (
      <SubmissionOutcome
        result={created}
        source="voice"
        onReportAnother={state === "ready" ? () => { setCreated(null); createdRef.current = false; setTranscript([]); transcriptRef.current = []; } : undefined}
      />
    );
  }

  const inCall = state === "listening" || state === "speaking" || state === "processing";

  return (
    <section className="voice-card" aria-labelledby="voice-heading">
      <div className="voice-card-top">
        <div className="voice-kicker"><span className="voice-kicker-dot" />AI SUPPORT ASSISTANT</div>
        <span className="voice-provider">VOICE</span>
      </div>

      <div className={`voice-orb${inCall ? " voice-orb-active" : ""}${state === "speaking" ? " voice-orb-speaking" : ""}`} aria-hidden="true">
        <span className="voice-orb-inner">{inCall ? "✳" : "◉"}</span>
      </div>

      <h2 id="voice-heading">Talk through the problem.</h2>
      <p className="voice-explainer">
        The assistant will ask a few questions, help with simple fixes, and create your ticket for you.
        Urgent problems go straight to IT support.
      </p>

      <div className={`voice-status${inCall ? " voice-status-active" : ""}`} role="status">
        <span className="voice-status-dot" />
        {STATE_LABELS[state]}
      </div>

      {state === "connecting" ? (
        <button className="button voice-end-button" type="button" onClick={endConversation}>
          Cancel <span aria-hidden="true">■</span>
        </button>
      ) : inCall ? (
        <button className="button voice-end-button" type="button" onClick={endConversation}>
          End call <span aria-hidden="true">■</span>
        </button>
      ) : (
        <button className="button voice-start-button" type="button" onClick={startConversation} disabled={!configured || isStarting}>
          <span aria-hidden="true">{isStarting ? "◌" : "●"}</span>
          {!configured ? "Voice unavailable" : isStarting ? "Connecting…" : transcript.length ? "Start a new conversation" : "Start talking"}
        </button>
      )}

      <p className="voice-microphone-note">
        {configured ? "Your browser will ask for microphone access." : "You can still report the issue with the manual form."}
      </p>

      {error && (
        <div className="voice-error" role="alert">
          <span aria-hidden="true">!</span>
          <p>{error}</p>
        </div>
      )}

      {notice && <div className="voice-review-note" role="status">{notice}</div>}

      {(failed || !configured || notice.startsWith("The call ended")) && onUseManualForm && (
        <button className="text-button voice-manual-link" type="button" onClick={onUseManualForm}>
          Report manually instead →
        </button>
      )}

      {transcript.length > 0 && (
        <div className="voice-transcript" aria-label="Conversation transcript" aria-live="polite">
          {transcript.map((line) => (
            <p className={`transcript-line transcript-${line.role === "assistant" ? "agent" : "user"}`} key={line.id}>
              <strong>{line.role === "assistant" ? "Assistant" : "You"}</strong>
              <span>{line.text}</span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
