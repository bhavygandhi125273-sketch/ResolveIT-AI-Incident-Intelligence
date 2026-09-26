import { describe, expect, it } from "vitest";
import { normalizeCategory, normalizeUrgency } from "./normalize";

describe("incident value normalization", () => {
  it("maps category words and labels to ResolveIT categories", () => {
    expect(normalizeCategory("network")).toBe("NETWORK_CONNECTIVITY");
    expect(normalizeCategory("Network connectivity")).toBe("NETWORK_CONNECTIVITY");
    expect(normalizeCategory("Email & Collaboration")).toBe("EMAIL_COLLABORATION");
    expect(normalizeCategory("software-application")).toBe("SOFTWARE_APPLICATIONS");
    expect(normalizeCategory("VPN")).toBe("NETWORK_CONNECTIVITY");
    expect(normalizeCategory("ACCOUNT_ACCESS")).toBe("ACCOUNT_ACCESS");
  });

  it("maps urgency words consistently", () => {
    expect(normalizeUrgency("low priority")).toBe("LOW");
    expect(normalizeUrgency("Moderate")).toBe("MEDIUM");
    expect(normalizeUrgency("urgent")).toBe("HIGH");
    expect(normalizeUrgency("HIGH_URGENCY")).toBe("HIGH");
    expect(normalizeUrgency("emergency")).toBe("CRITICAL");
    expect(normalizeUrgency("critical severity")).toBe("CRITICAL");
  });

  it("leaves unknown values for validation to reject", () => {
    expect(normalizeCategory("printer ink colour")).toBe("printer ink colour");
    expect(normalizeUrgency("whenever")).toBe("whenever");
    expect(normalizeUrgency(null)).toBeNull();
  });
});
