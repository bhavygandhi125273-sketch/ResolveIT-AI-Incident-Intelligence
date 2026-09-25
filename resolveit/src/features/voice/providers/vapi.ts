import type Vapi from "@vapi-ai/web";
import type { VoiceProvider, VoiceProviderCallbacks, VoiceTranscriptEntry } from "./types";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transcriptEntry(message: JsonRecord): VoiceTranscriptEntry | null {
  if (message.type !== "transcript") return null;
  const role = message.role;
  const text = message.transcript;
  if ((role !== "assistant" && role !== "user") || typeof text !== "string" || !text.trim()) return null;
  if (message.transcriptType && message.transcriptType !== "final") return null;
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
  return value;
}

function getSafeVoiceError(error: unknown): Error {
  const text = isRecord(error) && typeof error.type === "string" ? error.type : "";
  if (text.includes("permission") || text.includes("microphone")) {
    return new Error("Microphone access was blocked. Allow microphone access in your browser settings, then retry.");
  }
  return new Error("Vapi could not start the voice conversation. Check the Vapi assistant and browser connection, then retry.");
}

/** Provider boundary. Only Vapi's explicitly browser-safe public key reaches the SDK. */
export class VapiVoiceProvider implements VoiceProvider {
  private client: Vapi | null = null;

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

    client.on("call-start", () => this.callbacks.onStateChange("listening"));
    client.on("speech-start", () => this.callbacks.onStateChange("speaking"));
    client.on("speech-end", () => this.callbacks.onStateChange("listening"));
    client.on("call-end", () => this.callbacks.onStateChange("ready"));
    client.on("error", (error: unknown) => {
      this.callbacks.onError(getSafeVoiceError(error));
      this.callbacks.onStateChange("ready");
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
    if (client) await client.stop();
  }

  private handleMessage(message: unknown): void {
    if (!isRecord(message)) return;
    const transcript = transcriptEntry(message);
    if (transcript) {
      this.callbacks.onTranscript(transcript);
      return;
    }
    if (message.type !== "tool-calls" || !Array.isArray(message.toolCallList)) return;

    for (const call of message.toolCallList) {
      if (!isRecord(call) || !isRecord(call.function) || call.function.name !== "prepare_incident") continue;
      this.callbacks.onStateChange("processing");
      this.callbacks.onIncidentDraft(parseArguments(call.function.arguments));
    }
  }
}
