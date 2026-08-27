import Link from "next/link";

export default function Home() {
  return (
    <main className="container">
      <h1>GateSphere</h1>
      <p>Enterprise residential community, visitor, security &amp; facility management platform.</p>
      <div className="card">
        <p>
          <Link href="/login">Sign in</Link> · <Link href="/dashboard">Dashboard</Link> ·{" "}
          <a href="/api/v1/openapi.json">API schema</a> · <a href="/docs">API docs</a>
        </p>
      </div>
    </main>
  );
}
