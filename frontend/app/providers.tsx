"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { makeQueryClient, redirectToLoginOnUnauthorized } from "@/lib/query";

import { ToastContainer } from "@/components/common/ToastContainer";
import { ChatbotWidget } from "@/components/assistant/ChatbotWidget";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(makeQueryClient);

  // Global 401 handler — see `redirectToLoginOnUnauthorized` for why it does not clear first.
  useEffect(() => redirectToLoginOnUnauthorized(client), [client]);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ToastContainer />
      <ChatbotWidget />
    </QueryClientProvider>
  );
}
