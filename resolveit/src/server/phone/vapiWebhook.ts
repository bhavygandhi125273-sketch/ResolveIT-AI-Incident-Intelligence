import type { IncidentWorkflow } from "@/features/decisions/engine";
import type { IncidentAnalyzer } from "@/features/incidents/http";
import type { IncidentService } from "@/features/incidents/service";
import type { Incident } from "@/features/incidents/types";
import { forbiddenFieldsInstruction, missingInformationInstruction, speakableReference } from "@/features/voice/agentMessages";
import { buildVoiceIncidentInput, IncompleteVoiceDraftError } from "@/features/voice/draft";
import { PREPARE_INCIDENT_TOOL } from "@/features/voice/providers/vapi";
import { normalizePhoneNumber } from "./phoneNumber";

/**
 * Vapi phone channel. Vapi calls ResolveIT's webhook for:
 * - tool-calls (prepare_incident): validate, create the incident, run investigation + decision
 * - transfer-destination-request: return IT support only for incidents ResolveIT escalated
 * - end-of-call-report: store the final transcript
 * The IT support number is only ever placed in the transfer response to Vapi.
 */

export const TRANSFER_MODES = ["blind-transfer", "warm-transfer-say-message", "warm-transfer-say-summary"] as const;
export type TransferMode = (typeof TRANSFER_MODES)[number];

export type PhoneWebhookDeps = {
  service: IncidentService;
  runWorkflow: IncidentAnalyzer;
  itSupportPhone?: string;
  transferMode: TransferMode;
};

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

function callIdOf(message: JsonRecord): string | null {
  return isRecord(message.call) ? str(message.call.id) : null;
}

function callerNumberOf(message: JsonRecord): string | null {
  const call = isRecord(message.call) ? message.call : {};
  const customer = isRecord(call.customer) ? call.customer : isRecord(message.customer) ? message.customer : {};
  return normalizePhoneNumber(customer.number);
}

/** Builds a readable transcript from Vapi's artifact (messages preferred, plain transcript as fallback). */
export function transcriptFromVapi(message: JsonRecord): string | null {
  const artifact = isRecord(message.artifact) ? message.artifact : message;
  const messages = Array.isArray(artifact.messages) ? artifact.messages : [];
  const lines = messages.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const text = str(entry.message) ?? str(entry.content);
    if (!text) return [];
    if (entry.role === "user") return [`Employee: ${text}`];
    if (entry.role === "bot" || entry.role === "assistant") return [`ResolveIT: ${text}`];
    return [];
  });
  if (lines.length) return lines.join("\n").slice(-12000);

  const plain = str(artifact.transcript) ?? str(message.transcript);
  return plain
    ? plain.replace(/^AI:/gm, "ResolveIT:").replace(/^User:/gm, "Employee:").slice(-12000)
    : null;
}

type ToolCall = { id: string; name: string; args: unknown };

function toolCallsOf(message: JsonRecord): ToolCall[] {
  const list = Array.isArray(message.toolCallList) ? message.toolCallList : [];
  return list.flatMap((call) => {
    if (!isRecord(call)) return [];
    const fn = isRecord(call.function) ? call.function : call;
    const id = str(call.id);
    const name = str(fn.name);
    if (!id || !name) return [];
    let args = fn.arguments ?? fn.parameters;
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        args = null;
      }
    }
    return [{ id, name, args }];
  });
}

/** What the phone assistant is told after a ticket exists. It drives the rest of the call. */
export function phoneOutcomeInstruction(
  incident: Incident,
  workflow: IncidentWorkflow | undefined,
  { identified, canTransfer }: { identified: boolean; canTransfer: boolean },
): string {
  const reference = `${incident.reference} (say it as "${speakableReference(incident.reference)}")`;
  const unidentified = identified
    ? ""
    : " The caller's phone number is not linked to a ResolveIT account, so tell them IT may contact them to confirm who they are.";

  if (incident.status === "ESCALATED") {
    return canTransfer
      ? `RESOLVEIT: Ticket ${reference} was created and ESCALATED because a person from IT is needed. Tell the employee the ticket number, that you are connecting them to IT support now, and that IT already has all the details so they will not need to repeat themselves. Then immediately use the transferCall tool.${unidentified}`
      : `RESOLVEIT: Ticket ${reference} was created and ESCALATED because a person from IT is needed. Live transfer is unavailable, so tell the employee the ticket number and that IT support has been alerted and will call them back as soon as possible. Then say goodbye and end the call.${unidentified}`;
  }

  const decision = workflow?.decision;
  const nextStep = decision?.action === "OFFER_RESOLUTION" && decision.resolution
    ? `There is a safe fix they can try while IT reviews it: ${decision.resolution}`
    : decision?.action === "CREATE_PRIORITIZED_TICKET"
      ? "IT will prioritize this ticket and follow up."
      : "The IT team will review the ticket and follow up.";

  return `RESOLVEIT: Ticket ${reference} was created. Priority: ${incident.severity.toLowerCase()}. Next step: ${nextStep} They can follow the ticket in ResolveIT under My tickets.${unidentified} Tell the employee the ticket number and the next step, ask if there is anything else, then say goodbye and end the call.`;
}

async function prepareIncident(message: JsonRecord, args: unknown, deps: PhoneWebhookDeps): Promise<string> {
  const callId = callIdOf(message);
  if (!callId) return "RESOLVEIT: The call could not be identified, so no ticket was created. Apologize and ask the employee to report the problem in ResolveIT.";

  const canTransfer = Boolean(deps.itSupportPhone);
  const existing = await deps.service.getByCallId(callId);
  if (existing) {
    return phoneOutcomeInstruction(existing, undefined, { identified: Boolean(existing.requester), canTransfer });
  }

  if (!isRecord(args)) {
    return "RESOLVEIT: The prepare_incident call could not be read. Call prepare_incident again with the incident fields.";
  }

  // Name/email the caller spoke are notes for IT only; account linking uses caller ID.
  const { callerName, callerEmail, ...draft } = args;
  const selfIdentified = [str(callerName), str(callerEmail)].filter(Boolean).join(", ");

  let input;
  try {
    input = buildVoiceIncidentInput(draft, transcriptFromVapi(message) ?? undefined);
  } catch (error) {
    if (error instanceof IncompleteVoiceDraftError) {
      return error.problem === "forbidden" ? forbiddenFieldsInstruction(error.fields) : missingInformationInstruction(error.fields);
    }
    throw error;
  }

  const callerPhone = callerNumberOf(message);
  const requesterId = callerPhone ? await deps.service.findEmployeeIdByPhone(callerPhone) : null;
  if (selfIdentified && !requesterId) {
    input = { ...input, additionalContext: [input.additionalContext, `Caller identified themselves as: ${selfIdentified}.`].filter(Boolean).join("\n") };
  }

  let incident: Incident;
  try {
    incident = await deps.service.create(input, requesterId ?? undefined, { callId, callerPhone });
  } catch (error) {
    // Two prepare_incident calls raced; the unique call ID kept the first one.
    const raced = (error as { code?: string }).code === "23505" ? await deps.service.getByCallId(callId) : null;
    if (!raced) throw error;
    return phoneOutcomeInstruction(raced, undefined, { identified: Boolean(raced.requester), canTransfer });
  }

  let workflow: IncidentWorkflow | undefined;
  try {
    const analysis = await deps.runWorkflow(incident);
    if (analysis) {
      incident = analysis.incident;
      workflow = analysis.workflow;
    }
  } catch (error) {
    console.error("Phone incident analysis failed after creation.", error);
  }

  return phoneOutcomeInstruction(incident, workflow, { identified: Boolean(requesterId), canTransfer });
}

async function handleToolCalls(message: JsonRecord, deps: PhoneWebhookDeps) {
  const results = [];
  for (const call of toolCallsOf(message)) {
    let result: string;
    if (call.name !== PREPARE_INCIDENT_TOOL) {
      result = "RESOLVEIT: Unknown tool.";
    } else {
      try {
        result = await prepareIncident(message, call.args, deps);
      } catch (error) {
        console.error("Phone prepare_incident failed.", error);
        result = "RESOLVEIT: ResolveIT could not save the ticket because of a system problem. Apologize, tell the employee to report it in ResolveIT or try calling again later, then end the call. Do not transfer.";
      }
    }
    results.push({ name: call.name, toolCallId: call.id, result });
  }
  return { results };
}

async function handleTransferRequest(message: JsonRecord, deps: PhoneWebhookDeps) {
  const callId = callIdOf(message);
  const incident = callId ? await deps.service.getByCallId(callId) : null;

  // Transfer only after ResolveIT has escalated this call's incident.
  if (!incident || incident.status !== "ESCALATED") {
    return { error: "Transfer is only available after ResolveIT escalates this call's ticket. Continue helping the caller." };
  }
  if (!deps.itSupportPhone) {
    return { error: "Live transfer is not configured. Tell the caller IT support will call them back." };
  }

  await deps.service.recordCallTransferred(incident.id);

  const warmMessage = `ResolveIT escalation. Ticket ${speakableReference(incident.reference)}, ${incident.severity.toLowerCase()} priority: ${incident.title}. The full AI investigation is in ResolveIT. Connecting the caller now.`;
  return {
    destination: {
      type: "number",
      number: deps.itSupportPhone,
      ...(deps.transferMode === "blind-transfer"
        ? {}
        : { transferPlan: deps.transferMode === "warm-transfer-say-message" ? { mode: deps.transferMode, message: warmMessage.slice(0, 1000) } : { mode: deps.transferMode } }),
    },
    message: { type: "request-start", message: "Connecting you to IT support now. They already have your ticket details." },
  };
}

async function handleEndOfCall(message: JsonRecord, deps: PhoneWebhookDeps) {
  const callId = callIdOf(message);
  const transcript = transcriptFromVapi(message);
  if (callId && transcript) {
    await deps.service.attachCallTranscript(callId, transcript);
  }
  return {};
}

/** Dispatches one Vapi server message and returns the JSON body to send back. */
export async function handleVapiServerMessage(body: unknown, deps: PhoneWebhookDeps): Promise<unknown> {
  const message = isRecord(body) && isRecord(body.message) ? body.message : null;
  if (!message) return {};

  switch (message.type) {
    case "tool-calls":
      return handleToolCalls(message, deps);
    case "transfer-destination-request":
      return handleTransferRequest(message, deps);
    case "end-of-call-report":
      return handleEndOfCall(message, deps);
    default:
      return {};
  }
}
