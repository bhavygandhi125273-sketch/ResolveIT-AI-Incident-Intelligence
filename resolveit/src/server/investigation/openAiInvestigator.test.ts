import { describe, expect, it, vi } from "vitest";
import { investigateIncident } from "./openAiInvestigator";
import { makeIncident } from "@/testing/fixtures";

const incident = makeIncident({
  title: "Wi-Fi drops repeatedly",
  description: "The office Wi-Fi disconnects every few minutes.",
  severity: "LOW",
  affectedUsers: 1,
  businessImpact: "Work is interrupted.",
  urgency: "LOW",
  requester: { id: "employee-id", displayName: "Private Person" },
});

const completeAssessment = {
  summary: "A single user's office Wi-Fi disconnects.",
  possibleCause: "Weak signal near the desk.",
  impact: "One employee is interrupted.",
  recommendedSteps: ["Check access point logs."],
  safeToResolve: true,
  recommendedResolution: "Reconnect to the office Wi-Fi.",
  requiresHumanIntervention: false,
  humanInterventionReason: null,
  missingInformation: [],
};

function respondWith(assessment: unknown) {
  return vi.fn().mockResolvedValue(Response.json({
    output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(assessment) }] }],
  }));
}

describe("OpenAI incident investigator", () => {
  it("reports missing configuration without pretending to investigate", async () => {
    await expect(investigateIncident(incident, undefined)).resolves.toMatchObject({
      status: "not_configured",
      safeToResolve: false,
      recommendedResolution: null,
      requiresHumanIntervention: false,
    });
  });

  it("sends a server-side Responses API request and validates the advisory output", async () => {
    const fetcher = respondWith(completeAssessment);

    await expect(investigateIncident(incident, "test-only-key", fetcher)).resolves.toEqual({
      status: "complete",
      ...completeAssessment,
    });
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      method: "POST",
      cache: "no-store",
    }));
    expect(JSON.stringify(fetcher.mock.calls[0][1])).toContain("store");
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({ Authorization: "Bearer test-only-key" });
    expect(fetcher.mock.calls[0][0]).not.toContain("test-only-key");
  });

  it("shares incident facts but not requester identity or internal IDs with the model", async () => {
    const fetcher = respondWith(completeAssessment);
    await investigateIncident(incident, "test-only-key", fetcher);

    const body = fetcher.mock.calls[0][1]?.body as string;
    expect(body).toContain("Wi-Fi drops repeatedly");
    expect(body).not.toContain("Private Person");
    expect(body).not.toContain(incident.id);
  });

  it("does not mark malformed or unverified suggestions safe", async () => {
    const fetcher = respondWith({ ...completeAssessment, recommendedResolution: null });
    await expect(investigateIncident(incident, "test-only-key", fetcher)).resolves.toMatchObject({
      status: "unavailable",
      safeToResolve: false,
    });
  });
});
