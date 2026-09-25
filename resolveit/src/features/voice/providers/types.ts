export type VoiceConnectionState = "ready" | "connecting" | "listening" | "speaking" | "processing";

export type VoiceTranscriptEntry = {
  role: "assistant" | "user";
  text: string;
};

export interface VoiceProviderCallbacks {
  onStateChange(state: VoiceConnectionState): void;
  onTranscript(entry: VoiceTranscriptEntry): void;
  onIncidentDraft(draft: unknown): void;
  onError(error: Error): void;
}

export interface VoiceProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
}
