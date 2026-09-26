import "server-only";
import type { Pool } from "pg";
import type { IncidentRepository } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type {
  Incident,
  IncidentCategory,
  IncidentSeverity,
  IncidentStatus,
  IncidentSummary,
  IncidentUrgency,
} from "./types";

type IncidentRow = {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  severity: IncidentSeverity;
  affected_users: number;
  business_impact: string;
  urgency: IncidentUrgency;
  source: "manual" | "voice";
  affected_system: string | null;
  symptoms: string | null;
  started_at: string | null;
  currently_affected: boolean | null;
  error_messages: string[];
  troubleshooting_attempted: string[];
  transcript: string | null;
  created_at: Date;
  updated_at: Date;
};

function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    status: row.status,
    severity: row.severity,
    affectedUsers: row.affected_users,
    businessImpact: row.business_impact,
    urgency: row.urgency,
    source: row.source,
    affectedSystem: row.affected_system,
    symptoms: row.symptoms,
    startedAt: row.started_at,
    currentlyAffected: row.currently_affected,
    errorMessages: row.error_messages,
    troubleshootingAttempted: row.troubleshooting_attempted,
    transcript: row.transcript,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

const incidentColumns = `
  id, title, description, category, status, severity, affected_users,
  business_impact, urgency, source, affected_system, symptoms, started_at,
  currently_affected, error_messages, troubleshooting_attempted, transcript,
  created_at, updated_at
`;

export function createPostgresIncidentRepository(
  pool: Pool,
): IncidentRepository {
  return {
    async create(
      input: CreateIncidentInput,
      severity: IncidentSeverity,
      requesterId?: string,
    ): Promise<Incident> {
      const result = await pool.query<IncidentRow>(
        `INSERT INTO incidents
          (title, description, category, severity, affected_users, business_impact, urgency,
           source, affected_system, symptoms, started_at, currently_affected, error_messages,
           troubleshooting_attempted, transcript, requester_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING ${incidentColumns}`,
        [
          input.title,
          input.description,
          input.category,
          severity,
          input.affectedUsers,
          input.businessImpact,
          input.urgency,
          input.source ?? "manual",
          input.affectedSystem ?? null,
          input.symptoms ?? null,
          input.startedAt ?? null,
          input.currentlyAffected ?? null,
          input.errorMessages ?? [],
          input.troubleshootingAttempted ?? [],
          input.transcript ?? null,
          requesterId ?? null,
        ],
      );

      return toIncident(result.rows[0]);
    },

    async listRecent(
      limit = 50,
      requesterId?: string,
    ): Promise<Incident[]> {
      const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100);

      const result = requesterId
        ? await pool.query<IncidentRow>(
            `SELECT ${incidentColumns}
             FROM incidents
             WHERE requester_id = $1
             ORDER BY created_at DESC
             LIMIT $2`,
            [requesterId, safeLimit],
          )
        : await pool.query<IncidentRow>(
            `SELECT ${incidentColumns}
             FROM incidents
             ORDER BY created_at DESC
             LIMIT $1`,
            [safeLimit],
          );

      return result.rows.map(toIncident);
    },

    async getById(
      id: string,
      requesterId?: string,
    ): Promise<Incident | null> {
      const result = requesterId
        ? await pool.query<IncidentRow>(
            `SELECT ${incidentColumns}
             FROM incidents
             WHERE id = $1 AND requester_id = $2`,
            [id, requesterId],
          )
        : await pool.query<IncidentRow>(
            `SELECT ${incidentColumns}
             FROM incidents
             WHERE id = $1`,
            [id],
          );

      return result.rows[0] ? toIncident(result.rows[0]) : null;
    },

    async updateStatus(
      id: string,
      status: IncidentStatus,
    ): Promise<Incident | null> {
      const result = await pool.query<IncidentRow>(
        `UPDATE incidents
         SET status = $2, updated_at = now()
         WHERE id = $1
         RETURNING ${incidentColumns}`,
        [id, status],
      );

      return result.rows[0] ? toIncident(result.rows[0]) : null;
    },

    async getSummary(): Promise<IncidentSummary> {
      const result = await pool.query<{
        total: string;
        open: string;
        high_priority: string;
        resolved: string;
      }>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (
             WHERE status IN ('OPEN', 'INVESTIGATING', 'ESCALATED')
           ) AS open,
           COUNT(*) FILTER (
             WHERE severity IN ('HIGH', 'CRITICAL')
           ) AS high_priority,
           COUNT(*) FILTER (
             WHERE status = 'RESOLVED'
           ) AS resolved
         FROM incidents`,
      );

      const row = result.rows[0];

      return {
        total: Number(row.total),
        open: Number(row.open),
        highPriority: Number(row.high_priority),
        resolved: Number(row.resolved),
      };
    },
  };
}