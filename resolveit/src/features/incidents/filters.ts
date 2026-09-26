import { z } from "zod";
import { INCIDENT_CATEGORIES, INCIDENT_SEVERITIES, INCIDENT_SOURCES, INCIDENT_STATUSES } from "./types";

export const INCIDENT_SORTS = ["priority", "newest", "oldest", "updated"] as const;
export type IncidentSort = (typeof INCIDENT_SORTS)[number];

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), z.enum(values).optional()).catch(undefined);

const optionalDate = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
).catch(undefined);

/** Filters from a query string. Invalid values are ignored rather than failing the page. */
export const IncidentFiltersSchema = z.object({
  status: optionalEnum(INCIDENT_STATUSES),
  severity: optionalEnum(INCIDENT_SEVERITIES),
  category: optionalEnum(INCIDENT_CATEGORIES),
  source: optionalEnum(INCIDENT_SOURCES),
  // "unassigned", "me" (resolved server-side to the signed-in admin), or an IT user ID.
  assignee: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.union([z.literal("unassigned"), z.literal("me"), z.uuid()]).optional(),
  ).catch(undefined),
  from: optionalDate,
  to: optionalDate,
  sort: z.enum(INCIDENT_SORTS).catch("priority"),
});

export type IncidentFilters = z.infer<typeof IncidentFiltersSchema>;

export type IncidentListQuery = Omit<IncidentFilters, "assignee" | "sort"> & {
  sort?: IncidentSort;
  assignee?: "unassigned" | string;
  /** Set for employees: restricts results to their own incidents. Always derived from the session. */
  requesterId?: string;
  limit?: number;
};

export function parseIncidentFilters(searchParams: Record<string, string | string[] | undefined> | URLSearchParams): IncidentFilters {
  const entries = searchParams instanceof URLSearchParams
    ? Object.fromEntries(searchParams.entries())
    : Object.fromEntries(Object.entries(searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]));
  return IncidentFiltersSchema.parse(entries);
}
