"use client";

import React, { useState, useEffect } from "react";

interface DebouncedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
  icon?: React.ReactNode;
}

export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 300,
  icon,
  className = "",
  placeholder = "Search…",
  ...props
}: DebouncedInputProps) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <div
      style={{ position: "relative", display: "inline-flex", alignItems: "center", width: "100%" }}
    >
      {icon && (
        <span
          style={{
            position: "absolute",
            left: "0.75rem",
            color: "var(--brand-body)",
            display: "flex",
            alignItems: "center",
            pointerEvents: "none",
          }}
        >
          {icon}
        </span>
      )}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={`input-field ${className}`}
        style={{
          paddingLeft: icon ? "2.25rem" : "0.75rem",
          paddingRight: value ? "2rem" : "0.75rem",
        }}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            setValue("");
            onChange("");
          }}
          style={{
            position: "absolute",
            right: "0.5rem",
            background: "transparent",
            border: "none",
            color: "var(--brand-body)",
            cursor: "pointer",
            padding: "0.25rem",
            display: "flex",
            alignItems: "center",
            fontSize: "14px",
          }}
          title="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
