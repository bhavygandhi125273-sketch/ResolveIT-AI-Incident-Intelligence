import { destroySession } from "@/server/auth/session";

export const runtime = "nodejs";

/** Clears the session cookie. A plain form POST works without JavaScript. */
export async function POST() {
  await destroySession();
  // Relative redirect: behind a proxy/tunnel, request.url reports the internal host
  // (e.g. https://localhost:3000), which would send the browser to an unreachable address.
  return new Response(null, { status: 303, headers: { Location: "/login" } });
}
