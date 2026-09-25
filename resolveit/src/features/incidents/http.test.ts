import { describe, expect, it, vi } from "vitest";
import { handleCreateIncident, handleListIncidents } from "./http";
import type { IncidentService } from "./service";
import type { Incident, IncidentCategory } from "./types";
import type { CreateIncidentInput } from "./validation";

const validInput = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "MEDIUM",
} satisfies CreateIncidentInput;

const savedIncident: Incident = {
  id: "incident-id",
  ...validInput,
  category: "NETWORK_CONNECTIVITY" as IncidentCategory,
  status: "OPEN",
  severity: "MEDIUM",
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

function makeService(overrides: Partial<IncidentService> = {}): IncidentService {
  return {
    create: vi.fn().mockResolvedValue(savedIncident),
    listRecent: vi.fn().mockResolvedValue([]),
    getSummary: vi.fn().mockResolvedValue({ total: 0, open: 0, highPriority: 0, resolved: 0 }),
    ...overrides,
  };
}

function post(body: unknown): Request {
  return new Request("http://localhost/api/incidents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("incident API handlers", () => {
  it("returns a structured incident with HTTP 201", async () => {
    const service = makeService();
    const response = await handleCreateIncident(post(validInput), service);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: savedIncident });
    expect(service.create).toHaveBeenCalledWith(validInput);
  });

  it("adds investigation and decision results without delegating actions to the investigator", async () => {
    const service = makeService();
    const analyze = vi.fn().mockResolvedValue({
      investigation: { status: "not_configured", safeToResolve: false },
      decision: { action: "CREATE_PRIORITIZED_TICKET", severity: "MEDIUM" },
    });
    const response = await handleCreateIncident(post(validInput), service, analyze);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(analyze).toHaveBeenCalledWith(savedIncident);
    expect(body.workflow.decision.action).toBe("CREATE_PRIORITIZED_TICKET");
  });

  it("returns field details and does not call the service for invalid or missing data", async () => {
    const service = makeService();
    const response = await handleCreateIncident(post({ title: "short" }), service);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: "description" })]));
    expect(service.create).not.toHaveBeenCalled();
  });

  it("returns a generic server error without leaking internal details", async () => {
    const service = makeService({ create: vi.fn().mockRejectedValue(new Error("sensitive database details")) });
    const response = await handleCreateIncident(post(validInput), service);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.message).toBe("We could not save your incident. Please try again.");
    expect(JSON.stringify(body)).not.toContain("sensitive database details");
  });

  it("returns the current incident list", async () => {
    const service = makeService({ listRecent: vi.fn().mockResolvedValue([savedIncident]) });
    const response = await handleListIncidents(service);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [savedIncident] });
  });
});
