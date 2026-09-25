import { handleCreateIncident, handleListIncidents } from "@/features/incidents/http";
import { getIncidentService } from "@/server/incidents/service";
import { decideIncident } from "@/features/decisions/engine";
import { investigateIncident } from "@/server/investigation/openAiInvestigator";

export const runtime = "nodejs";

function unavailable() {
  return Response.json({ success: false, error: { code: "INTERNAL_ERROR", message: "Incident service is temporarily unavailable. Please try again." } }, { status: 500 });
}

export async function GET() {
  try {
    return await handleListIncidents(getIncidentService());
  } catch (error) {
    console.error("Incident service is not configured.", error);
    return unavailable();
  }
}

export async function POST(request: Request) {
  try {
    return await handleCreateIncident(request, getIncidentService(), async (incident) => {
      const investigation = await investigateIncident(incident);
      return { investigation, decision: decideIncident(incident, investigation) };
    });
  } catch (error) {
    console.error("Incident service is not configured.", error);
    return unavailable();
  }
}
