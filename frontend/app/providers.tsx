"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { makeQueryClient } from "@/lib/query";

import { ToastContainer } from "@/components/common/ToastContainer";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(makeQueryClient);

  // Global 401 handler: any query/mutation that 401s bounces to /login.
  useEffect(() => {
    const cache = client.getQueryCache();
    const unsub = cache.subscribe((event) => {
      if (event.type === "updated" && event.query.state.error instanceof ApiError) {
        if (event.query.state.error.isUnauthenticated) {
          client.clear();
          router.replace("/login");
        }
      }
    });
    return unsub;
  }, [client, router]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastContainer />
    </QueryClientProvider>
  );
}
