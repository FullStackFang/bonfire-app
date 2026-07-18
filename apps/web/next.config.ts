import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @bonfire/ui-tokens ships raw TypeScript (shared design tokens + the Carto Voyager map style);
  // Next must transpile the workspace package rather than treat it as pre-built node_modules.
  transpilePackages: ["@bonfire/ui-tokens"],
  // Monorepo root — without this Turbopack/webpack infer it from lockfile location and warn.
  turbopack: { root: path.join(__dirname, "../..") },
};

export default nextConfig;
