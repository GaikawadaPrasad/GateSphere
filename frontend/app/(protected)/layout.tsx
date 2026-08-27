"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-auth";

/**
 * Auth shell for every protected route. `middleware.ts` does the coarse
 * cookie-presence redirect; this re-validates against the backend
 * (`/auth/me`) and is the client-side authority for "am I signed in".
 */
export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: user, isLoading, isFetched } = useMe();

  useEffect(() => {
    if (isFetched && !user) router.replace("/login");
  }, [isFetched, user, router]);

  if (isLoading) {
    return (
      <main className="container" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading…</span>
        <div className="card">Loading…</div>
      </main>
    );
  }
  if (!user) return null;

  return <>{children}</>;
}
