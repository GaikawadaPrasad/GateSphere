import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableControls } from "@/hooks/use-table-controls";

describe("useTableControls - Sorting Presets & Newly Added at Top", () => {
  const sampleData = [
    { id: "1", name: "Charlie", created_at: "2026-09-01T10:00:00Z" },
    { id: "2", name: "Alice", created_at: "2026-09-12T10:00:00Z" },
    { id: "3", name: "Bob", created_at: "2026-09-08T10:00:00Z" },
  ];

  it("defaults to 'newest' sort preset and puts newly added items at the top", () => {
    const { result } = renderHook(() =>
      useTableControls({
        data: sampleData,
        searchKeys: ["name"],
      }),
    );

    expect(result.current.sortPreset).toBe("newest");
    // ID 2 (Sep 12) should be first, then ID 3 (Sep 8), then ID 1 (Sep 1)
    expect(result.current.paginatedData[0].name).toBe("Alice");
    expect(result.current.paginatedData[1].name).toBe("Bob");
    expect(result.current.paginatedData[2].name).toBe("Charlie");
  });

  it("sorts by 'oldest' when preset changed to oldest", () => {
    const { result } = renderHook(() =>
      useTableControls({
        data: sampleData,
        searchKeys: ["name"],
      }),
    );

    act(() => {
      result.current.setSortPreset("oldest");
    });

    expect(result.current.sortPreset).toBe("oldest");
    // ID 1 (Sep 1) oldest, then ID 3, then ID 2
    expect(result.current.paginatedData[0].name).toBe("Charlie");
    expect(result.current.paginatedData[1].name).toBe("Bob");
    expect(result.current.paginatedData[2].name).toBe("Alice");
  });

  it("sorts alphabetically A to Z when preset changed to a-z", () => {
    const { result } = renderHook(() =>
      useTableControls({
        data: sampleData,
        searchKeys: ["name"],
      }),
    );

    act(() => {
      result.current.setSortPreset("a-z");
    });

    expect(result.current.sortPreset).toBe("a-z");
    expect(result.current.paginatedData[0].name).toBe("Alice");
    expect(result.current.paginatedData[1].name).toBe("Bob");
    expect(result.current.paginatedData[2].name).toBe("Charlie");
  });

  it("sorts reverse alphabetically Z to A when preset changed to z-a", () => {
    const { result } = renderHook(() =>
      useTableControls({
        data: sampleData,
        searchKeys: ["name"],
      }),
    );

    act(() => {
      result.current.setSortPreset("z-a");
    });

    expect(result.current.sortPreset).toBe("z-a");
    expect(result.current.paginatedData[0].name).toBe("Charlie");
    expect(result.current.paginatedData[1].name).toBe("Bob");
    expect(result.current.paginatedData[2].name).toBe("Alice");
  });
});
