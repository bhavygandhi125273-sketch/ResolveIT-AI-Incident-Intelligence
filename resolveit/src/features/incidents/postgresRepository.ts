import "server-only";
import type { Pool, PoolClient } from "pg";
import type { IncidentRepository, PhoneCallOrigin, StoredInvestigation } from "./repository";
import type { CreateIncidentInput } from "./validation";
import type { IncidentListQuery } from "./filters";
import type { IncidentDecision, InvestigationResult } from "@/features/decisions/engine";
import {
  formatIncidentReference,
  type Incident,
  type IncidentCategory,
  type IncidentEvent,
  type IncidentEventType,
  type IncidentSeverity,
  type IncidentStatus,
  type IncidentSummary,
  type IncidentUrgency,
  type NoteVisibility,
} from "./types";

type IncidentRow = {
  id: string;
  reference_number: string | number;
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
  additional_context: string | null;
  human_assistance_requested: boolean;
  transcript: string | null;
  caller_phone: string | null;
  requester_id: string | null;
  requester_name: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  escalated_at: Date | null;
  escalation_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

type EventRow = {
  id: string;
  type: IncidentEventType;
  actor_id: string | null;
  actor_name: string | null;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus | null;
  body: string | null;
  visibility: NoteVisibility;
  created_at: Date;
};

type InvestigationRow = {
  status: InvestigationResult["status"];
  summary: string | null;
  possible_cause: string | null;
  impact: string | null;
  recommended_steps: string[];
  safe_to_resolve: boolean;
  recommended_resolution: string | null;
  requires_human_intervention: boolean;
  human_intervention_reason: string | null;
  missing_information: string[];
  decision_action: IncidentDecision["action"];
  decision_explanation: string;
  decision_resolution: string | null;
  created_at: Date;
};

function toIncident(row: IncidentRow): Incident {
  return {
    id: row.id,
    reference: formatIncidentReference(row.reference_number),
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
    additionalContext: row.additional_context,
    humanAssistanceRequested: row.human_assistance_requested,
    transcript: row.transcript,
    callerPhone: row.caller_phone,
    requester: row.requester_id ? { id: row.requester_id, displayName: row.requester_name ?? "Unknown user" } : null,
    assignee: row.assigned_to ? { id: row.assigned_to, displayName: row.assignee_name ?? "Unknown user" } : null,
    escalatedAt: row.escalated_at?.toISOString() ?? null,
    escalationReason: row.escalation_reason,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toEvent(row: EventRow): IncidentEvent {
  return {
    id: row.id,
    type: row.type,
    actor: row.actor_id ? { id: row.actor_id, displayName: row.actor_name ?? "Unknown user" } : null,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.created_at.toISOString(),
  };
}

/** `source` is either the incidents table or a CTE of freshly inserted/updated incident rows. */
function incidentSelect(source = "incidents") {
  return `
    SELECT i.id, i.reference_number, i.title, i.description, i.category, i.status, i.severity,
      i.affected_users, i.business_impact, i.urgency, i.source, i.affected_system, i.symptoms,
      i.started_at, i.currently_affected, i.error_messages, i.troubleshooting_attempted,
      i.additional_context, i.human_assistance_requested, i.transcript, i.caller_phone,
      i.requester_id, requester.display_name AS requester_name,
      i.assigned_to, assignee.display_name AS assignee_name,
      i.escalated_at, i.escalation_reason, i.created_at, i.updated_at
    FROM ${source} i
    LEFT JOIN users requester ON requester.id = i.requester_id
    LEFT JOIN users assignee ON assignee.id = i.assigned_to`;
}

const severityRank = `CASE i.severity WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END`;

// Fixed allow-list: user input selects a key, never SQL text.
const ORDER_BY: Record<NonNullable<IncidentListQuery["sort"]>, string> = {
  priority: `(i.status = 'RESOLVED'), ${severityRank}, i.created_at DESC`,
  newest: "i.created_at DESC",
  oldest: "i.created_at ASC",
  updated: "i.updated_at DESC",
};

async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function createPostgresIncidentRepository(
  pool: Pool,
): IncidentRepository {
  async function getById(id: string, requesterId?: string): Promise<Incident | null> {
    const result = requesterId
      ? await pool.query<IncidentRow>(`${incidentSelect()} WHERE i.id = $1 AND i.requester_id = $2`, [id, requesterId])
      : await pool.query<IncidentRow>(`${incidentSelect()} WHERE i.id = $1`, [id]);
    return result.rows[0] ? toIncident(result.rows[0]) : null;
  }

  return {
    async create(
      input: CreateIncidentInput,
      severity: IncidentSeverity,
      requesterId?: string,
      phoneCall?: PhoneCallOrigin,
    ): Promise<Incident> {
      // One statement: the incident and its CREATED timeline event are written atomically.
      const result = await pool.query<IncidentRow>(
        `WITH inserted AS (
           INSERT INTO incidents
             (title, description, category, severity, affected_users, business_impact, urgency,
              source, affected_system, symptoms, started_at, currently_affected, error_messages,
              troubleshooting_attempted, transcript, requester_id, additional_context, human_assistance_requested,
              vapi_call_id, caller_phone)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
           RETURNING *
         ), created_event AS (
           INSERT INTO incident_events (incident_id, actor_id, type, to_status)
           SELECT id, requester_id, 'CREATED', status FROM inserted
         )
         ${incidentSelect("inserted")}`,
        [
          input.title,
          input.description,
          input.category,
          severity,
          input.affectedUsers,
          input.businessImpact,
          input.urgency,
          phoneCall ? "phone" : input.source ?? "manual",
          input.affectedSystem ?? null,
          input.symptoms ?? null,
          input.startedAt ?? null,
          input.currentlyAffected ?? null,
          input.errorMessages ?? [],
          input.troubleshootingAttempted ?? [],
          input.transcript ?? null,
          requesterId ?? null,
          input.additionalContext ?? null,
          input.humanAssistanceRequested ?? false,
          phoneCall?.callId ?? null,
          phoneCall?.callerPhone ?? null,
        ],
      );

      return toIncident(result.rows[0]);
    },

    async getByCallId(callId: string): Promise<Incident | null> {
      const result = await pool.query<IncidentRow>(`${incidentSelect()} WHERE i.vapi_call_id = $1`, [callId]);
      return result.rows[0] ? toIncident(result.rows[0]) : null;
    },

    async attachCallTranscript(callId: string, transcript: string): Promise<boolean> {
      const result = await pool.query(
        `UPDATE incidents SET transcript = $2, updated_at = now() WHERE vapi_call_id = $1`,
        [callId, transcript],
      );
      return (result.rowCount ?? 0) > 0;
    },

    async recordCallTransferred(incidentId: string): Promise<void> {
      // The destination number is deliberately not recorded in the timeline.
      await pool.query(
        `INSERT INTO incident_events (incident_id, type, body)
         VALUES ($1, 'CALL_TRANSFERRED', 'Live phone call transferred to IT support.')`,
        [incidentId],
      );
    },

    async findEmployeeIdByPhone(phoneNumber: string): Promise<string | null> {
      const result = await pool.query<{ id: string }>(
        `SELECT id FROM users WHERE phone_number = $1 AND role = 'EMPLOYEE'`,
        [phoneNumber],
      );
      return result.rows[0]?.id ?? null;
    },

    async list(query: IncidentListQuery = {}): Promise<Incident[]> {
      const conditions: string[] = [];
      const params: unknown[] = [];
      const add = (sql: (placeholder: string) => string, value: unknown) => {
        params.push(value);
        conditions.push(sql(`$${params.length}`));
      };

      if (query.requesterId) add((p) => `i.requester_id = ${p}`, query.requesterId);
      if (query.status) add((p) => `i.status = ${p}`, query.status);
      if (query.severity) add((p) => `i.severity = ${p}`, query.severity);
      if (query.category) add((p) => `i.category = ${p}`, query.category);
      if (query.source) add((p) => `i.source = ${p}`, query.source);
      if (query.assignee === "unassigned") conditions.push("i.assigned_to IS NULL");
      else if (query.assignee) add((p) => `i.assigned_to = ${p}`, query.assignee);
      if (query.from) add((p) => `i.created_at >= ${p}::date`, query.from);
      if (query.to) add((p) => `i.created_at < (${p}::date + 1)`, query.to);

      const safeLimit = Math.min(Math.max(Math.trunc(query.limit ?? 50), 1), 200);
      params.push(safeLimit);

      const result = await pool.query<IncidentRow>(
        `${incidentSelect()}
         ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
         ORDER BY ${ORDER_BY[query.sort ?? "newest"]}
         LIMIT $${params.length}`,
        params,
      );

      return result.rows.map(toIncident);
    },

    getById,

    async recordWorkflow(
      incidentId: string,
      investigation: InvestigationResult,
      decision: IncidentDecision,
    ): Promise<Incident | null> {
      await withTransaction(pool, async (client) => {
        await client.query(
          `INSERT INTO incident_investigations
             (incident_id, status, summary, possible_cause, impact, recommended_steps, safe_to_resolve,
              recommended_resolution, requires_human_intervention, human_intervention_reason,
              missing_information, decision_action, decision_explanation, decision_resolution)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            incidentId,
            investigation.status,
            investigation.summary,
            investigation.possibleCause,
            investigation.impact,
            investigation.recommendedSteps,
            investigation.safeToResolve,
            investigation.recommendedResolution,
            investigation.requiresHumanIntervention,
            investigation.humanInterventionReason,
            investigation.missingInformation,
            decision.action,
            decision.explanation,
            decision.resolution,
          ],
        );
        await client.query(
          `INSERT INTO incident_events (incident_id, type, body) VALUES ($1, 'INVESTIGATED', $2)`,
          [incidentId, decision.explanation],
        );

        if (decision.action === "ESCALATE_TO_HUMAN") {
          const previous = await client.query<{ status: IncidentStatus }>(
            `SELECT status FROM incidents WHERE id = $1 FOR UPDATE`,
            [incidentId],
          );
          const fromStatus = previous.rows[0]?.status;
          if (fromStatus === "OPEN" || fromStatus === "INVESTIGATING") {
            await client.query(
              `UPDATE incidents
               SET status = 'ESCALATED', escalated_at = now(), escalation_reason = $2, updated_at = now()
               WHERE id = $1`,
              [incidentId, decision.explanation],
            );
            await client.query(
              `INSERT INTO incident_events (incident_id, type, from_status, to_status, body)
               VALUES ($1, 'ESCALATED', $2, 'ESCALATED', $3)`,
              [incidentId, fromStatus, decision.explanation],
            );
          }
        }
      });

      return getById(incidentId);
    },

    async getLatestInvestigation(incidentId: string): Promise<StoredInvestigation | null> {
      const result = await pool.query<InvestigationRow>(
        `SELECT status, summary, possible_cause, impact, recommended_steps, safe_to_resolve,
                recommended_resolution, requires_human_intervention, human_intervention_reason,
                missing_information, decision_action, decision_explanation, decision_resolution, created_at
         FROM incident_investigations
         WHERE incident_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [incidentId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        status: row.status,
        summary: row.summary,
        possibleCause: row.possible_cause,
        impact: row.impact,
        recommendedSteps: row.recommended_steps,
        safeToResolve: row.safe_to_resolve,
        recommendedResolution: row.recommended_resolution,
        requiresHumanIntervention: row.requires_human_intervention,
        humanInterventionReason: row.human_intervention_reason,
        missingInformation: row.missing_information,
        decision: {
          action: row.decision_action,
          explanation: row.decision_explanation,
          resolution: row.decision_resolution,
        },
        createdAt: row.created_at.toISOString(),
      };
    },

    async updateStatus(
      id: string,
      status: IncidentStatus,
      actorId?: string,
    ): Promise<Incident | null> {
      const found = await withTransaction(pool, async (client) => {
        const previous = await client.query<{ status: IncidentStatus }>(
          `SELECT status FROM incidents WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const fromStatus = previous.rows[0]?.status;
        if (!fromStatus) return false;
        if (fromStatus === status) return true;

        await client.query(
          `UPDATE incidents
           SET status = $2::varchar,
               updated_at = now(),
               escalated_at = CASE WHEN $2::varchar = 'ESCALATED' THEN COALESCE(escalated_at, now()) ELSE escalated_at END
           WHERE id = $1`,
          [id, status],
        );
        await client.query(
          `INSERT INTO incident_events (incident_id, actor_id, type, from_status, to_status)
           VALUES ($1, $2, 'STATUS_CHANGED', $3, $4)`,
          [id, actorId ?? null, fromStatus, status],
        );
        return true;
      });

      return found ? getById(id) : null;
    },

    async assign(
      id: string,
      assigneeId: string | null,
      actorId: string,
    ): Promise<Incident | null> {
      const updated = await withTransaction(pool, async (client) => {
        // Only IT staff can be assignees; the EXISTS guard enforces it at the database boundary.
        const result = await client.query<{ assignee_name: string | null }>(
          `UPDATE incidents
           SET assigned_to = $2, updated_at = now()
           WHERE id = $1
             AND ($2::uuid IS NULL OR EXISTS (SELECT 1 FROM users WHERE id = $2 AND role = 'IT_ADMIN'))
           RETURNING (SELECT display_name FROM users WHERE id = $2) AS assignee_name`,
          [id, assigneeId],
        );
        if (!result.rows[0]) return false;
        await client.query(
          `INSERT INTO incident_events (incident_id, actor_id, type, body)
           VALUES ($1, $2, 'ASSIGNED', $3)`,
          [id, actorId, result.rows[0].assignee_name ? `Assigned to ${result.rows[0].assignee_name}` : "Unassigned"],
        );
        return true;
      });

      return updated ? getById(id) : null;
    },

    async addNote(
      id: string,
      body: string,
      visibility: NoteVisibility,
      actorId: string,
    ): Promise<IncidentEvent | null> {
      const result = await pool.query<EventRow>(
        `WITH touched AS (
           UPDATE incidents SET updated_at = now() WHERE id = $1 RETURNING id
         ), inserted AS (
           INSERT INTO incident_events (incident_id, actor_id, type, body, visibility)
           SELECT id, $2, 'NOTE', $3, $4 FROM touched
           RETURNING *
         )
         SELECT e.id, e.type, e.actor_id, u.display_name AS actor_name, e.from_status, e.to_status,
                e.body, e.visibility, e.created_at
         FROM inserted e
         LEFT JOIN users u ON u.id = e.actor_id`,
        [id, actorId, body, visibility],
      );
      return result.rows[0] ? toEvent(result.rows[0]) : null;
    },

    async listEvents(
      incidentId: string,
      includeInternal: boolean,
    ): Promise<IncidentEvent[]> {
      const result = await pool.query<EventRow>(
        `SELECT e.id, e.type, e.actor_id, u.display_name AS actor_name, e.from_status, e.to_status,
                e.body, e.visibility, e.created_at
         FROM incident_events e
         LEFT JOIN users u ON u.id = e.actor_id
         WHERE e.incident_id = $1 AND ($2::boolean OR e.visibility = 'PUBLIC')
         ORDER BY e.created_at ASC`,
        [incidentId, includeInternal],
      );
      return result.rows.map(toEvent);
    },

    async listItStaff() {
      const result = await pool.query<{ id: string; display_name: string }>(
        `SELECT id, display_name FROM users WHERE role = 'IT_ADMIN' ORDER BY display_name`,
      );
      return result.rows.map((row) => ({ id: row.id, displayName: row.display_name }));
    },

    async getSummary(): Promise<IncidentSummary> {
      const result = await pool.query<Record<keyof IncidentSummary | "high_priority", string>>(
        `SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status <> 'RESOLVED') AS open,
           COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status <> 'RESOLVED') AS critical,
           COUNT(*) FILTER (WHERE severity = 'HIGH' AND status <> 'RESOLVED') AS high_priority,
           COUNT(*) FILTER (WHERE status = 'INVESTIGATING') AS investigating,
           COUNT(*) FILTER (WHERE status = 'ESCALATED') AS escalated,
           COUNT(*) FILTER (WHERE status = 'RESOLVED') AS resolved,
           COUNT(*) FILTER (WHERE assigned_to IS NULL AND status <> 'RESOLVED') AS unassigned
         FROM incidents`,
      );

      const row = result.rows[0];

      return {
        total: Number(row.total),
        open: Number(row.open),
        critical: Number(row.critical),
        highPriority: Number(row.high_priority),
        investigating: Number(row.investigating),
        escalated: Number(row.escalated),
        resolved: Number(row.resolved),
        unassigned: Number(row.unassigned),
      };
    },
  };
}
