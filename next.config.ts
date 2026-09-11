import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prompt templates are read from disk at runtime; make sure they ship with the functions.
  outputFileTracingIncludes: {
    "/api/analyze": ["./prompts/**/*"],
  },
  serverExternalPackages: ["sharp"],
  // AGENTS.md is managed by sunaba; do not let next dev append to it.
  agentRules: false,
};

export default nextConfig;
