import { describe, expect, it, vi } from "vitest";
import { IncompleteVoiceDraftError, submitVoiceIncidentDraft } from "./submission";
import { makeIncident } from "@/testing/fixtures";
import type { CreateIncidentInput } from "@/features/incidents/validation";

const completeDraft = {
  title: "VPN connection drops",
  description: "The employee's VPN disconnects every few minutes while working remotely.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 1,
  businessImpact: "The employee cannot access internal project files.",
  urgency: "HIGH",
} satisfies CreateIncidentInput;

const savedIncident = makeIncident({ ...completeDraft, severity: "HIGH", source: "voice" });
const created = () => vi.fn().mockResolvedValue(Response.json({ success: true, data: savedIncident }, { status: 201 }));
const sentBody = (fetcher: ReturnType<typeof vi.fn>) => JSON.parse(fetcher.mock.calls[0][1]?.body as string);

describe("voice incident submission boundary", () => {
  it("automatically sends a complete voice draft to the incident API", async () => {
    const fetcher = created();

    await expect(submitVoiceIncidentDraft(completeDraft, fetcher)).resolves.toEqual({ incident: savedIncident });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("/api/incidents");
    expect(sentBody(fetcher)).toMatchObject({ ...completeDraft, source: "voice" });
  });

  it("forwards the conversation transcript so it is stored with the incident", async () => {
    const fetcher = created();
    await submitVoiceIncidentDraft({ ...completeDraft, transcript: "Employee: My VPN keeps dropping." }, fetcher);
    expect(sentBody(fetcher).transcript).toBe("Employee: My VPN keeps dropping.");
  });

  it("normalizes spoken category/urgency words and drops unknown keys instead of failing", async () => {
    const fetcher = created();
    await submitVoiceIncidentDraft({ ...completeDraft, category: "vpn", urgency: undefined, priority: "urgent", affectedUsers: "2", extraNotes: "x" }, fetcher);
    const body = sentBody(fetcher);
    expect(body).toMatchObject({ category: "NETWORK_CONNECTIVITY", urgency: "HIGH", affectedUsers: 2 });
    expect(body).not.toHaveProperty("extraNotes");
    expect(body).not.toHaveProperty("priority");
  });

  it("reports every missing required field without calling the API", async () => {
    const fetcher = vi.fn();
    const error = await submitVoiceIncidentDraft({ ...completeDraft, affectedUsers: null, businessImpact: "" }, fetcher).catch((cause) => cause);
    expect(error).toBeInstanceOf(IncompleteVoiceDraftError);
    expect(error.problem).toBe("missing");
    expect(error.fields).toEqual(expect.arrayContaining(["affectedUsers", "businessImpact"]));
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects agent-supplied severity or status fields", async () => {
    const fetcher = vi.fn();
    const error = await submitVoiceIncidentDraft({ ...completeDraft, severity: "CRITICAL" }, fetcher).catch((cause) => cause);
    expect(error).toBeInstanceOf(IncompleteVoiceDraftError);
    expect(error.problem).toBe("forbidden");
    expect(error.fields).toEqual(["severity"]);
    expect(fetcher).not.toHaveBeenCalled();
  });
});
