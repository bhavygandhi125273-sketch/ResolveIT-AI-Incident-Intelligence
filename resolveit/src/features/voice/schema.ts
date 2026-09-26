import { z } from "zod";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "@/features/incidents/types";
import { normalizeCategory, normalizeUrgency } from "@/features/incidents/normalize";

/** Fields only the server may set. A voice draft containing any of them is rejected. */
export const SERVER_OWNED_FIELDS = ["severity", "status", "requesterId", "id", "reference"] as const;

function normalizeText(value: unknown): unknown {
  if (typeof value !== "string") return value;
  return value.trim() || null;
}

function normalizeCount(value: unknown): unknown {
  // Speech models sometimes send "3" instead of 3.
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return value;
}

function normalizeList(value: unknown): unknown {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim()).map((item: string) => item.trim());
  return value;
}

const nullableText = (max: number) =>
  z.preprocess(normalizeText, z.string().max(max).nullable().optional());

const textList = z.preprocess(normalizeList, z.array(z.string().max(1000)).max(20).optional());

/**
 * The shape the voice agent's prepare_incident tool call is parsed into. Unknown keys are
 * dropped (models add extra keys); missing required facts are caught at submission.
 */
export const VoiceIncidentDraftSchema = z
  .preprocess(
    (value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return value;
      const raw = value as Record<string, unknown>;
      // Accept "priority" as a synonym the model may use for urgency.
      return raw.urgency == null && raw.priority != null ? { ...raw, urgency: raw.priority } : raw;
    },
    z.object({
      title: nullableText(160),
      description: nullableText(5000),
      category: z.preprocess(normalizeCategory, z.enum(INCIDENT_CATEGORIES).nullable().optional()),
      affectedUsers: z.preprocess(normalizeCount, z.number().int().min(1).max(100000).nullable().optional()),
      businessImpact: nullableText(2000),
      urgency: z.preprocess(normalizeUrgency, z.enum(INCIDENT_URGENCIES).nullable().optional()),
      affectedSystem: nullableText(200),
      symptoms: nullableText(5000),
      startedAt: nullableText(100),
      currentlyAffected: z.boolean().nullable().optional(),
      errorMessages: textList,
      troubleshootingAttempted: textList,
      additionalContext: nullableText(5000),
      humanAssistanceRequested: z.boolean().nullable().optional(),
    }),
  )
  .transform((draft) => ({
    title: draft.title ?? null,
    description: draft.description ?? null,
    category: draft.category ?? null,
    affectedUsers: draft.affectedUsers ?? null,
    businessImpact: draft.businessImpact ?? null,
    urgency: draft.urgency ?? null,
    affectedSystem: draft.affectedSystem ?? null,
    symptoms: draft.symptoms ?? null,
    startedAt: draft.startedAt ?? null,
    currentlyAffected: draft.currentlyAffected ?? null,
    errorMessages: draft.errorMessages ?? [],
    troubleshootingAttempted: draft.troubleshootingAttempted ?? [],
    additionalContext: draft.additionalContext ?? null,
    humanAssistanceRequested: draft.humanAssistanceRequested ?? false,
  }));

export type VoiceIncidentDraft = z.output<typeof VoiceIncidentDraftSchema> & { transcript?: string };

/** Returns the server-owned fields present in raw agent input, if any. */
export function serverOwnedFieldsIn(value: unknown): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return SERVER_OWNED_FIELDS.filter((field) => field in value);
}
