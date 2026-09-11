import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js injects inline scripts for hydration, so script-src needs 'unsafe-inline'
// without a nonce setup; dev additionally needs eval for fast refresh.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  // Prompt templates are read from disk at runtime; make sure they ship with the functions.
  outputFileTracingIncludes: {
    "/api/analyze": ["./prompts/**/*"],
  },
  serverExternalPackages: ["sharp"],
  // AGENTS.md is managed by sunaba; do not let next dev append to it.
  agentRules: false,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      // Result JSON is addressed by capability URL; keep it out of search indexes.
      { source: "/api/(.*)", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
};

export default nextConfig;
