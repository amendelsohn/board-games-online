const fs = require("fs");
const path = require("path");

/** Derive `@bgo/games-*` workspace packages from the monorepo layout so
 * every game is transpiled by Next without hand-maintaining a list. */
function discoverGamePackages() {
  const packagesDir = path.resolve(__dirname, "..");
  const entries = fs.readdirSync(packagesDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && e.name.startsWith("games-"))
    .map((e) => `@bgo/${e.name}`);
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Ensure the standalone bundle traces across the whole pnpm workspace,
  // not just packages/web/. Required for the docker runner to find the
  // @bgo/sdk / @bgo/sdk-client / @bgo/games-* siblings.
  outputFileTracingRoot: path.join(__dirname, "..", ".."),
  experimental: {
    forceSwcTransforms: true,
  },
  transpilePackages: [
    "@bgo/sdk",
    "@bgo/sdk-client",
    "@bgo/contracts",
    ...discoverGamePackages(),
  ],
};

module.exports = nextConfig;
