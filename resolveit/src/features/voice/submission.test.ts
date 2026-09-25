import { describe, expect, it, vi } from "vitest";
import { IncompleteVoiceDraftError, submitVoiceIncidentDraft } from "./submission";
import type { Incident } from "@/features/incidents/types";
import type { CreateIncidentInput } from "@/features/incidents/validation";

const completeDraft = {
  title: "VPN connection drops",
  description: "The employee's VPN disconnects every few minutes while working remotely.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 1,
  businessImpact: "The employee cannot access internal project files.",
  urgency: "HIGH",
} satisfies CreateIncidentInput;

const savedIncident: Incident = {
  id: "voice-incident-id",
  ...completeDraft,
  status: "OPEN",
  severity: "HIGH",
  source: "voice",
  affectedSystem: null,
  symptoms: null,
  startedAt: null,
  currentlyAffected: null,
  errorMessages: [],
  troubleshootingAttempted: [],
  transcript: null,
  createdAt: "2026-09-24T12:00:00.000Z",
  updatedAt: "2026-09-24T12:00:00.000Z",
};

describe("voice incident submission boundary", () => {
  it("sends a complete voice draft to the existing incident API", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ success: true, data: savedIncident }, { status: 201 }));

    await expect(submitVoiceIncidentDraft(completeDraft, fetcher)).resolves.toEqual({ incident: savedIncident });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("/api/incidents");
    expect(JSON.parse(fetcher.mock.calls[0][1]?.body as string)).toMatchObject({ ...completeDraft, source: "voice" });
  });

  it("keeps unknown values unknown and blocks submission until the employee fills them in", async () => {
    const fetcher = vi.fn();
    await expect(submitVoiceIncidentDraft({ ...completeDraft, affectedUsers: null }, fetcher))
      .rejects.toBeInstanceOf(IncompleteVoiceDraftError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects agent-supplied severity or status fields", async () => {
    const fetcher = vi.fn();
    await expect(submitVoiceIncidentDraft({ ...completeDraft, severity: "CRITICAL" }, fetcher))
      .rejects.toBeInstanceOf(IncompleteVoiceDraftError);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
