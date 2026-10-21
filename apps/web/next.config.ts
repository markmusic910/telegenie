import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Enable React 19 features
  reactStrictMode: false,

  // Workspace packages ship prebuilt ESM from dist/ — no transpilePackages needed.
  // teleproto uses Web Crypto + JS AES (no Node builtins) so worker bundling
  // does not need crypto/os/fs/net shims.

  // Experimental features for Cloudflare
  experimental: {},
};

export default nextConfig;
