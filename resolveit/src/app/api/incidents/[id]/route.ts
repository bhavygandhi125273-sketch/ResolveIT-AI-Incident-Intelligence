import {
  handleGetIncident,
  handleUpdateIncidentStatus,
} from "@/features/incidents/http";
import { getIncidentService } from "@/server/incidents/service";
import { requireSession, requireRole } from "@/server/auth/session";

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
      session.role === "EMPLOYEE" ? session.id : undefined,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Please sign in to view this incident.",
      );
    }

    console.error("Incident detail request failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "Incident details are temporarily unavailable. Please try again.",
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: RouteContext,
) {
  try {
    await requireRole("IT_ADMIN");

    const { id } = await params;

    return await handleUpdateIncidentStatus(
      id,
      request,
      getIncidentService(),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTHENTICATION_REQUIRED"
    ) {
      return errorResponse(
        401,
        "UNAUTHORIZED",
        "Please sign in to update incidents.",
      );
    }

    if (
      error instanceof Error &&
      error.message === "FORBIDDEN"
    ) {
      return errorResponse(
        403,
        "FORBIDDEN",
        "Only IT administrators can update incident status.",
      );
    }

    console.error("Incident status update failed.", error);

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      "The incident status could not be updated. Please try again.",
    );
  }
}