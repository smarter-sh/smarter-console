import { createSmarterQueryClient } from "@smarter/common";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { sessionContext } from "@/mocks/fixtures";
import { server } from "@test/server";

import useDashboardApi, { dashboardQueryKey } from "@/hooks/useDashboardApi";

const URL = "/api/web/dashboard/x/";
const MINUTE = 60 * 1000;

type Answer = { answer: number };

/** Serves answer 1, 2, 3, ... and records the requests' bodies. */
function countingHandler() {
  const counter = { requests: 0, bodies: [] as unknown[] };
  server.use(
    http.post(URL, async ({ request }) => {
      counter.requests += 1;
      counter.bodies.push(await request.json());
      return HttpResponse.json({ answer: counter.requests });
    }),
  );
  return counter;
}

/** Renders the hook with the client, as the console gives it one. */
function renderWith(client: QueryClient, options?: Parameters<typeof useDashboardApi>[2]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useDashboardApi<Answer>(sessionContext, URL, options), { wrapper });
}

describe("useDashboardApi", () => {
  it("returns the api's data", async () => {
    server.use(http.post(URL, () => HttpResponse.json({ answer: 42 })));
    const { result } = renderHook(() => useDashboardApi<Answer>(sessionContext, URL));
    expect(result.current).toMatchObject({ data: null, error: null, isLoading: true, refreshing: false });
    await waitFor(() => expect(result.current.data).toEqual({ answer: 42 }));
    expect(result.current.isLoading).toBe(false);
  });

  it("returns the request's error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(URL, () => new HttpResponse(null, { status: 500 })));
    const { result } = renderHook(() => useDashboardApi(sessionContext, URL));
    await waitFor(() => expect(result.current.error).toBe("Request failed: 500"));
    expect(result.current).toMatchObject({ data: null, isLoading: false });
  });

  it("requests nothing without a url", () => {
    // an unhandled request would fail the test.
    const { result } = renderHook(() => useDashboardApi(sessionContext, ""));
    expect(result.current).toMatchObject({ data: null, isLoading: false });
  });

  it("shows the response at once when the dashboard opens again, without a request while it is fresh", async () => {
    const counter = countingHandler();
    const client = createSmarterQueryClient();
    const view = renderWith(client);
    await waitFor(() => expect(view.result.current.data).toEqual({ answer: 1 }));
    view.unmount();

    const { result: secondVisit } = renderWith(client);
    expect(secondVisit.current).toMatchObject({ data: { answer: 1 }, isLoading: false });
    expect(counter.requests).toBe(1);
  });

  it("shows a stale response at once, and requests it again", async () => {
    const counter = countingHandler();
    const client = createSmarterQueryClient();
    client.setQueryData(dashboardQueryKey(URL), { answer: 0 }, { updatedAt: 1 });
    const { result } = renderWith(client);
    expect(result.current.data).toEqual({ answer: 0 });
    await waitFor(() => expect(result.current.data).toEqual({ answer: 1 }));
    expect(counter.requests).toBe(1);
  });

  it("requests a new body, and shows the previous response until it arrives", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(URL, async ({ request }) => {
        const body = (await request.json()) as { period: string };
        bodies.push(body);
        if (body.period === "week") await delay(100);
        return HttpResponse.json({ answer: body.period === "week" ? 7 : 1 });
      }),
    );
    let period = "day";
    const { result, rerender } = renderHook(() => useDashboardApi<Answer>(sessionContext, URL, { body: { period } }));
    await waitFor(() => expect(result.current.data).toEqual({ answer: 1 }));
    period = "week";
    rerender();
    expect(result.current.data).toEqual({ answer: 1 });
    await waitFor(() => expect(result.current.data).toEqual({ answer: 7 }));
    expect(bodies).toEqual([{ period: "day" }, { period: "week" }]);
  });

  it("polls every refreshMs, and is fresh until then", async () => {
    countingHandler();
    const client = createSmarterQueryClient();
    const { result } = renderWith(client, { refreshMs: 5 * MINUTE });
    await waitFor(() => expect(result.current.data).toEqual({ answer: 1 }));
    const query = client.getQueryCache().find({ queryKey: dashboardQueryKey(URL) });
    const options = query?.observers[0].options;
    expect(options?.refetchInterval).toBe(5 * MINUTE);
    expect(options?.staleTime).toBe(5 * MINUTE);
    // a hidden tab doesn't poll.
    expect(options?.refetchIntervalInBackground).toBeFalsy();
  });

  it("requests again now on refresh(), with its body, and says it's refreshing until it settles", async () => {
    const bodies: unknown[] = [];
    let release: () => void = () => {};
    server.use(
      http.post(URL, async ({ request }) => {
        bodies.push(await request.json());
        if (bodies.length > 1) {
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        }
        return HttpResponse.json({ answer: bodies.length });
      }),
    );
    const { result } = renderHook(() => useDashboardApi<Answer>(sessionContext, URL));
    await waitFor(() => expect(result.current.data).toEqual({ answer: 1 }));

    act(() => result.current.refresh({ refresh: true }));
    expect(result.current.refreshing).toBe(true);
    await waitFor(() => expect(bodies).toEqual([{}, { refresh: true }]));
    release();
    await waitFor(() => expect(result.current).toMatchObject({ data: { answer: 2 }, refreshing: false }));
  });

  it("shows a failed refresh's error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = false;
    server.use(
      http.post(URL, () => (fail ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ answer: 1 }))),
    );
    const { result } = renderHook(() => useDashboardApi<Answer>(sessionContext, URL));
    await waitFor(() => expect(result.current.data).toEqual({ answer: 1 }));
    fail = true;
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current).toMatchObject({ error: "Request failed: 503", refreshing: false }));
  });

  it("refresh() does nothing without a url", () => {
    const { result } = renderHook(() => useDashboardApi(sessionContext, ""));
    act(() => result.current.refresh());
    expect(result.current.refreshing).toBe(false);
  });

  it("stops its request when it unmounts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let signal: AbortSignal | null = null;
    server.use(
      http.post(URL, async ({ request }) => {
        signal = request.signal;
        await delay("infinite");
        return HttpResponse.json({ answer: 1 });
      }),
    );
    const { unmount } = renderHook(() => useDashboardApi(sessionContext, URL));
    await waitFor(() => expect(signal).not.toBeNull());
    unmount();
    await waitFor(() => expect(signal?.aborted).toBe(true));
  });
});
