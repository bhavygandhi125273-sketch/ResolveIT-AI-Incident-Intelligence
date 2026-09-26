import type Vapi from "@vapi-ai/web";
import type {
  VoiceProvider,
  VoiceProviderCallbacks,
  VoiceTranscriptEntry,
} from "./types";

type JsonRecord = Record<string, unknown>;

export const PREPARE_INCIDENT_TOOL = "prepare_incident";

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transcriptEntry(message: JsonRecord): VoiceTranscriptEntry | null {
  if (message.type !== "transcript") return null;
  if (message.transcriptType && message.transcriptType !== "final") return null;

  const { role, transcript: text } = message;
  if ((role !== "assistant" && role !== "user") || typeof text !== "string" || !text.trim()) {
    return null;
  }
  return { role, text: text.trim() };
}

function parseArguments(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  }
  return isRecord(value) ? value : null;
}

/** Extracts prepare_incident arguments from current (tool-calls) and legacy (function-call) messages. */
export function extractIncidentDraft(message: unknown): { found: false } | { found: true; draft: unknown } {
  if (!isRecord(message)) return { found: false };

  if (message.type === "tool-calls" && Array.isArray(message.toolCallList)) {
    for (const call of message.toolCallList) {
      if (!isRecord(call)) continue;
      const fn = isRecord(call.function) ? call.function : call;
      if (fn.name !== PREPARE_INCIDENT_TOOL) continue;
      return { found: true, draft: parseArguments(fn.arguments ?? fn.parameters) };
    }
  }

  if (message.type === "function-call" && isRecord(message.functionCall)) {
    const fn = message.functionCall;
    if (fn.name === PREPARE_INCIDENT_TOOL) {
      return { found: true, draft: parseArguments(fn.parameters ?? fn.arguments) };
    }
  }

  return { found: false };
}

function safeVoiceError(error: unknown): Error {
  const text = isRecord(error) && typeof error.type === "string" ? error.type : "";
  if (text.includes("permission") || text.includes("microphone")) {
    return new Error("Microphone access was blocked. Allow microphone access in your browser settings, then retry.");
  }
  return new Error("The voice conversation was interrupted. Check your connection and try again, or use the manual report.");
}

export class VapiVoiceProvider implements VoiceProvider {
  private client: Vapi | null = null;
  private ended = false;

  constructor(
    private readonly publicKey: string,
    private readonly assistantId: string,
    private readonly callbacks: VoiceProviderCallbacks,
  ) {}

  async start(): Promise<void> {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw new Error("Microphone access requires a secure browser connection. Use the manual report if it is unavailable.");
    }

    this.callbacks.onStateChange("connecting");

    const { default: VapiClient } = await import("@vapi-ai/web");
    const client = new VapiClient(this.publicKey);
    this.client = client;
    this.ended = false;

    client.on("call-start", () => this.callbacks.onStateChange("listening"));
    client.on("speech-start", () => this.callbacks.onStateChange("speaking"));
    client.on("speech-end", () => this.callbacks.onStateChange("listening"));
    client.on("call-end", () => this.finish());
    client.on("error", (error: unknown) => {
      this.callbacks.onError(safeVoiceError(error));
      void this.stop().catch(() => undefined);
    });
    client.on("message", (message: unknown) => this.handleMessage(message));

    try {
      const call = await client.start(this.assistantId);
      if (!call) throw new Error("Vapi did not create a voice call.");
    } catch {
      await client.stop().catch(() => undefined);
      this.client = null;
      throw new Error("Vapi could not start the voice conversation. Check the assistant configuration and try again.");
    }
  }

  async stop(): Promise<void> {
    const client = this.client;
    this.client = null;
    try {
      await client?.stop();
    } finally {
      this.finish();
    }
  }

  sendSystemMessage(content: string): void {
    this.client?.send({
      type: "add-message",
      message: { role: "system", content },
      triggerResponseEnabled: true,
    });
  }

  say(text: string, endCallAfterSpoken = false): void {
    this.client?.say(text, endCallAfterSpoken);
  }

  /** Runs exactly once per call, however the call ended. */
  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    this.client = null;
    this.callbacks.onStateChange("ready");
    this.callbacks.onCallEnd();
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message)) return;

    const transcript = transcriptEntry(message);
    if (transcript) {
      this.callbacks.onTranscript(transcript);
      return;
    }

    const toolCall = extractIncidentDraft(message);
    if (toolCall.found) {
      this.callbacks.onStateChange("processing");
      this.callbacks.onIncidentDraft(toolCall.draft);
    }
  }
}
