import { z } from "zod";
import { INCIDENT_STATUSES, NOTE_VISIBILITIES, type Incident } from "./types";
import { CreateIncidentSchema } from "./validation";
import type { IncidentListQuery } from "./filters";
import { InvalidAssigneeError, type IncidentService } from "./service";
import type { IncidentWorkflow } from "@/features/decisions/engine";

function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    { status },
  );
}

/** Post-creation analysis. It may return an updated incident (for example, after escalation). */
export type IncidentAnalyzer = (
  incident: Incident,
) => Promise<{ incident: Incident; workflow: IncidentWorkflow } | undefined>;

export async function handleCreateIncident(
  request: Request,
  service: IncidentService,
  analyze?: IncidentAnalyzer,
  requesterId?: string,
): Promise<Response> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const parsed = CreateIncidentSchema.safeParse(body);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));

    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Please correct the highlighted fields.",
      details,
    );
  }

  let incident: Incident;
  try {
    incident = await service.create(parsed.data, requesterId);
  } catch (error) {
    console.error("Incident creation failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "We could not save your incident. Please try again.",
    );
  }

  // The incident is saved. Analysis problems must never turn that into a failed request.
  let analysis: Awaited<ReturnType<IncidentAnalyzer>>;
  try {
    analysis = analyze ? await analyze(incident) : undefined;
  } catch (error) {
    console.error("Incident analysis failed after creation.", error);
  }

  return Response.json(
    {
      success: true,
      data: analysis?.incident ?? incident,
      ...(analysis ? { workflow: analysis.workflow } : {}),
    },
    { status: 201 },
  );
}

export async function handleListIncidents(
  service: IncidentService,
  query: IncidentListQuery = {},
): Promise<Response> {
  try {
    const incidents = await service.list(query);

    return Response.json({
      success: true,
      data: incidents,
    });
  } catch (error) {
    console.error("Incident list request failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Incidents are temporarily unavailable. Please try again.",
    );
  }
}

const incidentIdSchema = z.uuid();

export const IncidentUpdateSchema = z
  .object({
    status: z.enum(INCIDENT_STATUSES).optional(),
    assigneeId: z.uuid().nullable().optional(),
    note: z
      .object({
        body: z.string().trim().min(1, "Write a note first.").max(4000, "Keep notes under 4,000 characters."),
        visibility: z.enum(NOTE_VISIBILITIES),
      })
      .strict()
      .optional(),
  })
  .strict()
  .refine(
    (update) => update.status !== undefined || update.assigneeId !== undefined || update.note !== undefined,
    "Provide a status, assignee, or note.",
  );

export async function handleGetIncident(
  id: string,
  service: IncidentService,
  requesterId?: string,
): Promise<Response> {
  if (!incidentIdSchema.safeParse(id).success) {
    return errorResponse(
      400,
      "INVALID_ID",
      "Incident ID is invalid.",
    );
  }

  try {
    const incident = await service.getById(id, requesterId);

    return incident
      ? Response.json({
          success: true,
          data: incident,
        })
      : errorResponse(
          404,
          "NOT_FOUND",
          "Incident was not found.",
        );
  } catch (error) {
    console.error("Incident detail request failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Incident details are temporarily unavailable. Please try again.",
    );
  }
}

/** IT workflow update. The caller must already have verified the IT_ADMIN role. */
export async function handleUpdateIncident(
  id: string,
  request: Request,
  service: IncidentService,
  actorId: string,
): Promise<Response> {
  if (!incidentIdSchema.safeParse(id).success) {
    return errorResponse(
      400,
      "INVALID_ID",
      "Incident ID is invalid.",
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON.",
    );
  }

  const parsed = IncidentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      parsed.error.issues[0]?.message ?? "The incident update is invalid.",
    );
  }

  const update = parsed.data;

  try {
    let incident = await service.getById(id);
    if (!incident) {
      return errorResponse(404, "NOT_FOUND", "Incident was not found.");
    }

    if (update.status !== undefined) {
      incident = await service.updateStatus(id, update.status, actorId) ?? incident;
    }
    if (update.assigneeId !== undefined) {
      incident = await service.assign(id, update.assigneeId, actorId) ?? incident;
    }
    if (update.note) {
      await service.addNote(id, update.note.body, update.note.visibility, actorId);
      incident = await service.getById(id) ?? incident;
    }

    return Response.json({
      success: true,
      data: incident,
    });
  } catch (error) {
    if (error instanceof InvalidAssigneeError) {
      return errorResponse(400, "VALIDATION_ERROR", error.message);
    }

    console.error("Incident update failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "The incident could not be updated. Please try again.",
    );
  }
}
