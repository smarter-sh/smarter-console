import { describe, expect, it, vi } from "vitest";

import { getCookieForUrl, getUrlPath, setCookieForUrl } from "./cookie";

describe("list count cookies", () => {
  it("remembers how many objects a list had", () => {
    setCookieForUrl("/api/web/secret/listview/owned/", 7, 7);
    expect(getCookieForUrl("/api/web/secret/listview/owned/")).toBe(7);
  });

  it("returns undefined for a list it does not know", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(getCookieForUrl("/unknown/")).toBeUndefined();
  });

  it("keys cookies by the url's path", () => {
    expect(getUrlPath("https://example.com/a/b/?q=1")).toBe("/a/b/");
  });
});

describe("list count cookies' values", () => {
  it("returns undefined for a cookie that isn't a number", () => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    setCookieForUrl("/api/web/secret/listview/shared/", 3, 7);
    document.cookie = document.cookie
      .split("; ")
      .find((cookie) => cookie.includes("/api/web/secret/listview/shared/"))!
      .replace(/=3$/, "=many");
    expect(getCookieForUrl("/api/web/secret/listview/shared/")).toBeUndefined();
  });
});
