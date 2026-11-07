/** A resource from the resource api, loaded fresh each time a page opens. */
import { createSmarterQueryClient } from "@smarter/common";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { server } from "@test/server";

import { resourceUrl } from "@/lib/manifestPages";
import { resourceQueryKey, useResource, type ResourceManifest } from "@/lib/useResource";

const LOCATOR = "guardrail-rMTAwx";

function resource(manifest: string): ResourceManifest {
  return { kind: "Guardrail", name: "example", recordLocator: LOCATOR, manifest, manifestError: "" };
}

/** Renders the hook with the client, as the console gives it one. */
function renderWith(client: QueryClient, locator = LOCATOR) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(({ current }: { current: string }) => useResource(current), {
    wrapper,
    initialProps: { current: locator },
  });
}

describe("useResource", () => {
  it("loads the resource", async () => {
    server.use(http.get(resourceUrl(LOCATOR), () => HttpResponse.json(resource("v1"))));
    const { result } = renderWith(createSmarterQueryClient());
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toEqual({ state: "found", resource: resource("v1") }));
  });

  it("is not found when the api answers 404, for a resource that doesn't exist or that the user may not read", async () => {
    server.use(http.get(resourceUrl(LOCATOR), () => HttpResponse.json({ error: "Not found" }, { status: 404 })));
    const { result } = renderWith(createSmarterQueryClient());
    await waitFor(() => expect(result.current).toEqual({ state: "not-found" }));
  });

  it("failed for any other error", async () => {
    server.use(http.get(resourceUrl(LOCATOR), () => new HttpResponse(null, { status: 500 })));
    const { result } = renderWith(createSmarterQueryClient());
    await waitFor(() => expect(result.current).toEqual({ state: "error" }));
  });

  it("loads fresh each time a page opens, never from the cache, so the editor never starts on an old manifest", async () => {
    let version = 0;
    server.use(
      http.get(resourceUrl(LOCATOR), () => {
        version += 1;
        return HttpResponse.json(resource(`v${version}`));
      }),
    );
    const client = createSmarterQueryClient();
    const view = renderWith(client);
    await waitFor(() => expect(view.result.current).toMatchObject({ resource: { manifest: "v1" } }));
    view.unmount();
    // the page closed: its query is dropped from the cache, at once.
    await waitFor(() => expect(client.getQueryData(resourceQueryKey(LOCATOR))).toBeUndefined());

    const { result } = renderWith(client);
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toMatchObject({ resource: { manifest: "v2" } }));
  });

  it("is loading for a new locator until its own answer arrives", async () => {
    const other = "guardrail-rMjAwx";
    server.use(
      http.get(resourceUrl(LOCATOR), () => HttpResponse.json(resource("v1"))),
      http.get(resourceUrl(other), () => HttpResponse.json({ ...resource("other"), recordLocator: other })),
    );
    const { result, rerender } = renderWith(createSmarterQueryClient());
    await waitFor(() => expect(result.current.state).toBe("found"));
    rerender({ current: other });
    expect(result.current).toEqual({ state: "loading" });
    await waitFor(() => expect(result.current).toMatchObject({ resource: { manifest: "other" } }));
  });
});
