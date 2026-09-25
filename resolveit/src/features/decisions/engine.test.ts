import { describe, expect, it } from "vitest";
import { decideIncident } from "./engine";

const noInvestigation = {
  status: "not_configured" as const,
  summary: null,
  safeToResolve: false,
  recommendedResolution: null,
  missingInformation: [],
};

describe("deterministic incident decision engine", () => {
  it("escalates critical incidents even when AI suggests a remedy", () => {
    expect(decideIncident({ severity: "CRITICAL" }, {
      status: "complete",
      summary: "A suggestion exists.",
      safeToResolve: true,
      recommendedResolution: "Restart the application.",
      missingInformation: [],
    }).action).toBe("ESCALATE_TO_HUMAN");
  });

  it("prioritizes high and medium incidents without relying on AI", () => {
    expect(decideIncident({ severity: "HIGH" }, noInvestigation).action).toBe("CREATE_PRIORITIZED_TICKET");
    expect(decideIncident({ severity: "MEDIUM" }, noInvestigation).action).toBe("CREATE_PRIORITIZED_TICKET");
  });

  it("offers a low-severity resolution only when investigation is complete and safe", () => {
    expect(decideIncident({ severity: "LOW" }, {
      status: "complete",
      summary: "A safe step is available.",
      safeToResolve: true,
      recommendedResolution: "Reconnect to the office Wi-Fi.",
      missingInformation: [],
    })).toMatchObject({ action: "OFFER_RESOLUTION", resolution: "Reconnect to the office Wi-Fi." });
  });

  it("routes unresolved or uninvestigated low-severity incidents to a normal ticket", () => {
    expect(decideIncident({ severity: "LOW" }, noInvestigation).action).toBe("CREATE_TICKET");
    expect(decideIncident({ severity: "LOW" }, {
      ...noInvestigation,
      status: "complete",
      safeToResolve: true,
    }).action).toBe("CREATE_TICKET");
  });
});
