import { z } from "zod";
import { INCIDENT_CATEGORIES, INCIDENT_URGENCIES } from "./types";

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalTextList = z.array(z.string().trim().min(1).max(1000)).max(20).optional();

/** Browser input is untrusted; server code parses it before any persistence. */
export const CreateIncidentSchema = z.object({
  title: z.string().trim().min(5, "Enter at least 5 characters.").max(160, "Keep the title under 160 characters."),
  description: z.string().trim().min(10, "Add a little more detail (at least 10 characters).").max(5000, "Keep the description under 5,000 characters."),
  category: z.enum(INCIDENT_CATEGORIES),
  affectedUsers: z.number().int("Enter a whole number.").min(1, "At least one affected person is required.").max(100000, "Enter a realistic number of affected people."),
  businessImpact: z.string().trim().min(3, "Describe how work is affected.").max(2000, "Keep the business impact under 2,000 characters."),
  urgency: z.enum(INCIDENT_URGENCIES),
  // Browser-submitted sources only. Phone incidents are created server-side from the Vapi webhook.
  source: z.enum(["manual", "voice"]).optional(),
  affectedSystem: optionalText(200),
  symptoms: optionalText(5000),
  startedAt: optionalText(100),
  currentlyAffected: z.boolean().nullable().optional(),
  errorMessages: optionalTextList,
  troubleshootingAttempted: optionalTextList,
  additionalContext: optionalText(5000),
  humanAssistanceRequested: z.boolean().optional(),
  transcript: z.string().max(12000).optional(),
}).strict();

export type CreateIncidentInput = z.infer<typeof CreateIncidentSchema>;
