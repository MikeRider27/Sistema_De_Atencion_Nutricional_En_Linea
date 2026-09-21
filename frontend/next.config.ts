import type { NextConfig } from "next";

// El navegador sólo habla con este servidor; /api/* se reenvía al backend (sin CORS ni URLs expuestas).
const backend = process.env.BACKEND_INTERNAL_URL ?? "http://localhost:8100";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: true,
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/:path*` }];
  },
};

export default nextConfig;
