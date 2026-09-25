import { z } from "zod";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "@/features/incidents/types";
import { CreateIncidentSchema } from "@/features/incidents/validation";

const unknownText = (max: number) => z.string().trim().min(1).max(max).nullable().optional();

/**
 * Tool arguments from a Vapi agent are suggestions, not trusted input.
 * Missing or unknown details stay null until the employee fills them in.
 */
export const VoiceIncidentDraftSchema = z.object({
  title: unknownText(160),
  description: unknownText(5000),
  category: z.enum(INCIDENT_CATEGORIES).nullable().optional(),
  affectedUsers: z.number().int().min(1).max(100000).nullable().optional(),
  businessImpact: unknownText(2000),
  urgency: z.enum(INCIDENT_URGENCIES).nullable().optional(),
  affectedSystem: unknownText(200),
  symptoms: unknownText(5000),
  startedAt: unknownText(100),
  currentlyAffected: z.boolean().nullable().optional(),
  errorMessages: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
  troubleshootingAttempted: z.array(z.string().trim().min(1).max(1000)).max(20).optional(),
}).strict().transform((draft) => ({
  title: draft.title ?? null,
  description: draft.description ?? null,
  category: draft.category ?? null,
  affectedUsers: draft.affectedUsers ?? null,
  businessImpact: draft.businessImpact ?? null,
  urgency: draft.urgency ?? null,
  source: "voice" as const,
  affectedSystem: draft.affectedSystem ?? null,
  symptoms: draft.symptoms ?? null,
  startedAt: draft.startedAt ?? null,
  currentlyAffected: draft.currentlyAffected ?? null,
  errorMessages: draft.errorMessages ?? [],
  troubleshootingAttempted: draft.troubleshootingAttempted ?? [],
  transcript: "",
}));

/** A voice draft can reach incident submission only when it satisfies the normal API schema. */
export const VoiceIncidentSubmissionSchema = CreateIncidentSchema;

export type VoiceIncidentDraft = z.output<typeof VoiceIncidentDraftSchema>;
