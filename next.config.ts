import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `next dev` would otherwise print every Server Action call with its arguments, passwords
  // included (design.md → Technische Entscheidungen).
  logging: {
    serverFunctions: false,
  },
  // Keeps `next dev` from appending its own block to CLAUDE.md / AGENTS.md.
  agentRules: false,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
