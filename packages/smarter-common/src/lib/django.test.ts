import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import fetchDjangoUrl, { getDjangoUrl } from "./django";
import type { SessionContext } from "./Types";

const sessionContext: SessionContext = {
  ApiUrl: "/api/listview/",
  csrfCookieName: "csrftoken",
  djangoSessionCookieName: "sessionid",
  cookieDomain: "localhost",
  debugMode: false,
  smarterClient: "@smarter/test",
  smarterClientVersion: "1.2.3",
  smarterRequestId: "request-1",
};

describe("fetchDjangoUrl", () => {
  it("POSTs json, with the CSRF token and Smarter's client headers", async () => {
    document.cookie = "csrftoken=token-123";
    let request: Request | undefined;
    server.use(
      http.post("/api/listview/owned/", ({ request: r }) => {
        request = r;
        return HttpResponse.json({ objects: [] });
      }),
    );

    const response = await fetchDjangoUrl(sessionContext, "/api/listview/owned/", JSON.stringify({ a: 1 }));

    expect(response.ok).toBe(true);
    expect(request!.headers.get("X-CSRFToken")).toBe("token-123");
    expect(request!.headers.get("Content-Type")).toBe("application/json");
    expect(request!.headers.get("X-Smarter-Client")).toBe("@smarter/test");
    expect(request!.headers.get("X-Smarter-ClientVersion")).toBe("1.2.3");
    expect(request!.headers.get("X-Smarter-RequestId")).toBe("request-1");
    expect(request!.headers.get("X-Smarter-Capabilities")).toBe("listview,cardview");
    expect(await request!.json()).toEqual({ a: 1 });
  });

  it("sends the session's capabilities", async () => {
    let capabilities: string | null = null;
    server.use(
      http.post("/api/x/", ({ request }) => {
        capabilities = request.headers.get("X-Smarter-Capabilities");
        return HttpResponse.json({});
      }),
    );
    await fetchDjangoUrl({ ...sessionContext, smarterCapabilities: ["prompt", "stream"] }, "/api/x/", "{}");
    expect(capabilities).toBe("prompt,stream");
  });

  it("never logs the CSRF token or the body", async () => {
    document.cookie = "csrftoken=token-secret";
    server.use(http.post("/api/x/", () => HttpResponse.json({})));
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});
    await fetchDjangoUrl(sessionContext, "/api/x/", JSON.stringify({ objective: "private text" }));
    const logged = JSON.stringify(debug.mock.calls);
    debug.mockRestore();
    expect(logged).not.toContain("token-secret");
    expect(logged).not.toContain("private text");
  });
});

describe("getDjangoUrl", () => {
  it("GETs, with Smarter's client headers, and no CSRF token", async () => {
    let request: Request | undefined;
    server.use(
      http.get("/api/v1/things/", ({ request: r }) => {
        request = r;
        return HttpResponse.json([]);
      }),
    );

    const response = await getDjangoUrl(sessionContext, "/api/v1/things/");

    expect(response.ok).toBe(true);
    expect(request!.method).toBe("GET");
    expect(request!.headers.get("X-Smarter-Client")).toBe("@smarter/test");
    expect(request!.headers.get("X-Smarter-RequestId")).toBe("request-1");
    expect(request!.headers.get("X-CSRFToken")).toBeNull();
  });
});
