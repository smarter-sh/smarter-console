import { describe, expect, it } from "vitest";

import { cookieMetaFactory, getCookie, setCookie } from "./cookie";

describe("getCookie", () => {
  it("reads a cookie of the page's domain", () => {
    document.cookie = "csrftoken=abc%20123";
    expect(getCookie({ name: "csrftoken", domain: "localhost" })).toBe("abc 123");
  });

  it("returns the default for a missing cookie, or another domain's", () => {
    document.cookie = "csrftoken=abc";
    expect(getCookie({ name: "sessionid", domain: "localhost" }, "none")).toBe("none");
    expect(getCookie({ name: "csrftoken", domain: "example.com" }, null)).toBeNull();
  });
});

describe("setCookie", () => {
  it("sets, and clears, a cookie", () => {
    const cookie = { name: "theme", expiration: 60_000, domain: "localhost", value: null };
    setCookie(cookie, "dark");
    expect(getCookie(cookie)).toBe("dark");
    setCookie(cookie, null);
    expect(getCookie(cookie)).toBe("");
  });
});

describe("cookieMetaFactory", () => {
  it("describes a cookie, without a value by default", () => {
    expect(cookieMetaFactory("theme", null, "localhost")).toEqual({
      name: "theme",
      expiration: null,
      domain: "localhost",
      value: null,
    });
    expect(cookieMetaFactory("theme", 60_000, "localhost", "dark").value).toBe("dark");
  });
});
