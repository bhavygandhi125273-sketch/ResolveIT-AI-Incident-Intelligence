import { describe, expect, it } from "vitest";
import { extractIncidentDraft } from "./vapi";

describe("Vapi prepare_incident extraction", () => {
  it("reads tool-calls messages with object or JSON-string arguments", () => {
    expect(extractIncidentDraft({
      type: "tool-calls",
      toolCallList: [{ id: "1", function: { name: "prepare_incident", arguments: { title: "VPN down" } } }],
    })).toEqual({ found: true, draft: { title: "VPN down" } });

    expect(extractIncidentDraft({
      type: "tool-calls",
      toolCallList: [{ id: "1", function: { name: "prepare_incident", arguments: "{\"title\":\"VPN down\"}" } }],
    })).toEqual({ found: true, draft: { title: "VPN down" } });
  });

  it("reads legacy function-call messages", () => {
    expect(extractIncidentDraft({
      type: "function-call",
      functionCall: { name: "prepare_incident", parameters: { title: "VPN down" } },
    })).toEqual({ found: true, draft: { title: "VPN down" } });
  });

  it("reports an unreadable prepare_incident call so the agent can retry", () => {
    expect(extractIncidentDraft({
      type: "tool-calls",
      toolCallList: [{ function: { name: "prepare_incident", arguments: "{not json" } }],
    })).toEqual({ found: true, draft: null });
  });

  it("ignores other tools and messages", () => {
    expect(extractIncidentDraft({ type: "tool-calls", toolCallList: [{ function: { name: "endCall" } }] })).toEqual({ found: false });
    expect(extractIncidentDraft({ type: "transcript", transcript: "hi" })).toEqual({ found: false });
    expect(extractIncidentDraft("nonsense")).toEqual({ found: false });
  });
});
