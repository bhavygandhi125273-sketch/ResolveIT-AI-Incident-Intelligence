import { describe, expect, it, vi } from "vitest";
import { createIncidentService, InvalidAssigneeError, requesterScope } from "./service";
import type { CreateIncidentInput } from "./validation";
import { makeIncident, makeRepository } from "@/testing/fixtures";

const input: CreateIncidentInput = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "HIGH",
};

const savedIncident = makeIncident({ ...input, severity: "HIGH" });
const employee = { id: "employee-id", role: "EMPLOYEE" as const };
const admin = { id: "admin-id", role: "IT_ADMIN" as const };

describe("incident service", () => {
  it("applies the deterministic intake severity rule and delegates persistence with the requester", async () => {
    const repository = makeRepository({ create: vi.fn().mockResolvedValue(savedIncident) });
    const service = createIncidentService(repository);

    await expect(service.create(input, "employee-id")).resolves.toEqual(savedIncident);
    expect(repository.create).toHaveBeenCalledWith(input, "HIGH", "employee-id");
  });

  it("delegates incident listing to the repository", async () => {
    const repository = makeRepository({ list: vi.fn().mockResolvedValue([savedIncident]) });
    const service = createIncidentService(repository);

    await expect(service.list({ sort: "newest" })).resolves.toEqual([savedIncident]);
    expect(repository.list).toHaveBeenCalledWith({ sort: "newest" });
  });

  it("scopes employees to their own incidents and gives IT staff full scope", () => {
    expect(requesterScope(employee)).toBe("employee-id");
    expect(requesterScope(admin)).toBeUndefined();
  });

  it("hides internal events from employees and another employee's incident entirely", async () => {
    const repository = makeRepository({ getById: vi.fn().mockResolvedValue(savedIncident) });
    const service = createIncidentService(repository);

    await service.getDetail(savedIncident.id, employee);
    expect(repository.getById).toHaveBeenCalledWith(savedIncident.id, "employee-id");
    expect(repository.listEvents).toHaveBeenCalledWith(savedIncident.id, false);

    await service.getDetail(savedIncident.id, admin);
    expect(repository.getById).toHaveBeenLastCalledWith(savedIncident.id, undefined);
    expect(repository.listEvents).toHaveBeenLastCalledWith(savedIncident.id, true);

    const notOwned = createIncidentService(makeRepository());
    await expect(notOwned.getDetail(savedIncident.id, employee)).resolves.toBeNull();
  });

  it("only assigns incidents to IT staff", async () => {
    const repository = makeRepository({
      listItStaff: vi.fn().mockResolvedValue([{ id: "admin-id", displayName: "IT Admin" }]),
      assign: vi.fn().mockResolvedValue(savedIncident),
    });
    const service = createIncidentService(repository);

    await expect(service.assign(savedIncident.id, "employee-id", "admin-id")).rejects.toBeInstanceOf(InvalidAssigneeError);
    expect(repository.assign).not.toHaveBeenCalled();

    await service.assign(savedIncident.id, "admin-id", "admin-id");
    expect(repository.assign).toHaveBeenCalledWith(savedIncident.id, "admin-id", "admin-id");

    await service.assign(savedIncident.id, null, "admin-id");
    expect(repository.assign).toHaveBeenLastCalledWith(savedIncident.id, null, "admin-id");
  });

  it("delegates summary counts to the repository", async () => {
    const summary = { total: 2, open: 1, critical: 0, highPriority: 1, investigating: 0, escalated: 0, resolved: 1, unassigned: 1 };
    const repository = makeRepository({ getSummary: vi.fn().mockResolvedValue(summary) });
    const service = createIncidentService(repository);

    await expect(service.getSummary()).resolves.toEqual(summary);
  });
});
