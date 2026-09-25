import { describe, expect, it, vi } from "vitest";
import { createIncidentService } from "./service";
import type { IncidentRepository } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type { Incident } from "./types";

const input: CreateIncidentInput = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "HIGH",
};

const savedIncident: Incident = {
  id: "incident-id",
  ...input,
  status: "OPEN",
  severity: "HIGH",
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

describe("incident service", () => {
  it("applies the deterministic intake severity rule and delegates persistence", async () => {
    const repository: IncidentRepository = {
      create: vi.fn().mockResolvedValue(savedIncident),
      listRecent: vi.fn().mockResolvedValue([]),
      getSummary: vi.fn().mockResolvedValue({ total: 0, open: 0, highPriority: 0, resolved: 0 }),
    };
    const service = createIncidentService(repository);

    await expect(service.create(input)).resolves.toEqual(savedIncident);
    expect(repository.create).toHaveBeenCalledWith(input, "HIGH");
  });

  it("delegates recent incident listing to the repository", async () => {
    const repository: IncidentRepository = {
      create: vi.fn(),
      listRecent: vi.fn().mockResolvedValue([savedIncident]),
      getSummary: vi.fn().mockResolvedValue({ total: 1, open: 1, highPriority: 1, resolved: 0 }),
    };
    const service = createIncidentService(repository);

    await expect(service.listRecent()).resolves.toEqual([savedIncident]);
  });

  it("delegates summary counts to the repository", async () => {
    const summary = { total: 2, open: 1, highPriority: 1, resolved: 1 };
    const repository: IncidentRepository = {
      create: vi.fn(),
      listRecent: vi.fn(),
      getSummary: vi.fn().mockResolvedValue(summary),
    };
    const service = createIncidentService(repository);

    await expect(service.getSummary()).resolves.toEqual(summary);
  });
});
