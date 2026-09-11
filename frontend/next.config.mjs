/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.DOCKER_BUILD === "1" ? { output: "standalone" } : {}),
  async rewrites() {
    // Proxy same-origin /api/* to the backend so session cookies stay first-party in dev.
    const rawBackend = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    const backend = rawBackend.replace(/\/+$/, "").replace(/\/api$/, "");
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
