import "server-only";
import { createIncidentService } from "@/features/incidents/service";
import { createPostgresIncidentRepository } from "@/features/incidents/postgresRepository";
import { getDatabasePool } from "@/server/database/pool";

let incidentService: ReturnType<typeof createIncidentService> | undefined;

export function getIncidentService() {
  incidentService ??= createIncidentService(createPostgresIncidentRepository(getDatabasePool()));
  return incidentService;
}
