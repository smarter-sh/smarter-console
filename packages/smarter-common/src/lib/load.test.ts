import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import { getCookieForUrl } from "../components/TabbedListView/cookie";
import { load } from "./load";
import type { SessionContext } from "./Types";

const sessionContext = {
  ApiUrl: "/api/listview/",
  csrfCookieName: "csrftoken",
  cookieDomain: "localhost",
} as SessionContext;

describe("load", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads a tab's objects, and remembers how many there were", async () => {
    let url = "";
    server.use(
      http.post("/api/listview/owned/", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ objects: [{ id: 1 }, { id: 2 }] });
      }),
    );
    expect(await load(sessionContext, true, "owned")).toEqual({
      objects: [{ id: 1 }, { id: 2 }],
      pagination: null,
    });
    const params = new URL(url).searchParams;
    expect(params.get("invalidate_cache")).toBe("true");
    expect([params.get("page"), params.get("page_size"), params.get("search"), params.get("ordering")]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(getCookieForUrl("/api/listview/owned/")).toBe(2);
  });

  it("requests a sorted page of the objects that match a search, and returns its pagination", async () => {
    let url = "";
    const pagination = {
      page: 2,
      pageSize: 10,
      numPages: 3,
      count: 21,
      search: "bot",
      ordering: "-name",
      sortFields: ["name"],
    };
    server.use(
      http.post("/api/listview/shared/", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ objects: [{ id: 11 }], pagination });
      }),
    );
    const result = await load(sessionContext, false, "shared", {
      page: 2,
      pageSize: 10,
      search: "  bot ",
      ordering: "-name",
    });
    expect(result).toEqual({ objects: [{ id: 11 }], pagination });
    const params = new URL(url).searchParams;
    expect([params.get("page"), params.get("page_size"), params.get("search"), params.get("ordering")]).toEqual([
      "2",
      "10",
      "bot",
      "-name",
    ]);
  });

  it("does not request an empty search, or the default order", async () => {
    let url = "";
    server.use(
      http.post("/api/listview/owned/", ({ request }) => {
        url = request.url;
        return HttpResponse.json({ objects: [] });
      }),
    );
    await load(sessionContext, false, "owned", { search: "   ", ordering: "" });
    expect(new URL(url).searchParams.has("search")).toBe(false);
    expect(new URL(url).searchParams.has("ordering")).toBe(false);
  });

  it("throws the api's error message", async () => {
    server.use(http.post("/api/listview/owned/", () => HttpResponse.json({ error: "Not allowed" }, { status: 403 })));
    await expect(load(sessionContext, false, "owned")).rejects.toThrow("Not allowed");
  });

  it("throws the status of an error without a message", async () => {
    server.use(http.post("/api/listview/owned/", () => new HttpResponse("oops", { status: 502 })));
    await expect(load(sessionContext, false, "owned")).rejects.toThrow("Failed to load objects (502)");
  });

  it("rejects a response without an objects array", async () => {
    server.use(http.post("/api/listview/owned/", () => HttpResponse.json({ items: [] })));
    await expect(load(sessionContext, false, "owned")).rejects.toThrow(
      "Invalid response payload: expected objects array.",
    );
  });

  it("throws when the request fails, and stops when it is aborted", async () => {
    server.use(http.post("/api/listview/owned/", () => HttpResponse.error()));
    await expect(load(sessionContext, false, "owned")).rejects.toThrow();
    const aborted = new AbortController();
    aborted.abort();
    await expect(load(sessionContext, false, "owned", {}, aborted.signal)).rejects.toThrow();
  });
});

describe("load's urls and failures", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("requests an api url without a trailing slash, and an absolute one", async () => {
    const urls: string[] = [];
    server.use(
      http.post("/api/listview/owned/", ({ request }) => {
        urls.push(request.url);
        return HttpResponse.json({ objects: [] });
      }),
    );
    await load({ ...sessionContext, ApiUrl: "/api/listview" }, false, "/owned/");
    await load({ ...sessionContext, ApiUrl: "http://localhost:9357/api/listview/" }, false, "owned");
    expect(urls).toEqual([
      "http://localhost:9357/api/listview/owned/?invalidate_cache=false",
      "http://localhost:9357/api/listview/owned/?invalidate_cache=false",
    ]);
  });

  it("throws an Error of its own when the request fails with something else", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("offline");
    await expect(load(sessionContext, false, "owned")).rejects.toThrow("Unable to load objects.");
  });
});
