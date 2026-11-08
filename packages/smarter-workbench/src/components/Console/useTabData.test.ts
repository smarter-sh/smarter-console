import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useTabData } from "./useTabData";

/** A promise, and the functions that settle it. */
function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useTabData", () => {
  it("returns the data once it loads, and loads it only once", async () => {
    const load = vi.fn(() => Promise.resolve("data"));
    const { result, rerender } = renderHook(() => useTabData(load));
    expect(result.current).toEqual({ data: null, error: null });
    await waitFor(() => expect(result.current).toEqual({ data: "data", error: null }));
    rerender();
    expect(load).toHaveBeenCalledOnce();
  });

  it("returns the message of an error", async () => {
    const { result } = renderHook(() => useTabData(() => Promise.reject(new Error("Not found"))));
    await waitFor(() => expect(result.current).toEqual({ data: null, error: "Not found" }));
  });

  it("returns what was thrown that isn't an error, as text", async () => {
    const { result } = renderHook(() => useTabData(() => Promise.reject("offline")));
    await waitFor(() => expect(result.current).toEqual({ data: null, error: "offline" }));
  });

  it.each([
    ["data", (pending: ReturnType<typeof deferred<string>>) => pending.resolve("late")],
    ["error", (pending: ReturnType<typeof deferred<string>>) => pending.reject(new Error("late"))],
  ])("ignores %s that arrives after the tab unmounts", async (_, settle) => {
    const pending = deferred<string>();
    const { result, unmount } = renderHook(() => useTabData(() => pending.promise));
    unmount();
    settle(pending);
    await pending.promise.catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current).toEqual({ data: null, error: null });
  });
});
