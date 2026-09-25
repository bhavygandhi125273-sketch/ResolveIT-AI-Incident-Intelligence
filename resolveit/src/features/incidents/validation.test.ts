import { describe, expect, it } from "vitest";
import { CreateIncidentSchema } from "./validation";

const validIncident = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "MEDIUM",
};

describe("CreateIncidentSchema", () => {
  it("accepts and normalizes valid incident intake", () => {
    expect(CreateIncidentSchema.parse({ ...validIncident, title: "  Office Wi-Fi is unavailable  " }).title)
      .toBe("Office Wi-Fi is unavailable");
  });

  it("rejects unsupported categories, invalid counts, and unknown fields", () => {
    const result = CreateIncidentSchema.safeParse({ ...validIncident, category: "UNSUPPORTED", affectedUsers: 0, severity: "CRITICAL" });
    expect(result.success).toBe(false);
  });

  it("reports missing required fields", () => {
    const result = CreateIncidentSchema.safeParse({ title: "A long enough title" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toContain("description");
      expect(fields).toContain("category");
      expect(fields).toContain("urgency");
      expect(fields).toContain("affectedUsers");
      expect(fields).toContain("businessImpact");
    }
  });
});
