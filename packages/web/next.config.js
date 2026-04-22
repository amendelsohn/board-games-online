/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    forceSwcTransforms: true,
  },
  transpilePackages: [
    "@bgo/sdk",
    "@bgo/sdk-client",
    "@bgo/contracts",
    "@bgo/games-tictactoe",
    "@bgo/games-connectfour",
  ],
};

module.exports = nextConfig;
