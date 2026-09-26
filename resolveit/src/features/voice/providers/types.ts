export type VoiceConnectionState = "ready" | "connecting" | "listening" | "speaking" | "processing";

export type VoiceTranscriptEntry = {
  role: "assistant" | "user";
  text: string;
};

export interface VoiceProviderCallbacks {
  onStateChange(state: VoiceConnectionState): void;
  onTranscript(entry: VoiceTranscriptEntry): void;
  /** Raw prepare_incident arguments, or null when the tool call could not be read. */
  onIncidentDraft(draft: unknown): void;
  /** The call ended for any reason (employee, agent, or ResolveIT). */
  onCallEnd(): void;
  onError(error: Error): void;
}

export interface VoiceProvider {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Adds a system message the agent sees and responds to. */
  sendSystemMessage(content: string): void;
  /** Speaks text verbatim, optionally ending the call afterwards. */
  say(text: string, endCallAfterSpoken?: boolean): void;
}
