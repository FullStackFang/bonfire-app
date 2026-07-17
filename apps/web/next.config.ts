import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @bonfire/ui-tokens ships raw TypeScript (shared design tokens + the Carto Voyager map style);
  // Next must transpile the workspace package rather than treat it as pre-built node_modules.
  transpilePackages: ["@bonfire/ui-tokens"],
};

export default nextConfig;
