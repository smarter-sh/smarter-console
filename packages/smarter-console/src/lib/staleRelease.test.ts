/** A page of an earlier release loads the console again, once. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { isStaleChunkError, RELOAD_GUARD_MS, RELOAD_KEY, reloadOnce } from "@/lib/staleRelease";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isStaleChunkError()", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://example.com/static/react/assets/Page-abc123.js",
    "error loading dynamically imported module: https://example.com/assets/Page-abc123.js",
    "Importing a module script failed.",
    "Unable to preload CSS for /assets/Page-abc123.css",
  ])("is a chunk that failed to load: %s", (message) => {
    expect(isStaleChunkError(new TypeError(message))).toBe(true);
  });

  it("is not any other error", () => {
    expect(isStaleChunkError(new Error("Cannot read properties of undefined"))).toBe(false);
    expect(isStaleChunkError("Failed to fetch dynamically imported module")).toBe(false);
    expect(isStaleChunkError(null)).toBe(false);
  });
});

describe("reloadOnce()", () => {
  it("reloads, and records when", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
    expect(window.sessionStorage.getItem(RELOAD_KEY)).toBe("1000000");
  });

  it("doesn't reload again right after a reload, so that a missing chunk can't reload forever", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    window.sessionStorage.setItem(RELOAD_KEY, "1000000");
    const reload = vi.fn();
    now.mockReturnValue(1_000_000 + RELOAD_GUARD_MS - 1);
    expect(reloadOnce(reload)).toBe(false);
    now.mockReturnValue(1_000_000 + RELOAD_GUARD_MS);
    expect(reloadOnce(reload)).toBe(true);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("doesn't reload when storage is blocked, since the guard can't hold", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it("doesn't reload when storage can't record it", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    const reload = vi.fn();
    expect(reloadOnce(reload)).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });
});
