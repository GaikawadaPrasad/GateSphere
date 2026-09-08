"use client";

import { useEffect, useState } from "react";

interface SearchInputProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value: initialValue = "",
  onChange,
  placeholder = "Search records...",
  debounceMs = 300,
  className = "",
}: SearchInputProps) {
  const [query, setQuery] = useState(initialValue);

  useEffect(() => {
    setQuery(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const handler = setTimeout(() => {
      onChange(query);
    }, debounceMs);
    return () => clearTimeout(handler);
  }, [query, debounceMs, onChange]);

  return (
    <div style={{ position: "relative", display: "inline-block", width: "100%" }} className={className}>
      <span
        style={{
          position: "absolute",
          left: "0.75rem",
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--muted)",
          pointerEvents: "none",
          fontSize: "0.875rem",
        }}
      >
        🔍
      </span>
      <input
        type="text"
        className="input-field"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ paddingLeft: "2.25rem", paddingRight: query ? "2rem" : "0.75rem" }}
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            onChange("");
          }}
          style={{
            position: "absolute",
            right: "0.75rem",
            top: "50%",
            transform: "translateY(-50%)",
            background: "transparent",
            border: "none",
            color: "var(--muted)",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.75rem",
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
