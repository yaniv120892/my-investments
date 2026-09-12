import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Mastra and node-postgres resolve modules at runtime; bundling them into the
  // server build breaks the advisor route rather than merely slowing it down.
  serverExternalPackages: [
    "@mastra/core",
    "@mastra/memory",
    "@mastra/pg",
    "pg",
  ],
};

export default nextConfig;
