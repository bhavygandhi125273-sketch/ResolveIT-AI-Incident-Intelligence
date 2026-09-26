import { describe, expect, it } from "vitest";
import { decideIncident, type InvestigationResult } from "./engine";

const noInvestigation: InvestigationResult = {
  status: "not_configured",
  summary: null,
  possibleCause: null,
  impact: null,
  recommendedSteps: [],
  safeToResolve: false,
  recommendedResolution: null,
  requiresHumanIntervention: false,
  humanInterventionReason: null,
  missingInformation: [],
};

const complete = (overrides: Partial<InvestigationResult> = {}): InvestigationResult => ({
  ...noInvestigation,
  status: "complete",
  summary: "Assessment.",
  ...overrides,
});

describe("deterministic incident decision engine", () => {
  it("escalates critical incidents even when AI suggests a remedy", () => {
    expect(decideIncident({ severity: "CRITICAL" }, complete({
      safeToResolve: true,
      recommendedResolution: "Restart the application.",
    })).action).toBe("ESCALATE_TO_HUMAN");
  });

  it("does not escalate HIGH or MEDIUM automatically when the AI finds no need for a human", () => {
    expect(decideIncident({ severity: "HIGH" }, complete()).action).toBe("CREATE_PRIORITIZED_TICKET");
    expect(decideIncident({ severity: "MEDIUM" }, complete()).action).toBe("CREATE_PRIORITIZED_TICKET");
  });

  it("escalates HIGH or MEDIUM when the AI judges human intervention is required, with an explanation", () => {
    const decision = decideIncident({ severity: "MEDIUM" }, complete({
      requiresHumanIntervention: true,
      humanInterventionReason: "Possible security compromise.",
    }));
    expect(decision.action).toBe("ESCALATE_TO_HUMAN");
    expect(decision.explanation).toContain("Possible security compromise.");
  });

  it("fails safe: HIGH escalates when the AI assessment is unavailable, MEDIUM is prioritized", () => {
    expect(decideIncident({ severity: "HIGH" }, noInvestigation).action).toBe("ESCALATE_TO_HUMAN");
    expect(decideIncident({ severity: "MEDIUM" }, noInvestigation).action).toBe("CREATE_PRIORITIZED_TICKET");
    expect(decideIncident({ severity: "MEDIUM", humanAssistanceRequested: true }, noInvestigation).action).toBe("ESCALATE_TO_HUMAN");
  });

  it("offers a low-severity resolution only when investigation is complete and safe", () => {
    expect(decideIncident({ severity: "LOW" }, complete({
      safeToResolve: true,
      recommendedResolution: "Reconnect to the office Wi-Fi.",
    }))).toMatchObject({ action: "OFFER_RESOLUTION", resolution: "Reconnect to the office Wi-Fi." });
  });

  it("routes unresolved or uninvestigated low-severity incidents to a normal ticket", () => {
    expect(decideIncident({ severity: "LOW" }, noInvestigation).action).toBe("CREATE_TICKET");
    expect(decideIncident({ severity: "LOW" }, complete({ safeToResolve: true })).action).toBe("CREATE_TICKET");
    expect(decideIncident({ severity: "LOW" }, complete({ requiresHumanIntervention: true })).action).toBe("CREATE_TICKET");
  });
});
