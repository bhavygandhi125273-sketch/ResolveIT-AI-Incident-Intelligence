import type Vapi from "@vapi-ai/web";
import type {
  VoiceProvider,
  VoiceProviderCallbacks,
  VoiceTranscriptEntry,
} from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transcriptEntry(
  message: JsonRecord,
): VoiceTranscriptEntry | null {
  if (message.type !== "transcript") return null;

  const role = message.role;
  const text = message.transcript;

  if (
    (role !== "assistant" && role !== "user") ||
    typeof text !== "string" ||
    !text.trim()
  ) {
    return null;
  }

  if (
    message.transcriptType &&
    message.transcriptType !== "final"
  ) {
    return null;
  }

  return {
    role,
    text: text.trim(),
  };
}

function parseArguments(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }

  if (isRecord(value)) {
    return value;
  }

  return null;
}

function normalizeUrgency(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toUpperCase();

  const urgencyMap: Record<string, string> = {
    LOW: "LOW",
    MEDIUM: "MEDIUM",
    HIGH: "HIGH",
    CRITICAL: "CRITICAL",
    URGENT: "CRITICAL",
  };

  return urgencyMap[normalized] ?? value;
}

function normalizeCategory(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toUpperCase();

  const categoryMap: Record<string, string> = {
    ACCESS: "ACCOUNT_ACCESS",
    ACCOUNT_ACCESS: "ACCOUNT_ACCESS",

    HARDWARE: "COMPUTER_HARDWARE",
    COMPUTER_HARDWARE: "COMPUTER_HARDWARE",

    NETWORK: "NETWORK_CONNECTIVITY",
    NETWORK_CONNECTIVITY: "NETWORK_CONNECTIVITY",

    SOFTWARE: "SOFTWARE_APPLICATIONS",
    SOFTWARE_APPLICATIONS: "SOFTWARE_APPLICATIONS",

    EMAIL: "EMAIL_COLLABORATION",
    COLLABORATION: "EMAIL_COLLABORATION",
    EMAIL_COLLABORATION: "EMAIL_COLLABORATION",

    OTHER: "OTHER",
  };

  return categoryMap[normalized] ?? value;
}

function normalizeIncidentDraft(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    urgency: normalizeUrgency(value.urgency),
    category: normalizeCategory(value.category),
  };
}

function getSafeVoiceError(error: unknown): Error {
  const text =
    isRecord(error) && typeof error.type === "string"
      ? error.type
      : "";

  if (
    text.includes("permission") ||
    text.includes("microphone")
  ) {
    return new Error(
      "Microphone access was blocked. Allow microphone access in your browser settings, then retry.",
    );
  }

  return new Error(
    "Vapi could not start the voice conversation. Check the Vapi assistant and browser connection, then retry.",
  );
}

export class VapiVoiceProvider implements VoiceProvider {
  private client: Vapi | null = null;

  constructor(
    private readonly publicKey: string,
    private readonly assistantId: string,
    private readonly callbacks: VoiceProviderCallbacks,
  ) {}

  async start(): Promise<void> {
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      throw new Error(
        "Microphone access requires a secure browser connection. Use the manual report if it is unavailable.",
      );
    }

    this.callbacks.onStateChange("connecting");

    const { default: VapiClient } = await import("@vapi-ai/web");

    const client = new VapiClient(this.publicKey);

    this.client = client;

    client.on("call-start", () => {
      console.log("[ResolveIT] Vapi call started");
      this.callbacks.onStateChange("listening");
    });

    client.on("speech-start", () => {
      this.callbacks.onStateChange("speaking");
    });

    client.on("speech-end", () => {
      this.callbacks.onStateChange("listening");
    });

    client.on("call-end", () => {
      console.log("[ResolveIT] Vapi call ended");
      this.client = null;
      this.callbacks.onStateChange("ready");
    });

    client.on("error", (error: unknown) => {
      console.error("[ResolveIT] Vapi error:", error);

      this.callbacks.onError(getSafeVoiceError(error));
      this.callbacks.onStateChange("ready");

      void this.stop().catch(() => undefined);
    });

    client.on("message", (message: unknown) => {
      console.log("[ResolveIT] Vapi message:", message);
      this.handleMessage(message);
    });

    try {
      const call = await client.start(this.assistantId);

      if (!call) {
        throw new Error("Vapi did not create a voice call.");
      }
    } catch {
      await client.stop().catch(() => undefined);

      this.client = null;

      throw new Error(
        "Vapi could not start the voice conversation. Check the assistant configuration and try again.",
      );
    }
  }

  async stop(): Promise<void> {
    const client = this.client;

    this.client = null;

    if (!client) {
      return;
    }

    try {
      await client.stop();
    } finally {
      this.callbacks.onStateChange("ready");
    }
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message)) {
      return;
    }

    const transcript = transcriptEntry(message);

    if (transcript) {
      this.callbacks.onTranscript(transcript);
      return;
    }

    /*
     * Modern Vapi client-side tool event.
     */
    if (
      message.type === "tool-calls" &&
      Array.isArray(message.toolCallList)
    ) {
      for (const call of message.toolCallList) {
        if (!isRecord(call)) continue;

        const functionData = isRecord(call.function)
          ? call.function
          : call;

        const functionName =
          typeof functionData.name === "string"
            ? functionData.name
            : "";

        if (functionName !== "prepare_incident") {
          continue;
        }

        const rawDraft = parseArguments(
          functionData.arguments ??
            functionData.parameters,
        );

        if (!rawDraft) {
          this.callbacks.onError(
            new Error(
              "The voice agent returned an invalid incident draft.",
            ),
          );

          return;
        }

        const draft = normalizeIncidentDraft(rawDraft);

        console.log(
          "[ResolveIT] prepare_incident received:",
          draft,
        );

        this.callbacks.onStateChange("processing");
        this.callbacks.onIncidentDraft(draft);

        return;
      }
    }

    /*
     * Older Vapi function-call event.
     */
    if (message.type === "function-call") {
      const functionCall = isRecord(message.functionCall)
        ? message.functionCall
        : null;

      if (!functionCall) {
        return;
      }

      const functionName =
        typeof functionCall.name === "string"
          ? functionCall.name
          : "";

      if (functionName !== "prepare_incident") {
        return;
      }

      const rawDraft = parseArguments(
        functionCall.parameters ??
          functionCall.arguments,
      );

      if (!rawDraft) {
        this.callbacks.onError(
          new Error(
            "The voice agent returned an invalid incident draft.",
          ),
        );

        return;
      }

      const draft = normalizeIncidentDraft(rawDraft);

      console.log(
        "[ResolveIT] prepare_incident received:",
        draft,
      );

      this.callbacks.onStateChange("processing");
      this.callbacks.onIncidentDraft(draft);
    }
  }
}