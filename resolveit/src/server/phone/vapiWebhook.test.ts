import { describe, expect, it, vi } from "vitest";
import { handleVapiServerMessage, transcriptFromVapi, type PhoneWebhookDeps } from "./vapiWebhook";
import { normalizePhoneNumber } from "./phoneNumber";
import { createIncidentService } from "@/features/incidents/service";
import { makeIncident, makeRepository } from "@/testing/fixtures";
import type { IncidentWorkflow } from "@/features/decisions/engine";
import type { IncidentRepository } from "@/features/incidents/repository";

const IT_PHONE = "+15550100199";

const completeDraft = {
  title: "Laptop will not connect to VPN",
  description: "The VPN client fails to connect from home since this morning.",
  category: "network",
  urgency: "high",
  affectedUsers: 1,
  businessImpact: "Cannot reach the finance system.",
  troubleshootingAttempted: ["Restarted the laptop"],
};

function toolCall(args: unknown, callId = "call-1", customerNumber = "+1 (415) 555-0100") {
  return {
    message: {
      type: "tool-calls",
      call: { id: callId, customer: { number: customerNumber } },
      artifact: { messages: [
        { role: "bot", message: "Hi, this is ResolveIT." },
        { role: "user", message: "My VPN is broken." },
      ] },
      toolCallList: [{ id: "tool-1", type: "function", function: { name: "prepare_incident", arguments: args } }],
    },
  };
}

function setup(overrides: Partial<IncidentRepository> = {}, workflow?: Partial<IncidentWorkflow>, itSupportPhone: string | null = IT_PHONE) {
  const created = makeIncident({ reference: "INC-000042", source: "phone", severity: "HIGH" });
  const repository = makeRepository({
    create: vi.fn().mockResolvedValue(created),
    findEmployeeIdByPhone: vi.fn().mockResolvedValue("employee-id"),
    ...overrides,
  });
  const runWorkflow = vi.fn().mockImplementation(async (incident) => ({
    incident: workflow?.decision?.action === "ESCALATE_TO_HUMAN" ? { ...incident, status: "ESCALATED" } : incident,
    workflow: { investigation: {}, decision: { action: "CREATE_PRIORITIZED_TICKET", resolution: null }, ...workflow },
  }));
  const deps: PhoneWebhookDeps = {
    service: createIncidentService(repository),
    runWorkflow,
    itSupportPhone: itSupportPhone ?? undefined,
    transferMode: "blind-transfer",
  };
  return { repository, runWorkflow, deps };
}

async function toolResult(body: unknown, deps: PhoneWebhookDeps) {
  const response = await handleVapiServerMessage(body, deps) as { results: Array<{ toolCallId: string; result: string }> };
  expect(response.results[0].toolCallId).toBe("tool-1");
  return response.results[0].result;
}

describe("Vapi phone webhook: prepare_incident", () => {
  it("creates a phone incident linked to the caller, with transcript, and runs the shared workflow", async () => {
    const { repository, runWorkflow, deps } = setup();

    const result = await toolResult(toolCall(completeDraft), deps);

    expect(repository.findEmployeeIdByPhone).toHaveBeenCalledWith("+14155550100");
    const [input, severity, requesterId, origin] = (repository.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(input).toMatchObject({ category: "NETWORK_CONNECTIVITY", urgency: "HIGH", troubleshootingAttempted: ["Restarted the laptop"] });
    expect(input.transcript).toBe("ResolveIT: Hi, this is ResolveIT.\nEmployee: My VPN is broken.");
    expect(severity).toBe("HIGH");
    expect(requesterId).toBe("employee-id");
    expect(origin).toEqual({ callId: "call-1", callerPhone: "+14155550100" });
    expect(runWorkflow).toHaveBeenCalledOnce();
    expect(result).toContain("INC-000042");
    expect(result).toContain("end the call");
    expect(result).not.toContain("transferCall");
  });

  it("tells the assistant to transfer only when ResolveIT escalated, without revealing the number", async () => {
    const { deps } = setup({}, { decision: { action: "ESCALATE_TO_HUMAN", severity: "HIGH", explanation: "x", resolution: null } });

    const result = await toolResult(toolCall(completeDraft), deps);

    expect(result).toContain("ESCALATED");
    expect(result).toContain("transferCall");
    expect(result).not.toContain(IT_PHONE);
    expect(result).not.toContain("5550100199");
  });

  it("says IT will call back when escalated but no transfer number is configured", async () => {
    const { deps } = setup({}, { decision: { action: "ESCALATE_TO_HUMAN", severity: "HIGH", explanation: "x", resolution: null } }, null);
    const result = await toolResult(toolCall(completeDraft), deps);
    expect(result).toContain("call them back");
    expect(result).not.toContain("transferCall");
  });

  it("asks for missing information instead of creating a ticket", async () => {
    const { repository, deps } = setup();
    const result = await toolResult(toolCall({ ...completeDraft, affectedUsers: null }), deps);
    expect(result).toContain("how many people are affected");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects server-owned fields from the assistant", async () => {
    const { repository, deps } = setup();
    const result = await toolResult(toolCall({ ...completeDraft, severity: "LOW" }), deps);
    expect(result).toContain("Do not include severity");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("never creates a second ticket for the same call", async () => {
    const existing = makeIncident({ reference: "INC-000007", status: "OPEN" });
    const { repository, deps } = setup({ getByCallId: vi.fn().mockResolvedValue(existing) });
    const result = await toolResult(toolCall(completeDraft), deps);
    expect(result).toContain("INC-000007");
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("keeps unknown callers unlinked and passes their spoken identity to IT only as context", async () => {
    const { repository, deps } = setup({ findEmployeeIdByPhone: vi.fn().mockResolvedValue(null) });
    const result = await toolResult(toolCall({ ...completeDraft, callerName: "Sam Lee", callerEmail: "sam@example.com" }), deps);
    const [input, , requesterId] = (repository.create as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(requesterId).toBeUndefined();
    expect(input.additionalContext).toContain("Sam Lee, sam@example.com");
    expect(result).toContain("not linked to a ResolveIT account");
  });

  it("reports a system failure to the assistant without transferring", async () => {
    const { deps } = setup({ create: vi.fn().mockRejectedValue(new Error("db down")) });
    const result = await toolResult(toolCall(completeDraft), deps);
    expect(result).toContain("system problem");
    expect(result).toContain("Do not transfer");
  });
});

describe("Vapi phone webhook: transfer destination", () => {
  const transferRequest = { message: { type: "transfer-destination-request", call: { id: "call-1" } } };

  it("returns IT support only for an escalated incident and records the transfer", async () => {
    const escalated = makeIncident({ id: "incident-9", reference: "INC-000009", status: "ESCALATED", severity: "CRITICAL" });
    const { repository, deps } = setup({ getByCallId: vi.fn().mockResolvedValue(escalated) });

    const response = await handleVapiServerMessage(transferRequest, deps) as { destination: { type: string; number: string } };

    expect(response.destination).toEqual({ type: "number", number: IT_PHONE });
    expect(repository.recordCallTransferred).toHaveBeenCalledWith("incident-9");
  });

  it("adds a warm-transfer briefing when a warm mode is configured", async () => {
    const escalated = makeIncident({ reference: "INC-000009", status: "ESCALATED", title: "Floor 3 cannot sign in" });
    const { deps } = setup({ getByCallId: vi.fn().mockResolvedValue(escalated) });

    const response = await handleVapiServerMessage(transferRequest, { ...deps, transferMode: "warm-transfer-say-message" }) as {
      destination: { transferPlan: { mode: string; message: string } };
    };

    expect(response.destination.transferPlan.mode).toBe("warm-transfer-say-message");
    expect(response.destination.transferPlan.message).toContain("Floor 3 cannot sign in");
  });

  it("refuses to transfer when there is no escalated incident for the call", async () => {
    for (const incident of [null, makeIncident({ status: "OPEN" })]) {
      const { repository, deps } = setup({ getByCallId: vi.fn().mockResolvedValue(incident) });
      const response = await handleVapiServerMessage(transferRequest, deps);
      expect(response).toHaveProperty("error");
      expect(JSON.stringify(response)).not.toContain(IT_PHONE);
      expect(repository.recordCallTransferred).not.toHaveBeenCalled();
    }
  });
});

describe("Vapi phone webhook: end of call", () => {
  it("stores the final transcript on the call's incident", async () => {
    const { repository, deps } = setup();
    await handleVapiServerMessage({
      message: { type: "end-of-call-report", call: { id: "call-1" }, artifact: { transcript: "AI: Hello\nUser: My VPN is broken" } },
    }, deps);
    expect(repository.attachCallTranscript).toHaveBeenCalledWith("call-1", "ResolveIT: Hello\nEmployee: My VPN is broken");
  });

  it("ignores unrelated or malformed messages", async () => {
    const { deps } = setup();
    await expect(handleVapiServerMessage({ message: { type: "status-update" } }, deps)).resolves.toEqual({});
    await expect(handleVapiServerMessage("nonsense", deps)).resolves.toEqual({});
  });
});

describe("phone helpers", () => {
  it("normalizes phone numbers to E.164", () => {
    expect(normalizePhoneNumber("+1 (415) 555-0100")).toBe("+14155550100");
    expect(normalizePhoneNumber("415-555-0100")).toBe("+14155550100");
    expect(normalizePhoneNumber("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhoneNumber("12")).toBeNull();
    expect(normalizePhoneNumber(undefined)).toBeNull();
  });

  it("builds transcripts from Vapi messages, skipping system and tool entries", () => {
    expect(transcriptFromVapi({ artifact: { messages: [
      { role: "system", message: "prompt" },
      { role: "bot", message: "Hi" },
      { role: "tool_calls", message: "" },
      { role: "user", message: "Help" },
    ] } })).toBe("ResolveIT: Hi\nEmployee: Help");
  });
});
