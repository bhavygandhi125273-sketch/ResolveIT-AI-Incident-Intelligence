import {
  handleCreateIncident,
  handleListIncidents,
} from "@/features/incidents/http";

import { getIncidentService } from "@/server/incidents/service";

import { decideIncident } from "@/features/decisions/engine";

import { investigateIncident } from "@/server/investigation/openAiInvestigator";

import { requireSession } from "@/server/auth/session";

export const runtime = "nodejs";

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

export async function GET() {
  try {
    const session = await requireSession();

    /*
     * EMPLOYEE:
     * Only return incidents belonging to the
     * currently authenticated employee.
     *
     * IT_ADMIN:
     * requesterId remains undefined, so the
     * IT workspace can see all incidents.
     *
     * IMPORTANT:
     * The session property is `id`, not `userId`.
     */
    return await handleListIncidents(
      getIncidentService(),
      session.role === "EMPLOYEE"
        ? session.id
        : undefined,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "AUTHENTICATION_REQUIRED"
    ) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Please sign in to view incidents.",
          },
        },
        { status: 401 },
      );
    }

    console.error(
      "Incident list request failed.",
      error,
    );

    return unavailable();
  }
}

export async function POST(
  request: Request,
) {
  try {
    const session =
      await requireSession();

    /*
     * The incident is created first.
     *
     * The authenticated user's REAL session ID
     * is stored as requester_id.
     */
    return await handleCreateIncident(
      request,
      getIncidentService(),

      async (incident) => {
        /*
         * AI investigation is a secondary workflow.
         *
         * If investigation fails, we DO NOT
         * pretend that incident creation failed.
         *
         * The incident has already been saved.
         */
        try {
          const investigation =
            await investigateIncident(
              incident,
            );

          return {
            investigation,
            decision:
              decideIncident(
                incident,
                investigation,
              ),
          };
        } catch (error) {
          console.error(
            "Incident investigation failed after incident creation.",
            error,
          );

          return {
            investigation: null,
            decision: null,
            investigationError:
              "AI investigation is temporarily unavailable. The incident was still created successfully.",
          };
        }
      },

      /*
       * IMPORTANT:
       * Session uses `id`, not `userId`.
       */
      session.id,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "AUTHENTICATION_REQUIRED"
    ) {
      return Response.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message:
              "Please sign in before reporting an incident.",
          },
        },
        { status: 401 },
      );
    }

    console.error(
      "Incident creation request failed.",
      error,
    );

    return unavailable();
  }
}