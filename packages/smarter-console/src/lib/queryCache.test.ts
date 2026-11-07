/** The console's cache of api responses starts empty for each user and account. */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ConsoleSession } from "@/contract.gen";
import { cacheOwner, useSessionQueryClient } from "@/lib/queryCache";
import { userSession } from "@/mocks/fixtures";

const otherUser: ConsoleSession = { ...userSession, user: { ...userSession.user!, username: "grace" } };
const otherAccount: ConsoleSession = {
  ...userSession,
  account: { ...userSession.account!, accountNumber: "2718-2818-2845" },
};
const visitor: ConsoleSession = { ...userSession, user: null, account: null };

function mount(session: ConsoleSession | null) {
  return renderHook(({ current }: { current: ConsoleSession | null }) => useSessionQueryClient(current), {
    initialProps: { current: session },
  });
}

describe("the console's cache", () => {
  it("belongs to a session's user and account", () => {
    expect(cacheOwner(userSession)).toBe("ada 3141-5926-5359");
    expect(cacheOwner(visitor)).toBe(" ");
    expect(cacheOwner(null)).toBe(" ");
  });

  it("stays the same while the user and account do, e.g. when the session is loaded again", () => {
    const { result, rerender } = mount(userSession);
    const first = result.current;
    first.setQueryData(["kept"], 1);
    rerender({ current: { ...userSession } });
    expect(result.current).toBe(first);
    expect(result.current.getQueryData(["kept"])).toBe(1);
  });

  it.each([
    ["another user signs in", otherUser],
    ["the user switches to another account", otherAccount],
    ["the user signs out", visitor],
  ])("starts empty when %s, and clears the old one", (_, next) => {
    const { result, rerender } = mount(userSession);
    const first = result.current;
    first.setQueryData(["private"], "ada's");
    rerender({ current: next });
    expect(result.current).not.toBe(first);
    expect(result.current.getQueryData(["private"])).toBeUndefined();
    expect(first.getQueryData(["private"])).toBeUndefined();
  });
});
