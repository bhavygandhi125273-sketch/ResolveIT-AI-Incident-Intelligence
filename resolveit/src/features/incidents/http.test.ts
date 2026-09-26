import { describe, expect, it, vi } from "vitest";
import { handleCreateIncident, handleListIncidents, handleUpdateIncident } from "./http";
import { createIncidentService } from "./service";
import type { CreateIncidentInput } from "./validation";
import { makeIncident, makeRepository } from "@/testing/fixtures";
import type { IncidentWorkflow } from "@/features/decisions/engine";

const validInput = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "MEDIUM",
} satisfies CreateIncidentInput;

const savedIncident = makeIncident(validInput);
const incidentId = savedIncident.id;

function makeService(repositoryOverrides: Parameters<typeof makeRepository>[0] = {}) {
  const repository = makeRepository({
    create: vi.fn().mockResolvedValue(savedIncident),
    ...repositoryOverrides,
  });
  return { repository, service: createIncidentService(repository) };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/incidents", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const workflow = {
  investigation: { status: "not_configured", safeToResolve: false },
  decision: { action: "ESCALATE_TO_HUMAN", severity: "MEDIUM" },
} as unknown as IncidentWorkflow;

describe("incident API handlers", () => {
  it("returns a structured incident with HTTP 201 and stores the authenticated requester", async () => {
    const { service, repository } = makeService();
    const response = await handleCreateIncident(jsonRequest("POST", validInput), service, undefined, "employee-id");
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ success: true, data: savedIncident });
    expect(repository.create).toHaveBeenCalledWith(validInput, "MEDIUM", "employee-id");
  });

  it("rejects a browser-supplied requester or severity", async () => {
    const { service, repository } = makeService();
    const response = await handleCreateIncident(jsonRequest("POST", { ...validInput, requesterId: "someone-else", severity: "LOW" }), service);
    expect(response.status).toBe(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns the analyzed incident and workflow decision", async () => {
    const { service } = makeService();
    const escalated = makeIncident({ ...validInput, status: "ESCALATED" });
    const analyze = vi.fn().mockResolvedValue({ incident: escalated, workflow });
    const response = await handleCreateIncident(jsonRequest("POST", validInput), service, analyze);
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(analyze).toHaveBeenCalledWith(savedIncident);
    expect(body.data.status).toBe("ESCALATED");
    expect(body.workflow.decision.action).toBe("ESCALATE_TO_HUMAN");
  });

  it("still reports success when analysis fails after the incident is saved", async () => {
    const { service } = makeService();
    const analyze = vi.fn().mockRejectedValue(new Error("analysis down"));
    const response = await handleCreateIncident(jsonRequest("POST", validInput), service, analyze);
    expect(response.status).toBe(201);
    expect((await response.json()).data).toEqual(savedIncident);
  });

  it("returns field details and does not call the service for invalid or missing data", async () => {
    const { service, repository } = makeService();
    const response = await handleCreateIncident(jsonRequest("POST", { title: "short" }), service);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field: "description" })]));
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("returns a generic server error without leaking internal details", async () => {
    const { service } = makeService({ create: vi.fn().mockRejectedValue(new Error("sensitive database details")) });
    const response = await handleCreateIncident(jsonRequest("POST", validInput), service);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error.message).toBe("We could not save your incident. Please try again.");
    expect(JSON.stringify(body)).not.toContain("sensitive database details");
  });

  it("returns the current incident list for the given query", async () => {
    const { service, repository } = makeService({ list: vi.fn().mockResolvedValue([savedIncident]) });
    const response = await handleListIncidents(service, { requesterId: "employee-id" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, data: [savedIncident] });
    expect(repository.list).toHaveBeenCalledWith({ requesterId: "employee-id" });
  });
});

describe("IT incident update handler", () => {
  it("changes status and records the acting IT user", async () => {
    const resolved = makeIncident({ status: "RESOLVED" });
    const { service, repository } = makeService({
      getById: vi.fn().mockResolvedValue(savedIncident),
      updateStatus: vi.fn().mockResolvedValue(resolved),
    });
    const response = await handleUpdateIncident(incidentId, jsonRequest("PATCH", { status: "RESOLVED" }), service, "admin-id");
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("RESOLVED");
    expect(repository.updateStatus).toHaveBeenCalledWith(incidentId, "RESOLVED", "admin-id");
  });

  it("adds internal or employee-visible notes", async () => {
    const { service, repository } = makeService({ getById: vi.fn().mockResolvedValue(savedIncident) });
    const response = await handleUpdateIncident(
      incidentId,
      jsonRequest("PATCH", { note: { body: "Checked the access point.", visibility: "INTERNAL" } }),
      service,
      "admin-id",
    );
    expect(response.status).toBe(200);
    expect(repository.addNote).toHaveBeenCalledWith(incidentId, "Checked the access point.", "INTERNAL", "admin-id");
  });

  it("rejects assigning to someone who is not IT staff", async () => {
    const { service, repository } = makeService({ getById: vi.fn().mockResolvedValue(savedIncident) });
    const response = await handleUpdateIncident(
      incidentId,
      jsonRequest("PATCH", { assigneeId: "0b7e3c4a-1d2e-4f5a-8b9c-0d1e2f3a4b5c" }),
      service,
      "admin-id",
    );
    expect(response.status).toBe(400);
    expect(repository.assign).not.toHaveBeenCalled();
  });

  it("rejects empty or unknown updates and returns 404 for missing incidents", async () => {
    const { service } = makeService();
    expect((await handleUpdateIncident(incidentId, jsonRequest("PATCH", {}), service, "admin-id")).status).toBe(400);
    expect((await handleUpdateIncident(incidentId, jsonRequest("PATCH", { severity: "LOW" }), service, "admin-id")).status).toBe(400);
    expect((await handleUpdateIncident(incidentId, jsonRequest("PATCH", { status: "OPEN" }), service, "admin-id")).status).toBe(404);
    expect((await handleUpdateIncident("not-a-uuid", jsonRequest("PATCH", { status: "OPEN" }), service, "admin-id")).status).toBe(400);
  });
});
