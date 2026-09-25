"use client";

import { useState } from "react";
import { IncidentReportForm } from "./IncidentReportForm";
import { VoiceReportPanel } from "@/features/voice/components/VoiceReportPanel";

type ReportingMode = "voice" | "manual";

export function IncidentReportingExperience({ voiceConfigured, vapiPublicKey, vapiAssistantId }: { voiceConfigured: boolean; vapiPublicKey?: string; vapiAssistantId?: string }) {
  const [mode, setMode] = useState<ReportingMode>("voice");

  return (
    <div className="reporting-experience">
      <div className="report-mode-switch" role="tablist" aria-label="Choose an incident reporting method">
        <button type="button" role="tab" aria-selected={mode === "voice"} className={`report-mode-tab${mode === "voice" ? " selected" : ""}`} onClick={() => setMode("voice")}><span aria-hidden="true">◉</span> VOICE REPORT</button>
        <button type="button" role="tab" aria-selected={mode === "manual"} className={`report-mode-tab${mode === "manual" ? " selected" : ""}`} onClick={() => setMode("manual")}><span aria-hidden="true">▤</span> MANUAL REPORT</button>
      </div>
      {mode === "voice" ? <VoiceReportPanel configured={voiceConfigured} publicKey={vapiPublicKey} assistantId={vapiAssistantId} /> : <IncidentReportForm />}
    </div>
  );
}
