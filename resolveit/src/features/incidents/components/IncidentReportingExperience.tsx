"use client";

import { useState } from "react";
import { IncidentReportForm } from "./IncidentReportForm";
import { VoiceReportPanel } from "@/features/voice/components/VoiceReportPanel";

export type ReportingMode = "voice" | "manual";

type Props = {
  initialMode?: ReportingMode;
  voiceConfigured: boolean;
  vapiPublicKey?: string;
  vapiAssistantId?: string;
};

export function IncidentReportingExperience({ initialMode, voiceConfigured, vapiPublicKey, vapiAssistantId }: Props) {
  const [mode, setMode] = useState<ReportingMode>(initialMode ?? (voiceConfigured ? "voice" : "manual"));

  return (
    <div className="reporting-experience">
      <div className="report-mode-switch" role="tablist" aria-label="Choose how to report the problem">
        <button type="button" role="tab" aria-selected={mode === "voice"} className={`report-mode-tab${mode === "voice" ? " selected" : ""}`} onClick={() => setMode("voice")}>
          <span aria-hidden="true">◉</span> TALK TO AI
        </button>
        <button type="button" role="tab" aria-selected={mode === "manual"} className={`report-mode-tab${mode === "manual" ? " selected" : ""}`} onClick={() => setMode("manual")}>
          <span aria-hidden="true">▤</span> REPORT MANUALLY
        </button>
      </div>
      {mode === "voice" ? (
        <VoiceReportPanel
          configured={voiceConfigured}
          publicKey={vapiPublicKey}
          assistantId={vapiAssistantId}
          onUseManualForm={() => setMode("manual")}
        />
      ) : (
        <IncidentReportForm />
      )}
    </div>
  );
}
