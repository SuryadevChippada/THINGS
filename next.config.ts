import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // this repo is the root; don't walk up to the home directory's lockfile
  turbopack: { root: __dirname },
  // no generated agent instruction files in the archive
  agentRules: false,
  devIndicators: false,
};

export default nextConfig;
