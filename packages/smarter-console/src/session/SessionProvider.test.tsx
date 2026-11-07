/** The console's session: loaded once, again on refresh() and on focus once stale, and replaced without a request. */
import { focusManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import type { ConsoleSession } from "@/contract.gen";
import { SESSION_API_URL } from "@/lib/const";
import { userSession, visitorSession } from "@/mocks/fixtures";
import { SessionProvider } from "@/session/SessionProvider";
import { useConsoleSession } from "@/session/context";

const wrapper = ({ children }: { children: ReactNode }) => <SessionProvider>{children}</SessionProvider>;

/** Serves these sessions in turn, the last one from then on, and counts the requests. */
function serve(...sessions: ConsoleSession[]) {
  const counter = { requests: 0 };
  server.use(
    http.get(SESSION_API_URL, () => {
      const session = sessions[Math.min(counter.requests, sessions.length - 1)];
      counter.requests += 1;
      return HttpResponse.json(session);
    }),
  );
  return counter;
}

afterEach(() => {
  focusManager.setFocused(undefined);
});

describe("SessionProvider", () => {
  it("loads the session once", async () => {
    const counter = serve(userSession);
    const { result } = renderHook(() => useConsoleSession(), { wrapper });
    expect(result.current.session).toBeNull();
    await waitFor(() => expect(result.current.session?.user?.username).toBe("ada"));
    expect(result.current.error).toBeNull();
    expect(counter.requests).toBe(1);
  });

  it("loads it again on refresh(), e.g. after signing out", async () => {
    const counter = serve(userSession, visitorSession);
    const { result } = renderHook(() => useConsoleSession(), { wrapper });
    await waitFor(() => expect(result.current.session?.user).not.toBeNull());
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current.session?.user).toBeNull());
    expect(counter.requests).toBe(2);
  });

  it("uses a session that an api call returned, without a request", async () => {
    const counter = serve(visitorSession);
    const { result } = renderHook(() => useConsoleSession(), { wrapper });
    await waitFor(() => expect(result.current.session).not.toBeNull());
    act(() => result.current.replace(userSession));
    await waitFor(() => expect(result.current.session?.user?.username).toBe("ada"));
    expect(counter.requests).toBe(1);
  });

  it("says why it couldn't load, and recovers on refresh()", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let fail = true;
    server.use(
      http.get(SESSION_API_URL, () =>
        fail ? new HttpResponse(null, { status: 503 }) : HttpResponse.json(userSession),
      ),
    );
    const { result } = renderHook(() => useConsoleSession(), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.session).toBeNull();
    fail = false;
    await act(() => result.current.refresh());
    await waitFor(() => expect(result.current).toMatchObject({ error: null, session: { user: { username: "ada" } } }));
  });

  it("loads it again when the window regains focus once it is stale, e.g. after a sign-out in another tab", async () => {
    const counter = serve(userSession, visitorSession);
    const now = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(now);
    const { result } = renderHook(() => useConsoleSession(), { wrapper });
    await waitFor(() => expect(result.current.session?.user).not.toBeNull());

    // focus within the stale time: no request.
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(counter.requests).toBe(1);

    // a minute later.
    clock.mockReturnValue(now + 60 * 1000);
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(result.current.session?.user).toBeNull());
    expect(counter.requests).toBe(2);
  });
});
