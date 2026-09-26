import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createPostgresIncidentRepository } from "./postgresRepository";
import type { CreateIncidentInput } from "./validation";
import type { IncidentDecision, InvestigationResult } from "@/features/decisions/engine";

const input: CreateIncidentInput = {
  title: "Office Wi-Fi is unavailable",
  description: "My laptop cannot connect to the office wireless network.",
  category: "NETWORK_CONNECTIVITY",
  affectedUsers: 3,
  businessImpact: "The design team cannot access shared project files.",
  urgency: "MEDIUM",
};

const row = {
  id: "incident-id",
  reference_number: "42",
  title: input.title,
  description: input.description,
  category: "NETWORK_CONNECTIVITY",
  status: "OPEN",
  severity: "MEDIUM",
  affected_users: 3,
  business_impact: input.businessImpact,
  urgency: "MEDIUM",
  source: "manual",
  affected_system: null,
  symptoms: null,
  started_at: null,
  currently_affected: null,
  error_messages: [],
  troubleshooting_attempted: [],
  additional_context: null,
  human_assistance_requested: false,
  transcript: null,
  caller_phone: null,
  requester_id: "employee-id",
  requester_name: "ResolveIT Employee",
  assigned_to: null,
  assignee_name: null,
  escalated_at: null,
  escalation_reason: null,
  created_at: new Date("2026-09-24T12:00:00.000Z"),
  updated_at: new Date("2026-09-24T12:00:00.000Z"),
};

const investigation: InvestigationResult = {
  status: "complete",
  summary: "Possible account compromise.",
  possibleCause: "Phishing.",
  impact: "One user locked out.",
  recommendedSteps: ["Reset credentials."],
  safeToResolve: false,
  recommendedResolution: null,
  requiresHumanIntervention: true,
  humanInterventionReason: "Security incident.",
  missingInformation: [],
};

function makePool(clientQuery = vi.fn().mockResolvedValue({ rows: [] })) {
  const query = vi.fn().mockResolvedValue({ rows: [row] });
  const client = { query: clientQuery, release: vi.fn() };
  const pool = { query, connect: vi.fn().mockResolvedValue(client) } as unknown as Pool;
  return { pool, query, client };
}

describe("PostgreSQL incident repository", () => {
  it("inserts parameterized input with the requester, records a CREATED event, and maps the result", async () => {
    const { pool, query } = makePool();
    const repository = createPostgresIncidentRepository(pool);

    const result = await repository.create(input, "MEDIUM", "employee-id");

    const sql = query.mock.calls[0][0] as string;
    expect(sql).toContain("INSERT INTO incidents");
    expect(sql).toContain("INSERT INTO incident_events");
    expect(sql).toContain("'CREATED'");
    expect(query.mock.calls[0][1]).toEqual([
      input.title, input.description, input.category, "MEDIUM", input.affectedUsers, input.businessImpact, input.urgency,
      "manual", null, null, null, null, [], [], null, "employee-id", null, false, null, null,
    ]);
    expect(result).toMatchObject({
      id: "incident-id",
      reference: "INC-000042",
      status: "OPEN",
      affectedUsers: 3,
      requester: { id: "employee-id", displayName: "ResolveIT Employee" },
      assignee: null,
      createdAt: "2026-09-24T12:00:00.000Z",
    });
  });

  it("records the phone source, call ID, and caller number for phone incidents", async () => {
    const { pool, query } = makePool();
    const repository = createPostgresIncidentRepository(pool);

    await repository.create({ ...input, source: "voice" }, "MEDIUM", undefined, { callId: "call-1", callerPhone: "+14155550100" });

    const params = query.mock.calls[0][1] as unknown[];
    expect(params[7]).toBe("phone");
    expect(params.slice(-2)).toEqual(["call-1", "+14155550100"]);
  });

  it("filters with parameters, clamps the limit, and uses an allow-listed sort", async () => {
    const { pool, query } = makePool();
    const repository = createPostgresIncidentRepository(pool);

    await repository.list({ requesterId: "employee-id", status: "OPEN", assignee: "unassigned", sort: "priority", limit: 1000 });

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain("i.requester_id = $1");
    expect(sql).toContain("i.status = $2");
    expect(sql).toContain("i.assigned_to IS NULL");
    expect(sql).toMatch(/ORDER BY \(i.status = 'RESOLVED'\), CASE i.severity/);
    expect(sql).toContain("LIMIT $3");
    expect(params).toEqual(["employee-id", "OPEN", 200]);
  });

  it("stores the investigation and escalates an open incident in one transaction", async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) =>
      Promise.resolve({ rows: sql.startsWith("SELECT status") ? [{ status: "OPEN" }] : [] }));
    const { pool, client } = makePool(clientQuery);
    const repository = createPostgresIncidentRepository(pool);
    const decision: IncidentDecision = { action: "ESCALATE_TO_HUMAN", severity: "HIGH", explanation: "Needs a human.", resolution: null };

    await repository.recordWorkflow("incident-id", investigation, decision);

    const statements = clientQuery.mock.calls.map(([sql]) => (sql as string).trim().split(/\s+/).slice(0, 3).join(" "));
    expect(statements[0]).toBe("BEGIN");
    expect(statements).toContain("INSERT INTO incident_investigations");
    expect(clientQuery.mock.calls.some(([sql]) => (sql as string).includes("status = 'ESCALATED'"))).toBe(true);
    expect(clientQuery.mock.calls.some(([sql]) => (sql as string).includes("'ESCALATED', $2, 'ESCALATED'"))).toBe(true);
    expect(statements.at(-1)).toBe("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("does not change status when the decision is not an escalation", async () => {
    const clientQuery = vi.fn().mockResolvedValue({ rows: [] });
    const { pool } = makePool(clientQuery);
    const repository = createPostgresIncidentRepository(pool);

    await repository.recordWorkflow("incident-id", investigation, { action: "CREATE_TICKET", severity: "LOW", explanation: "Ticket.", resolution: null });

    expect(clientQuery.mock.calls.some(([sql]) => (sql as string).includes("UPDATE incidents"))).toBe(false);
  });

  it("rolls back and releases the connection when a write fails", async () => {
    const clientQuery = vi.fn().mockImplementation((sql: string) =>
      sql.includes("INSERT INTO incident_investigations") ? Promise.reject(new Error("write failed")) : Promise.resolve({ rows: [] }));
    const { pool, client } = makePool(clientQuery);
    const repository = createPostgresIncidentRepository(pool);

    await expect(repository.recordWorkflow("incident-id", investigation, { action: "CREATE_TICKET", severity: "LOW", explanation: "x", resolution: null }))
      .rejects.toThrow("write failed");
    expect(clientQuery).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  it("only returns internal events when asked to", async () => {
    const { pool, query } = makePool();
    const repository = createPostgresIncidentRepository(pool);
    query.mockResolvedValueOnce({ rows: [] });

    await repository.listEvents("incident-id", false);

    expect(query.mock.calls[0][0]).toContain("($2::boolean OR e.visibility = 'PUBLIC')");
    expect(query.mock.calls[0][1]).toEqual(["incident-id", false]);
  });

  it("maps aggregate database counts to the dashboard summary", async () => {
    const { pool, query } = makePool();
    query.mockResolvedValueOnce({ rows: [{ total: "8", open: "5", critical: "1", high_priority: "2", investigating: "1", escalated: "1", resolved: "3", unassigned: "4" }] });
    const repository = createPostgresIncidentRepository(pool);

    await expect(repository.getSummary()).resolves.toEqual({
      total: 8, open: 5, critical: 1, highPriority: 2, investigating: 1, escalated: 1, resolved: 3, unassigned: 4,
    });
    expect(query.mock.calls[0][0]).toContain("COUNT(*) FILTER");
  });
});
