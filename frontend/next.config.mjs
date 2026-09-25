/**
 * Realtime WebSocket URL for the browser.
 *
 * The `/api/*` rewrite below proxies plain HTTP, but Vercel (and most edge/CDN hosts) do
 * NOT forward WebSocket upgrades through rewrites — so the socket must go straight to the
 * API host. When the backend is a public HTTPS origin (staging/prod: Render), derive
 * `wss://<api-host>/api/v1/realtime/ws` from BACKEND_INTERNAL_URL at build time. An explicit
 * NEXT_PUBLIC_REALTIME_URL always wins. For a non-public backend (docker `http://backend:8000`)
 * leave it empty: the client then uses the same-origin path, which the Next dev/`start`
 * server does proxy.
 */
function realtimeUrl() {
  if (process.env.NEXT_PUBLIC_REALTIME_URL) return process.env.NEXT_PUBLIC_REALTIME_URL;
  const backend = (process.env.BACKEND_INTERNAL_URL || "")
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
  if (!backend.startsWith("https://")) return "";
  return `${backend.replace(/^https:/, "wss:")}/api/v1/realtime/ws`;
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_REALTIME_URL: realtimeUrl(),
  },
  // Standalone output bundles necessary dependencies for production Docker container deployments.
  ...(process.env.DOCKER_BUILD === "1" || process.env.OUTPUT_STANDALONE === "1"
    ? { output: "standalone" }
    : {}),
  async rewrites() {
    // Proxy same-origin /api/* to the backend so session cookies stay first-party in dev.
    const rawBackend = process.env.BACKEND_INTERNAL_URL || "http://localhost:8000";
    const backend = rawBackend.replace(/\/+$/, "").replace(/\/api$/, "");
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
