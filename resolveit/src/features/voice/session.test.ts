import { describe, expect, it, vi } from "vitest";
import { processIncidentDraft } from "./session";
import { IncompleteVoiceDraftError } from "./submission";
import { IncidentApiError } from "@/features/incidents/client";
import { makeIncident } from "@/testing/fixtures";
import type { IncidentWorkflow } from "@/features/decisions/engine";

const draft = { title: "Laptop screen flickers" };

describe("voice draft processing", () => {
  it("creates the ticket automatically and scripts a closing message with the reference", async () => {
    const submit = vi.fn().mockResolvedValue({ incident: makeIncident({ reference: "INC-000042" }) });
    const outcome = await processIncidentDraft(draft, "Employee: my screen flickers", { submit });

    expect(submit).toHaveBeenCalledWith({ ...draft, transcript: "Employee: my screen flickers" });
    expect(outcome.kind).toBe("created");
    if (outcome.kind === "created") {
      expect(outcome.speech).toContain("I N C 4 2");
      expect(outcome.speech).toContain("has been created");
    }
  });

  it("explains browser escalation without a phone number or a transfer claim", async () => {
    const workflow = { decision: { action: "ESCALATE_TO_HUMAN" } } as IncidentWorkflow;
    const submit = vi.fn().mockResolvedValue({ incident: makeIncident({ status: "ESCALATED" }), workflow });

    const outcome = await processIncidentDraft(draft, "", { submit });

    expect(outcome.kind === "created" && outcome.speech).toContain("escalated it to the IT support team");
    expect(outcome.kind === "created" && outcome.speech).not.toMatch(/call IT|\d{3}|transferr/i);
  });

  it("asks the agent to collect missing details instead of dead-ending", async () => {
    const submit = vi.fn().mockRejectedValue(new IncompleteVoiceDraftError(["affectedUsers", "businessImpact"]));
    const outcome = await processIncidentDraft(draft, "", { submit });

    expect(outcome.kind).toBe("needs-info");
    if (outcome.kind === "needs-info") {
      expect(outcome.fields).toEqual(["affectedUsers", "businessImpact"]);
      expect(outcome.instruction).toContain("how many people are affected");
      expect(outcome.instruction).toContain("call prepare_incident again");
    }
  });

  it("treats unreadable tool arguments as a retry, not a failure", async () => {
    const submit = vi.fn();
    const outcome = await processIncidentDraft(null, "", { submit });
    expect(outcome.kind).toBe("needs-info");
    expect(submit).not.toHaveBeenCalled();
  });

  it("maps server validation errors back to fields the agent can fix", async () => {
    const submit = vi.fn().mockRejectedValue(new IncidentApiError("invalid", 400, [{ field: "title", message: "short" }]));
    const outcome = await processIncidentDraft(draft, "", { submit });
    expect(outcome).toMatchObject({ kind: "needs-info", fields: ["title"] });
  });

  it("reports system failures and an expired session clearly", async () => {
    const down = await processIncidentDraft(draft, "", { submit: vi.fn().mockRejectedValue(new IncidentApiError("down", 500)) });
    const expired = await processIncidentDraft(draft, "", { submit: vi.fn().mockRejectedValue(new IncidentApiError("auth", 401)) });
    expect(down).toMatchObject({ kind: "failed", message: expect.stringContaining("manual report") });
    expect(expired).toMatchObject({ kind: "failed", message: expect.stringContaining("Sign in again") });
  });
});
