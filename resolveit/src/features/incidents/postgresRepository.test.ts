import { describe, expect, it, vi } from "vitest";
import type { Pool } from "pg";
import { createPostgresIncidentRepository } from "./postgresRepository";
import type { CreateIncidentInput } from "./validation";

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
  ...input,
  category: "NETWORK_CONNECTIVITY",
  status: "OPEN",
  severity: "MEDIUM",
  affected_users: 3,
  business_impact: input.businessImpact,
  source: "manual",
  affected_system: null,
  symptoms: null,
  started_at: null,
  currently_affected: null,
  error_messages: [],
  troubleshooting_attempted: [],
  transcript: null,
  created_at: new Date("2026-09-24T12:00:00.000Z"),
  updated_at: new Date("2026-09-24T12:00:00.000Z"),
};

describe("PostgreSQL incident repository", () => {
  it("inserts parameterized input and maps the database record to the API model", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = createPostgresIncidentRepository({ query } as unknown as Pool);

    const result = await repository.create(input, "MEDIUM");

    expect(query.mock.calls[0][0]).toContain("INSERT INTO incidents");
    expect(query.mock.calls[0][0]).toContain("VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)");
    expect(query.mock.calls[0][1]).toEqual([
      input.title, input.description, input.category, "MEDIUM", input.affectedUsers, input.businessImpact, input.urgency,
      "manual", null, null, null, null, [], [], null,
    ]);
    expect(result).toMatchObject({
      id: "incident-id",
      status: "OPEN",
      affectedUsers: 3,
      businessImpact: input.businessImpact,
      createdAt: "2026-09-24T12:00:00.000Z",
    });
  });

  it("lists the newest incidents and clamps the query limit", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] });
    const repository = createPostgresIncidentRepository({ query } as unknown as Pool);

    const result = await repository.listRecent(1000);

    expect(query.mock.calls[0][0]).toContain("ORDER BY created_at DESC LIMIT $1");
    expect(query.mock.calls[0][1]).toEqual([100]);
    expect(result[0].category).toBe("NETWORK_CONNECTIVITY");
  });

  it("maps aggregate database counts to the dashboard summary", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ total: "8", open: "5", high_priority: "2", resolved: "3" }] });
    const repository = createPostgresIncidentRepository({ query } as unknown as Pool);

    await expect(repository.getSummary()).resolves.toEqual({ total: 8, open: 5, highPriority: 2, resolved: 3 });
    expect(query.mock.calls[0][0]).toContain("COUNT(*) FILTER");
  });
});
