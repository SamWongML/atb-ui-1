import type { NextConfig } from "next";

// The web app talks to the auto-tobe `api` and `gateway` directly via the
// absolute origins in NEXT_PUBLIC_ATB_API_URL / NEXT_PUBLIC_ATB_GATEWAY_WS_URL
// (passed into CoreProvider). There is no same-origin backend proxy — the
// destination `api` owns CORS for the web origin.

// Parse hostnames from CORS_ALLOWED_ORIGINS so that the Next.js dev server
// allows cross-origin HMR / webpack requests (e.g. from Tailscale IPs).
const allowedDevOrigins = process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => {
        try {
          return new URL(origin.trim()).host;
        } catch {
          return origin.trim();
        }
      })
      .filter(Boolean)
  : undefined;

const nextConfig: NextConfig = {
  ...(process.env.STANDALONE === "true" ? { output: "standalone" as const } : {}),
  transpilePackages: ["@atb/core", "@atb/ui", "@atb/views"],
  ...(allowedDevOrigins && allowedDevOrigins.length > 0
    ? { allowedDevOrigins }
    : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80, 85],
  },
};

export default nextConfig;
