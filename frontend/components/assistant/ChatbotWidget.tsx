"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/hooks/use-auth";
import { assistantApi, ApiError } from "@/lib/api";
import type { AssistantAction, AssistantQuickChip } from "@/types/assistant";

// Public marketing site — never show the operational assistant here, even for a
// visitor who happens to have a valid session cookie from the app in another tab.
// Keep in sync with frontend/app/(public)/*, the root marketing page.tsx, and
// frontend/app/unauthorized/.
const PUBLIC_ROUTES = new Set([
  "/",
  "/about",
  "/demo",
  "/features",
  "/platform",
  "/security",
  "/solutions",
  "/login",
  "/unauthorized",
]);

interface ChatMessage {
  id: string;
  from: "bot" | "user";
  text: string;
  actions?: AssistantAction[];
  relatedFaqs?: string[];
}

function renderText(text: string) {
  // Backend replies use **bold** and \n line breaks — render both, nothing else.
  return text.split("\n").map((line, i) => (
    <span key={i}>
      {i > 0 && <br />}
      {line
        .split(/(\*\*[^*]+\*\*)/g)
        .map((chunk, j) =>
          chunk.startsWith("**") && chunk.endsWith("**") ? (
            <strong key={j}>{chunk.slice(2, -2)}</strong>
          ) : (
            <span key={j}>{chunk}</span>
          ),
        )}
    </span>
  ));
}

export function ChatbotWidget() {
  const { data: user } = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chips, setChips] = useState<AssistantQuickChip[]>([]);
  const [input, setInput] = useState("");
  const [hasLoadedGreeting, setHasLoadedGreeting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canUseAssistant =
    !PUBLIC_ROUTES.has(pathname) &&
    Boolean(user) &&
    (user!.is_superadmin || user!.permissions?.includes("dashboards:view"));
  const communityId = user?.community_ids?.[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen || hasLoadedGreeting || !canUseAssistant) return;
    setHasLoadedGreeting(true);
    setIsLoading(true);
    assistantApi
      .quickActions(communityId)
      .then((res) => {
        setMessages([{ id: "greeting", from: "bot", text: res.greeting }]);
        setChips(res.chips || []);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof ApiError && err.code === "COMMUNITY_REQUIRED"
            ? "Pick a community from a dashboard page first, then reopen the assistant."
            : "Hi! I couldn't load your quick actions, but you can still ask me anything.";
        setMessages([{ id: "greeting", from: "bot", text: message }]);
      })
      .finally(() => setIsLoading(false));
  }, [isOpen, hasLoadedGreeting, canUseAssistant, communityId]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, from: "user", text: trimmed }]);
    setIsLoading(true);
    try {
      const res = await assistantApi.query(trimmed, communityId);
      setMessages((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          from: "bot",
          text: res.reply_text,
          actions: res.actions,
          relatedFaqs: res.related_faqs,
        },
      ]);
    } catch (err: unknown) {
      const message =
        err instanceof ApiError && err.code === "COMMUNITY_REQUIRED"
          ? "Pick a community from a dashboard page first, then ask me again."
          : err instanceof ApiError
            ? err.message
            : "Something went wrong answering that — please try again.";
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, from: "bot", text: message }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = (action: AssistantAction) => {
    if (action.action_type === "action") {
      send(action.query || action.label);
      return;
    }
    setIsOpen(false);
    router.push(action.url);
  };

  if (!canUseAssistant) return null;

  return (
    <div style={{ position: "fixed", right: "1.5rem", bottom: "1.5rem", zIndex: 60 }}>
      {isOpen && (
        <div
          style={{
            width: "min(380px, calc(100vw - 3rem))",
            height: "min(560px, calc(100vh - 8rem))",
            marginBottom: "0.85rem",
            display: "flex",
            flexDirection: "column",
            background: "var(--brand-surface, #fff)",
            borderRadius: "var(--radius-card, 16px)",
            border: "1px solid var(--border-standard, #e2e8f0)",
            boxShadow: "var(--shadow-elevated, 0 20px 40px rgba(15,23,42,0.2))",
            overflow: "hidden",
            transformOrigin: "bottom right",
            animation: "chatPanelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.1rem",
              background: "var(--brand-primary, #2563EB)",
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span style={{ fontSize: "1.25rem" }}>🤖</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>GateSphere Assistant</div>
                <div style={{ fontSize: "0.7rem", opacity: 0.85 }}>
                  Ask about dues, visitors, tickets & more
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close assistant"
              style={{
                background: "transparent",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                fontSize: "1.1rem",
              }}
            >
              ✕
            </button>
          </div>

          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            {messages.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: m.from === "user" ? "flex-end" : "flex-start",
                  gap: "0.4rem",
                  animation: "chatBubbleIn 0.2s ease-out both",
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "0.65rem 0.85rem",
                    borderRadius: 12,
                    fontSize: "0.82rem",
                    lineHeight: 1.5,
                    whiteSpace: "pre-wrap",
                    background: m.from === "user" ? "var(--brand-primary, #2563EB)" : "#f1f5f9",
                    color: m.from === "user" ? "#fff" : "var(--brand-body, #334155)",
                  }}
                >
                  {renderText(m.text)}
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {m.actions.map((a) => (
                      <button
                        key={a.url + a.label}
                        type="button"
                        onClick={() => handleAction(a)}
                        className="btn btn-secondary"
                        style={{ fontSize: "0.72rem", padding: "0.3rem 0.6rem" }}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                )}
                {m.relatedFaqs && m.relatedFaqs.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.3rem",
                      width: "100%",
                    }}
                  >
                    {m.relatedFaqs.map((faq) => (
                      <button
                        key={faq}
                        type="button"
                        onClick={() => send(faq)}
                        style={{
                          textAlign: "left",
                          background: "transparent",
                          border: "1px dashed var(--border-standard, #cbd5e1)",
                          borderRadius: 8,
                          padding: "0.4rem 0.6rem",
                          fontSize: "0.72rem",
                          color: "var(--brand-primary, #2563EB)",
                          cursor: "pointer",
                        }}
                      >
                        💬 {faq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {chips.length > 0 && messages.length <= 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {chips.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => send(c.query)}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.72rem", padding: "0.35rem 0.65rem" }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {isLoading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  fontSize: "0.78rem",
                  color: "var(--muted, #94a3b8)",
                }}
              >
                Thinking…
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            style={{
              display: "flex",
              gap: "0.5rem",
              padding: "0.75rem",
              borderTop: "1px solid var(--border-standard, #e2e8f0)",
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="Ask a question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              style={{ flex: 1 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !input.trim()}
              style={{ padding: "0.5rem 0.9rem" }}
            >
              ➤
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close assistant" : "Open assistant"}
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          background: "var(--brand-primary, #2563EB)",
          color: "#fff",
          fontSize: "1.4rem",
          boxShadow: "var(--shadow-elevated, 0 12px 24px rgba(37,99,235,0.35))",
          marginLeft: "auto",
          display: "block",
          transition: "transform 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          {isOpen ? "✕" : "💬"}
        </span>
      </button>
    </div>
  );
}
