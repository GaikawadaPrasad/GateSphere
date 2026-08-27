"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({ queryKey: ["me"], queryFn: auth.me });

  if (isLoading) return <main className="container">Loading…</main>;
  if (isError || !data) {
    router.replace("/login?next=/dashboard");
    return null;
  }

  return (
    <main className="container">
      <h1>Dashboard</h1>
      <div className="card">
        <p>
          Signed in as <strong>{data.full_name}</strong> ({data.email})
        </p>
        <p>Permissions: {data.is_superadmin ? "all (*)" : data.permissions.join(", ") || "none"}</p>
        <button
          onClick={async () => {
            await auth.logout();
            router.replace("/login");
          }}
        >
          Sign out
        </button>
      </div>
      <p style={{ color: "var(--muted)", marginTop: "1rem" }}>
        Role-specific KPI widgets are wired per <code>docs/frontend/modules/dashboards/README.md</code>.
      </p>
    </main>
  );
}
