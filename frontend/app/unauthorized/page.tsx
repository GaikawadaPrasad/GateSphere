import Link from "next/link";

/**
 * The 403 / access-denied screen (AGENTS.md §5.1). Not a route state — pages
 * that hit a 403 for a specific action disable the control instead; this page
 * is for a whole area the role may not enter.
 */
export default function UnauthorizedPage() {
  return (
    <main className="container">
      <h1>Access denied</h1>
      <div className="card">
        <p>Your role does not have access to this area.</p>
        <p>
          <Link href="/dashboard">Back to dashboard</Link>
        </p>
      </div>
    </main>
  );
}
