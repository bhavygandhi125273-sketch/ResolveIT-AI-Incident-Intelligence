import { z } from "zod";
import { INCIDENT_STATUSES } from "./types";
import { CreateIncidentSchema } from "./validation";
import type { IncidentService } from "./service";

function errorResponse(status: number, code: string, message: string, details?: unknown) {
  return Response.json({ success: false, error: { code, message, ...(details ? { details } : {}) } }, { status });
}

export async function handleCreateIncident(
  request: Request,
  service: IncidentService,
  analyze?: (incident: Awaited<ReturnType<IncidentService["create"]>>) => Promise<unknown>,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const parsed = CreateIncidentSchema.safeParse(body);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({ field: issue.path.join("."), message: issue.message }));
    return errorResponse(400, "VALIDATION_ERROR", "Please correct the highlighted fields.", details);
  }

  try {
    const incident = await service.create(parsed.data);
    const workflow = analyze ? await analyze(incident) : undefined;
    return Response.json({ success: true, data: incident, ...(workflow ? { workflow } : {}) }, { status: 201 });
  } catch (error) {
    console.error("Incident creation failed.", error);
    return errorResponse(500, "INTERNAL_ERROR", "We could not save your incident. Please try again.");
  }
}

export async function handleListIncidents(service: IncidentService): Promise<Response> {
  try {
    const incidents = await service.listRecent();
    return Response.json({ success: true, data: incidents });
  } catch (error) {
    console.error("Incident list request failed.", error);
    return errorResponse(500, "INTERNAL_ERROR", "Incidents are temporarily unavailable. Please try again.");
  }
}

const incidentIdSchema = z.string().uuid();
const incidentStatusSchema = z.object({ status: z.enum(INCIDENT_STATUSES) }).strict();

export async function handleGetIncident(id: string, service: IncidentService): Promise<Response> {
  if (!incidentIdSchema.safeParse(id).success) return errorResponse(400, "INVALID_ID", "Incident ID is invalid.");
  try {
    const incident = await service.getById(id);
    return incident ? Response.json({ success: true, data: incident }) : errorResponse(404, "NOT_FOUND", "Incident was not found.");
  } catch (error) {
    console.error("Incident detail request failed.", error);
    return errorResponse(500, "INTERNAL_ERROR", "Incident details are temporarily unavailable. Please try again.");
  }
}

export async function handleUpdateIncidentStatus(id: string, request: Request, service: IncidentService): Promise<Response> {
  if (!incidentIdSchema.safeParse(id).success) return errorResponse(400, "INVALID_ID", "Incident ID is invalid.");
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, "INVALID_JSON", "Request body must be valid JSON.");
  }
  const parsed = incidentStatusSchema.safeParse(body);
  if (!parsed.success) return errorResponse(400, "VALIDATION_ERROR", "Choose a valid incident status.");
  try {
    const incident = await service.updateStatus(id, parsed.data.status);
    return incident ? Response.json({ success: true, data: incident }) : errorResponse(404, "NOT_FOUND", "Incident was not found.");
  } catch (error) {
    console.error("Incident status update failed.", error);
    return errorResponse(500, "INTERNAL_ERROR", "The incident status could not be updated. Please try again.");
  }
}
