/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    // Proxy same-origin /api/* to the backend so session cookies stay first-party in dev.
    const backend = process.env.BACKEND_INTERNAL_URL || "http://localhost:8001";
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
