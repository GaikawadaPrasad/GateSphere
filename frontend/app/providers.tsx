"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import { makeQueryClient } from "@/lib/query";

import { ToastContainer } from "@/components/common/ToastContainer";
import { ChatbotWidget } from "@/components/assistant/ChatbotWidget";

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [client] = useState(makeQueryClient);

  // Global 401 handler: any query/mutation that 401s bounces to /login.
  useEffect(() => {
    const cache = client.getQueryCache();
    const unsub = cache.subscribe((event) => {
      if (event.type === "updated" && event.query.state.error instanceof ApiError) {
        if (event.query.state.error.isUnauthenticated) {
          if (typeof window !== "undefined" && window.location.pathname.startsWith("/login")) {
            return;
          }
          client.clear();
          const next =
            typeof window !== "undefined"
              ? encodeURIComponent(window.location.pathname + window.location.search)
              : "";
          window.location.replace(next ? `/login?next=${next}` : "/login");
        }
      }
    });
    return unsub;
  }, [client, router]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastContainer />
      <ChatbotWidget />
    </QueryClientProvider>
  );
}
