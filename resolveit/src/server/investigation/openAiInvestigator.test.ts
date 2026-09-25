import { describe, expect, it, vi } from "vitest";
import { investigateIncident } from "./openAiInvestigator";
import type { Incident } from "@/features/incidents/types";

const incident: Incident = {
  id: "incident-1",
  title: "Wi-Fi drops repeatedly",
  description: "The office Wi-Fi disconnects every few minutes.",
  category: "NETWORK_CONNECTIVITY",
  status: "OPEN",
  severity: "LOW",
  affectedUsers: 1,
  businessImpact: "Work is interrupted.",
  urgency: "LOW",
  source: "manual",
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

describe("OpenAI incident investigator", () => {
  it("reports missing configuration without pretending to investigate", async () => {
    await expect(investigateIncident(incident, undefined)).resolves.toMatchObject({
      status: "not_configured",
      safeToResolve: false,
      recommendedResolution: null,
    });
  });

  it("sends a server-side Responses API request and validates the advisory output", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({
        summary: "A single user's office Wi-Fi disconnects.",
        safeToResolve: true,
        recommendedResolution: "Reconnect to the office Wi-Fi.",
        missingInformation: [],
      }) }] }],
    }));

    await expect(investigateIncident(incident, "test-only-key", fetcher)).resolves.toEqual({
      status: "complete",
      summary: "A single user's office Wi-Fi disconnects.",
      safeToResolve: true,
      recommendedResolution: "Reconnect to the office Wi-Fi.",
      missingInformation: [],
    });
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
      cache: "no-store",
    }));
    expect(JSON.stringify(fetcher.mock.calls[0][1])).toContain("store");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-only-key" });
    expect(fetcher.mock.calls[0][0]).not.toContain("test-only-key");
  });

  it("does not mark malformed or unverified suggestions safe", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({
      output: [{ content: [{ type: "output_text", text: JSON.stringify({
        summary: "Incomplete.",
        safeToResolve: true,
        recommendedResolution: null,
        missingInformation: [],
      }) }] }],
    }));
    await expect(investigateIncident(incident, "test-only-key", fetcher)).resolves.toMatchObject({
      status: "unavailable",
      safeToResolve: false,
    });
  });
});
