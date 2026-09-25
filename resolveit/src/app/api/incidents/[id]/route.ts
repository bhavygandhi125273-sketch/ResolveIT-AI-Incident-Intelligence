import { handleGetIncident, handleUpdateIncidentStatus } from "@/features/incidents/http";
import { getIncidentService } from "@/server/incidents/service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return await handleGetIncident(id, getIncidentService());
  } catch (error) {
    console.error("Incident service is not configured.", error);
    return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Incident details are temporarily unavailable. Please try again." } }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return await handleUpdateIncidentStatus(id, request, getIncidentService());
  } catch (error) {
    console.error("Incident service is not configured.", error);
    return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "The incident status could not be updated. Please try again." } }, { status: 500 });
  }
}
