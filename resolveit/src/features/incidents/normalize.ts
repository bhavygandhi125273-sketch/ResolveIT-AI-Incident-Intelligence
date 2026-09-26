import { INCIDENT_CATEGORIES, type IncidentCategory, type IncidentUrgency } from "./types";

/**
 * The single place where free-form category/urgency words (for example from the voice agent)
 * are mapped to ResolveIT values. Unrecognised input is returned unchanged so validation
 * reports it instead of silently guessing.
 */

const CATEGORY_ALIASES: Record<string, IncidentCategory> = {
  ACCESS: "ACCOUNT_ACCESS",
  ACCOUNT: "ACCOUNT_ACCESS",
  LOGIN: "ACCOUNT_ACCESS",
  PASSWORD: "ACCOUNT_ACCESS",
  HARDWARE: "COMPUTER_HARDWARE",
  COMPUTER: "COMPUTER_HARDWARE",
  LAPTOP: "COMPUTER_HARDWARE",
  DEVICE: "COMPUTER_HARDWARE",
  NETWORK: "NETWORK_CONNECTIVITY",
  CONNECTIVITY: "NETWORK_CONNECTIVITY",
  INTERNET: "NETWORK_CONNECTIVITY",
  WIFI: "NETWORK_CONNECTIVITY",
  VPN: "NETWORK_CONNECTIVITY",
  SOFTWARE: "SOFTWARE_APPLICATIONS",
  APPLICATION: "SOFTWARE_APPLICATIONS",
  APPLICATIONS: "SOFTWARE_APPLICATIONS",
  APP: "SOFTWARE_APPLICATIONS",
  SOFTWARE_APPLICATION: "SOFTWARE_APPLICATIONS",
  EMAIL: "EMAIL_COLLABORATION",
  COLLABORATION: "EMAIL_COLLABORATION",
};

const URGENCY_ALIASES: Record<string, IncidentUrgency> = {
  LOW: "LOW",
  MINOR: "LOW",
  MEDIUM: "MEDIUM",
  MODERATE: "MEDIUM",
  NORMAL: "MEDIUM",
  HIGH: "HIGH",
  URGENT: "HIGH",
  CRITICAL: "CRITICAL",
  EMERGENCY: "CRITICAL",
};

export function normalizeCategory(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const key = value.trim().toUpperCase().replace(/&|\bAND\b/g, " ").trim().replace(/[\s-]+/g, "_");
  if ((INCIDENT_CATEGORIES as readonly string[]).includes(key)) return key;
  return CATEGORY_ALIASES[key] ?? CATEGORY_ALIASES[key.split("_")[0]] ?? value;
}

export function normalizeUrgency(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const key = value
    .trim()
    .toUpperCase()
    .replace(/[\s_-]+/g, " ")
    .replace(/ (PRIORITY|URGENCY|SEVERITY)$/, "");
  return URGENCY_ALIASES[key] ?? value;
}
