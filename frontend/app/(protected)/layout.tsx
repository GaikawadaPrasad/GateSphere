"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMe } from "@/hooks/use-auth";
import { BrandLoader } from "@/components/common/BrandLoader";

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

  if (isLoading) return <BrandLoader message="Securing your session…" />;
  if (!user) return <BrandLoader message="Redirecting to sign in…" />;

  return <>{children}</>;
}
