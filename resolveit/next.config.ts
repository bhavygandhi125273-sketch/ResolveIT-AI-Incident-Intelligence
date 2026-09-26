import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev server only: allow the Cloudflare quick tunnel (used so Vapi can reach the local app)
  // to load dev assets and HMR. Without this, pages served through the tunnel never hydrate.
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;
