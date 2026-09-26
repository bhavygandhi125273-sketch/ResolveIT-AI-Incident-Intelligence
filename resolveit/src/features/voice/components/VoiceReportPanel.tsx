"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import { IncidentApiError } from "@/features/incidents/client";
import type { IncidentSubmissionResult } from "@/features/incidents/client";

import {
  INCIDENT_CATEGORIES,
} from "@/features/incidents/types";

import type {
  IncidentCategory,
} from "@/features/incidents/types";

import {
  VoiceIncidentDraftSchema,
} from "../schema";

import {
  IncompleteVoiceDraftError,
  submitVoiceIncidentDraft,
} from "../submission";

import type {
  VoiceIncidentDraft,
} from "../schema";

import { VapiVoiceProvider } from "../providers/vapi";

import type {
  VoiceConnectionState,
  VoiceTranscriptEntry,
} from "../providers/types";

const categoryLabels: Record<
  IncidentCategory,
  string
> = {
  ACCOUNT_ACCESS: "Account & access",
  COMPUTER_HARDWARE: "Computer & hardware",
  NETWORK_CONNECTIVITY: "Network & connectivity",
  SOFTWARE_APPLICATIONS:
    "Software & applications",
  EMAIL_COLLABORATION:
    "Email & collaboration",
  OTHER: "Other",
};

type TranscriptLine =
  VoiceTranscriptEntry & {
    id: number;
  };

function normalizeCategory(
  value: unknown,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const map: Record<
    string,
    IncidentCategory
  > = {
    ACCESS: "ACCOUNT_ACCESS",
    ACCOUNT: "ACCOUNT_ACCESS",
    ACCOUNT_ACCESS: "ACCOUNT_ACCESS",

    HARDWARE: "COMPUTER_HARDWARE",
    COMPUTER: "COMPUTER_HARDWARE",
    COMPUTER_HARDWARE:
      "COMPUTER_HARDWARE",

    NETWORK: "NETWORK_CONNECTIVITY",
    CONNECTIVITY:
      "NETWORK_CONNECTIVITY",
    NETWORK_CONNECTIVITY:
      "NETWORK_CONNECTIVITY",

    SOFTWARE: "SOFTWARE_APPLICATIONS",
    APPLICATION:
      "SOFTWARE_APPLICATIONS",
    APPLICATIONS:
      "SOFTWARE_APPLICATIONS",
    SOFTWARE_APPLICATION:
      "SOFTWARE_APPLICATIONS",
    SOFTWARE_APPLICATIONS:
      "SOFTWARE_APPLICATIONS",

    EMAIL: "EMAIL_COLLABORATION",
    COLLABORATION:
      "EMAIL_COLLABORATION",
    EMAIL_COLLABORATION:
      "EMAIL_COLLABORATION",

    OTHER: "OTHER",
  };

  return map[normalized] ?? value;
}

function normalizeUrgency(
  value: unknown,
): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");

  if (
    normalized === "LOW" ||
    normalized === "LOW PRIORITY" ||
    normalized === "LOW URGENCY"
  ) {
    return "LOW";
  }

  if (
    normalized === "MEDIUM" ||
    normalized === "MEDIUM PRIORITY" ||
    normalized === "MEDIUM URGENCY" ||
    normalized === "MODERATE"
  ) {
    return "MEDIUM";
  }

  if (
    normalized === "HIGH" ||
    normalized === "HIGH PRIORITY" ||
    normalized === "HIGH URGENCY"
  ) {
    return "HIGH";
  }

  if (
    normalized === "CRITICAL" ||
    normalized === "CRITICAL PRIORITY" ||
    normalized === "CRITICAL URGENCY" ||
    normalized === "EMERGENCY" ||
    normalized === "URGENT"
  ) {
    return "CRITICAL";
  }

  return value;
}

function normalizeDraft(
  value: unknown,
): unknown {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return value;
  }

  const raw =
    value as Record<string, unknown>;

  return {
    ...raw,
    category: normalizeCategory(
      raw.category,
    ),
    urgency: normalizeUrgency(
      raw.urgency,
    ),
  };
}

function VoiceSession({
  configured,
  publicKey,
  assistantId,
}: {
  configured: boolean;
  publicKey?: string;
  assistantId?: string;
}) {
  const [transcript, setTranscript] =
    useState<TranscriptLine[]>([]);

  const [draft, setDraft] =
    useState<VoiceIncidentDraft | null>(
      null,
    );

  const [voiceError, setVoiceError] =
    useState(
      configured
        ? ""
        : "Voice reporting needs a Vapi public API key and assistant ID.",
    );

  const [draftMessage, setDraftMessage] =
    useState("");

  const [state, setState] =
    useState<VoiceConnectionState>(
      "ready",
    );

  const [isStarting, setIsStarting] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [created, setCreated] =
    useState<IncidentSubmissionResult | null>(
      null,
    );

  const providerRef =
    useRef<VapiVoiceProvider | null>(
      null,
    );

  const transcriptRef =
    useRef<TranscriptLine[]>([]);

  const messageId =
    useRef(0);

  const startAttempt =
    useRef(0);

  const submittingDraftRef =
    useRef(false);

  useEffect(() => {
    return () => {
      void providerRef.current?.stop();
    };
  }, []);

  function appendTranscript(
    entry: VoiceTranscriptEntry,
  ) {
    const line: TranscriptLine = {
      ...entry,
      id: ++messageId.current,
    };

    transcriptRef.current = [
      ...transcriptRef.current,
      line,
    ];

    setTranscript(
      transcriptRef.current,
    );
  }

  async function endConversation() {
    startAttempt.current += 1;
    setIsStarting(false);

    const provider =
      providerRef.current;

    if (!provider) {
      setState("ready");
      return;
    }

    try {
      await provider.stop();
    } catch (error) {
      console.error(
        "[ResolveIT] Failed to stop Vapi call:",
        error,
      );
    } finally {
      providerRef.current = null;
      setState("ready");
    }
  }

  async function submitPreparedDraft(
    nextDraft: VoiceIncidentDraft,
  ) {
    if (submittingDraftRef.current) {
      return;
    }

    submittingDraftRef.current = true;
    setIsSubmitting(true);
    setDraftMessage(
      "Creating your incident...",
    );

    try {
      /*
       * IMPORTANT:
       *
       * Do NOT run CreateIncidentSchema
       * or VoiceIncidentSubmissionSchema
       * here.
       *
       * submitVoiceIncidentDraft() is now
       * the single submission gateway.
       *
       * It removes voice-only fields such
       * as transcript before sending the
       * API request.
       */
      console.log(
        "[ResolveIT] Automatically submitting voice incident:",
        nextDraft,
      );

      const result =
        await submitVoiceIncidentDraft(
          nextDraft,
        );

      console.log(
        "[ResolveIT] Incident created:",
        result,
      );

      setCreated(result);
      setDraftMessage("");

      /*
       * The incident has been successfully
       * created.
       *
       * NOW end the Vapi call.
       */
      await endConversation();
    } catch (error) {
      console.error(
        "[ResolveIT] Automatic voice submission failed:",
        error,
      );

      if (
        error instanceof
        IncompleteVoiceDraftError
      ) {
        setDraftMessage(
          `The agent still needs: ${error.fields.join(
            ", ",
          )}.`,
        );

        /*
         * Do NOT show a submit button.
         *
         * The employee should not have to
         * manually submit the voice report.
         */
        return;
      }

      if (
        error instanceof IncidentApiError
      ) {
        setDraftMessage(
          error.message ||
            "The incident could not be created.",
        );

        return;
      }

      setDraftMessage(
        error instanceof Error
          ? error.message
          : "The incident could not be created.",
      );
    } finally {
      setIsSubmitting(false);
      submittingDraftRef.current =
        false;
    }
  }

  function prepareIncident(
    parameters: unknown,
  ) {
    console.log(
      "[ResolveIT] prepare_incident received:",
      parameters,
    );

    const normalized =
      normalizeDraft(parameters);

    const parsed =
      VoiceIncidentDraftSchema.safeParse(
        normalized,
      );

    if (!parsed.success) {
      console.error(
        "[ResolveIT] Invalid prepare_incident payload:",
        parsed.error,
      );

      setDraftMessage(
        "The voice agent could not prepare the incident details.",
      );

      return;
    }

    const transcriptText =
      transcriptRef.current
        .map(
          (line) =>
            `${
              line.role === "assistant"
                ? "ResolveIT"
                : "Employee"
            }: ${line.text}`,
        )
        .join("\n")
        .slice(0, 12000);

    /*
     * transcript is useful for the stored
     * incident, but it is NOT sent directly
     * through CreateIncidentSchema.
     *
     * submission.ts strips it before API
     * validation.
     */
    const nextDraft: VoiceIncidentDraft =
      {
        ...parsed.data,
        transcript: transcriptText,
      };

    setDraft(nextDraft);

    /*
     * AUTOMATIC SUBMISSION
     *
     * There is intentionally NO
     * "Confirm and submit" step.
     */
    void submitPreparedDraft(
      nextDraft,
    );
  }

  async function startConversation() {
    if (
      !configured ||
      !publicKey ||
      !assistantId
    ) {
      setVoiceError(
        "Vapi voice is not configured. Use the manual report or configure the Vapi credentials.",
      );

      return;
    }

    setVoiceError("");
    setDraftMessage("");
    setDraft(null);
    setCreated(null);
    submittingDraftRef.current = false;

    setTranscript([]);
    transcriptRef.current = [];
    messageId.current = 0;

    setIsStarting(true);
    setState("connecting");

    const attempt =
      ++startAttempt.current;

    try {
      if (
        !window.isSecureContext ||
        !navigator.mediaDevices?.getUserMedia
      ) {
        throw new Error(
          "Microphone access requires a secure browser connection.",
        );
      }

      const microphone =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: true,
          },
        );

      if (
        attempt !==
        startAttempt.current
      ) {
        microphone
          .getTracks()
          .forEach((track) =>
            track.stop(),
          );

        return;
      }

      microphone
        .getTracks()
        .forEach((track) =>
          track.stop(),
        );

      const provider =
        new VapiVoiceProvider(
          publicKey,
          assistantId,
          {
            onStateChange: setState,

            onTranscript:
              appendTranscript,

            onIncidentDraft:
              prepareIncident,

            onError: (error) => {
              console.error(
                "[ResolveIT] Vapi error:",
                error,
              );

              setVoiceError(
                error.message,
              );

              setState("ready");

              void providerRef.current
                ?.stop()
                .catch(
                  () => undefined,
                );

              providerRef.current =
                null;
            },
          },
        );

      if (
        attempt !==
        startAttempt.current
      ) {
        return;
      }

      providerRef.current =
        provider;

      await provider.start();
    } catch (error) {
      if (
        attempt !==
        startAttempt.current
      ) {
        return;
      }

      providerRef.current = null;
      setState("ready");

      if (
        error instanceof DOMException &&
        (
          error.name ===
            "NotAllowedError" ||
          error.name ===
            "SecurityError"
        )
      ) {
        setVoiceError(
          "Microphone permission was denied. Allow microphone access in your browser settings.",
        );
      } else if (
        error instanceof DOMException &&
        error.name ===
          "NotFoundError"
      ) {
        setVoiceError(
          "No microphone was found.",
        );
      } else {
        setVoiceError(
          error instanceof Error
            ? error.message
            : "Voice could not be started.",
        );
      }
    } finally {
      if (
        attempt ===
        startAttempt.current
      ) {
        setIsStarting(false);
      }
    }
  }

  if (created) {
    return (
      <section
        className="voice-card voice-success"
        aria-live="polite"
      >
        <div
          className="success-mark"
          aria-hidden="true"
        >
          ✓
        </div>

        <span className="voice-kicker">
          VOICE REPORT SUBMITTED
        </span>

        <h2>
          Your IT team has the details.
        </h2>

        <p>
          ResolveIT automatically
          created the incident from
          your voice conversation.
        </p>

        <div className="success-reference">
          <span>REFERENCE</span>

          <strong>
            {created.incident.id
              .slice(0, 8)
              .toUpperCase()}
          </strong>
        </div>

        <Link
          className="button button-primary"
          href="/my-incidents"
        >
          View my incidents{" "}
          <span aria-hidden="true">
            →
          </span>
        </Link>
      </section>
    );
  }

  const inCall =
    state === "listening" ||
    state === "speaking" ||
    state === "processing";

  const labels: Record<
    VoiceConnectionState,
    string
  > = {
    ready: "Ready when you are",

    connecting:
      "Connecting to Vapi…",

    listening:
      "Listening — tell me what’s happening",

    speaking:
      "ResolveIT is speaking",

    processing:
      "Preparing the incident summary…",
  };

  return (
    <section
      className="voice-card"
      aria-labelledby="voice-heading"
    >
      <div className="voice-card-top">
        <div className="voice-kicker">
          <span className="voice-kicker-dot" />
          LIVE VOICE INTAKE
        </div>

        <span className="voice-provider">
          VAPI VOICE AGENT
        </span>
      </div>

      <div
        className={
          "voice-orb" +
          (inCall
            ? " voice-orb-active"
            : "") +
          (state === "speaking"
            ? " voice-orb-speaking"
            : "")
        }
        aria-hidden="true"
      >
        <span className="voice-orb-inner">
          {inCall ? "✳" : "◉"}
        </span>
      </div>

      <h2 id="voice-heading">
        Talk through the issue.
      </h2>

      <p className="voice-explainer">
        ResolveIT collects the incident
        details and automatically
        creates the ticket when the
        required information is
        available.
      </p>

      <div
        className={
          "voice-status" +
          (inCall
            ? " voice-status-active"
            : "")
        }
        role="status"
      >
        <span className="voice-status-dot" />
        {labels[state]}
      </div>

      {state === "connecting" ? (
        <button
          className="button voice-end-button"
          type="button"
          onClick={endConversation}
        >
          Cancel connection{" "}
          <span aria-hidden="true">
            ■
          </span>
        </button>
      ) : inCall ? (
        <button
          className="button voice-end-button"
          type="button"
          onClick={endConversation}
          disabled={isSubmitting}
        >
          {isSubmitting
            ? "Creating incident…"
            : "End call"}{" "}
          <span aria-hidden="true">
            ■
          </span>
        </button>
      ) : (
        <button
          className="button voice-start-button"
          type="button"
          onClick={startConversation}
          disabled={
            !configured ||
            isStarting ||
            isSubmitting
          }
        >
          <span aria-hidden="true">
            {isStarting ? "◌" : "●"}
          </span>

          {!configured
            ? "Voice setup required"
            : isStarting
              ? "Connecting…"
              : isSubmitting
                ? "Creating incident…"
                : "Start voice report"}
        </button>
      )}

      <p className="voice-microphone-note">
        {configured
          ? "Vapi will request microphone access when the session starts."
          : "Voice requires a Vapi public API key and assistant ID."}
      </p>

      {voiceError && (
        <div
          className="voice-error"
          role="alert"
        >
          <span aria-hidden="true">
            !
          </span>

          <p>{voiceError}</p>
        </div>
      )}

      {draftMessage && (
        <div
          className="voice-review-note"
          role="status"
        >
          {draftMessage}
        </div>
      )}

      {transcript.length > 0 && (
        <div
          className="voice-transcript"
          aria-label="Conversation transcript"
          aria-live="polite"
        >
          {transcript.map((line) => (
            <p
              className={
                "transcript-line transcript-" +
                (line.role === "assistant"
                  ? "agent"
                  : "user")
              }
              key={line.id}
            >
              <strong>
                {line.role === "assistant"
                  ? "ResolveIT"
                  : "You"}
              </strong>

              <span>
                {line.text}
              </span>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function VoiceReportPanel({
  configured,
  publicKey,
  assistantId,
}: {
  configured: boolean;
  publicKey?: string;
  assistantId?: string;
}) {
  return (
    <VoiceSession
      configured={configured}
      publicKey={publicKey}
      assistantId={assistantId}
    />
  );
}