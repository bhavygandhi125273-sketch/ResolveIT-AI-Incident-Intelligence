import {
  handleCreateIncident,
  handleListIncidents,
} from "@/features/incidents/http";
import { parseIncidentFilters } from "@/features/incidents/filters";
import { getIncidentService } from "@/server/incidents/service";
import { runIncidentWorkflow } from "@/server/incidents/workflow";
import { authErrorResponse, requireSession } from "@/server/auth/session";

export const runtime = "nodejs";
// Ticket creation waits for the AI investigation (up to 20s); allow headroom on serverless hosts.
export const maxDuration = 60;

function unavailable() {
  return Response.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message:
          "Incident service is temporarily unavailable. Please try again.",
      },
    },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const filters = parseIncidentFilters(new URL(request.url).searchParams);

    // Employees are always limited to their own incidents; filters cannot widen that scope.
    return await handleListIncidents(getIncidentService(), {
      ...filters,
      assignee: filters.assignee === "me" ? session.id : filters.assignee,
      requesterId: session.role === "EMPLOYEE" ? session.id : undefined,
    });
  } catch (error) {
    const authError = authErrorResponse(error, "Please sign in to view incidents.");
    if (authError) return authError;

    console.error("Incident list request failed.", error);
    return unavailable();
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();

    // requester_id is always the authenticated user; the request body cannot set it.
    return await handleCreateIncident(
      request,
      getIncidentService(),
      runIncidentWorkflow,
      session.id,
    );
  } catch (error) {
    const authError = authErrorResponse(error, "Please sign in before reporting an incident.");
    if (authError) return authError;

    console.error("Incident creation request failed.", error);
    return unavailable();
  }
}
