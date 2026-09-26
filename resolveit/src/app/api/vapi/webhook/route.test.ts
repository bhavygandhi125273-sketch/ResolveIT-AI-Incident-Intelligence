import { afterEach, describe, expect, it, vi } from "vitest";

// The route reads configuration at import time, so each test imports a fresh copy.
async function loadRoute(secret: string | undefined) {
  vi.resetModules();
  vi.stubEnv("VAPI_WEBHOOK_SECRET", secret ?? "");
  vi.stubEnv("IT_SUPPORT_PHONE", "+15550100199");
  vi.doMock("@/server/incidents/service", () => ({ getIncidentService: () => ({}) }));
  vi.doMock("@/server/incidents/workflow", () => ({ runIncidentWorkflow: vi.fn() }));
  return import("./route");
}

const post = (headers: Record<string, string>, body: unknown = { message: { type: "status-update" } }) =>
  new Request("http://localhost/api/vapi/webhook", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/server/incidents/service");
  vi.doUnmock("@/server/incidents/workflow");
});

describe("Vapi webhook authentication", () => {
  it("is disabled until a webhook secret is configured", async () => {
    const { POST } = await loadRoute(undefined);
    expect((await POST(post({ authorization: "Bearer anything" }))).status).toBe(503);
  });

  it("rejects requests without the shared secret", async () => {
    const { POST } = await loadRoute("test-webhook-secret");
    expect((await POST(post({}))).status).toBe(401);
    expect((await POST(post({ authorization: "Bearer wrong" }))).status).toBe(401);
    expect((await POST(post({ "x-vapi-secret": "wrong-but-same-length" }))).status).toBe(401);
  });

  it("accepts the Bearer token or the legacy X-Vapi-Secret header", async () => {
    const { POST } = await loadRoute("test-webhook-secret");
    expect((await POST(post({ authorization: "Bearer test-webhook-secret" }))).status).toBe(200);
    expect((await POST(post({ "x-vapi-secret": "test-webhook-secret" }))).status).toBe(200);
  });

  it("never echoes the IT support number for an unauthorized transfer request", async () => {
    const { POST } = await loadRoute("test-webhook-secret");
    const response = await POST(post({}, { message: { type: "transfer-destination-request", call: { id: "c" } } }));
    expect(await response.text()).not.toContain("5550100199");
  });
});
