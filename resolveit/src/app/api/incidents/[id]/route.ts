import {
  handleGetIncident,
  handleUpdateIncident,
} from "@/features/incidents/http";
import { requesterScope } from "@/features/incidents/service";
import { getIncidentService } from "@/server/incidents/service";
import { authErrorResponse, requireRole, requireSession } from "@/server/auth/session";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function errorResponse(
  status: number,
  code: string,
  message: string,
) {
  return Response.json(
    {
      success: false,
      error: {
        code,
        message,
      },
    },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: RouteContext,
) {
  try {
    const session = await requireSession();
    const { id } = await params;

    return await handleGetIncident(
      id,
      getIncidentService(),
      requesterScope(session),
    );
  } catch (error) {
    const authError = authErrorResponse(error, "Please sign in to view this incident.");
    if (authError) return authError;

    console.error("Incident detail request failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Incident details are temporarily unavailable. Please try again.",
    );
  }
}

/** IT workflow actions: status, assignment, and notes. IT_ADMIN only. */
export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    const admin = await requireRole("IT_ADMIN");
    const { id } = await params;

    return await handleUpdateIncident(
      id,
      request,
      getIncidentService(),
      admin.id,
    );
  } catch (error) {
    const authError = authErrorResponse(
      error,
      "Please sign in to update incidents.",
      "Only IT staff can update incidents.",
    );
    if (authError) return authError;

    console.error("Incident update failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "The incident could not be updated. Please try again.",
    );
  }
}
