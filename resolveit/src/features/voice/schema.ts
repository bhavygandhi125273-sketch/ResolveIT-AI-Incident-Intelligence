import { z } from "zod";

import {
  INCIDENT_CATEGORIES,
  INCIDENT_URGENCIES,
} from "@/features/incidents/types";

import { CreateIncidentSchema } from "@/features/incidents/validation";

function normalizeText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function normalizeCategory(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const categoryMap: Record<string, string> = {
    ACCESS: "ACCOUNT_ACCESS",
    ACCOUNT: "ACCOUNT_ACCESS",
    ACCOUNT_ACCESS: "ACCOUNT_ACCESS",

    HARDWARE: "COMPUTER_HARDWARE",
    COMPUTER: "COMPUTER_HARDWARE",
    COMPUTER_HARDWARE: "COMPUTER_HARDWARE",

    NETWORK: "NETWORK_CONNECTIVITY",
    CONNECTIVITY: "NETWORK_CONNECTIVITY",
    NETWORK_CONNECTIVITY: "NETWORK_CONNECTIVITY",

    SOFTWARE: "SOFTWARE_APPLICATIONS",
    APPLICATION: "SOFTWARE_APPLICATIONS",
    APPLICATIONS: "SOFTWARE_APPLICATIONS",
    SOFTWARE_APPLICATION: "SOFTWARE_APPLICATIONS",
    SOFTWARE_APPLICATIONS: "SOFTWARE_APPLICATIONS",

    EMAIL: "EMAIL_COLLABORATION",
    COLLABORATION: "EMAIL_COLLABORATION",
    EMAIL_COLLABORATION: "EMAIL_COLLABORATION",

    OTHER: "OTHER",
  };

  return categoryMap[normalized] ?? value;
}

function normalizeUrgency(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ");

  if (
    normalized === "LOW" ||
    normalized === "LOW PRIORITY" ||
    normalized === "LOW URGENCY"
  ) {
    return "LOW";
  }

  if (
    normalized === "MEDIUM" ||
    normalized === "MEDIUM PRIORITY" ||
    normalized === "MEDIUM URGENCY" ||
    normalized === "MODERATE"
  ) {
    return "MEDIUM";
  }

  if (
    normalized === "HIGH" ||
    normalized === "HIGH PRIORITY" ||
    normalized === "HIGH URGENCY" ||
    normalized === "URGENT"
  ) {
    return "HIGH";
  }

  if (
    normalized === "CRITICAL" ||
    normalized === "CRITICAL PRIORITY" ||
    normalized === "CRITICAL URGENCY" ||
    normalized === "EMERGENCY"
  ) {
    return "CRITICAL";
  }

  return value;
}

const nullableText = (max: number) =>
  z.preprocess(
    normalizeText,
    z.string().min(1).max(max).nullable().optional(),
  );

const nullableNumber = z
  .number()
  .int()
  .min(1)
  .max(100000)
  .nullable()
  .optional();

const nullableBoolean = z
  .boolean()
  .nullable()
  .optional();

const stringArray = z
  .array(z.string().trim().min(1).max(1000))
  .max(20)
  .optional();

export const VoiceIncidentDraftSchema = z
  .object({
    title: nullableText(160),

    description: nullableText(5000),

    category: z.preprocess(
      normalizeCategory,
      z
        .enum(INCIDENT_CATEGORIES)
        .nullable()
        .optional(),
    ),

    affectedUsers: nullableNumber,

    businessImpact: nullableText(2000),

    urgency: z.preprocess(
      normalizeUrgency,
      z
        .enum(INCIDENT_URGENCIES)
        .nullable()
        .optional(),
    ),

    affectedSystem: nullableText(200),

    symptoms: nullableText(5000),

    startedAt: nullableText(100),

    currentlyAffected: nullableBoolean,

    errorMessages: stringArray,

    troubleshootingAttempted: stringArray,
  })
  .strict()
  .transform((draft) => ({
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
    troubleshootingAttempted:
      draft.troubleshootingAttempted ?? [],

    transcript: "",
  }));

export const VoiceIncidentSubmissionSchema =
  CreateIncidentSchema;

export type VoiceIncidentDraft = z.output<
  typeof VoiceIncidentDraftSchema
>;