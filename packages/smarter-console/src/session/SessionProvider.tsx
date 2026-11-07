/**
 * The console's session: who is using it, and how the platform is set up, from GET /api/web/session/.
 *
 * The provider loads it when the console starts. Components read it with useConsoleSession(), and call refresh()
 * after anything that changes it: signing in, signing out, or changing profile.
 *
 * The session is a TanStack Query query, in a QueryClient of its own, made once. It can't share the pages' cache:
 * the console gives the pages a new, empty cache for each user and account, which the session names (see
 * lib/queryCache). It is loaded again when the window regains focus after half a minute, so a sign-out in another
 * tab sends this one to the sign-in page.
 */
import { useOwnQueryClient } from "@smarter/common";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, type ReactNode } from "react";

import type { ConsoleSession } from "@/contract.gen";
import { getJson } from "@/lib/api";
import { loggerPrefix, SESSION_API_URL } from "@/lib/const";
import { SessionContext, type SessionState } from "@/session/context";

/** The session query's key. */
const SESSION_QUERY_KEY = ["smarter-session"] as const;

/** How long the session is fresh: the window's focus loads it again only once it is older. */
const SESSION_STALE_TIME_MS = 30 * 1000;

/**
 * Loads the session.
 *
 * @param signal - Aborts the request, when TanStack Query no longer needs it.
 * @returns The session.
 * @throws ApiError - When the session api fails, or another error when it can't be reached.
 */
async function loadSession(signal?: AbortSignal): Promise<ConsoleSession> {
  try {
    return await getJson<ConsoleSession>(SESSION_API_URL, signal);
  } catch (e) {
    console.error(`${loggerPrefix} SessionProvider could not load the session:`, e);
    throw e;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  // the session's own client, made once. See above.
  const client = useOwnQueryClient();
  // fresh for half a minute, rather than the pages' none: the window's focus would load it again each time.
  const query = useQuery(
    { queryKey: SESSION_QUERY_KEY, queryFn: ({ signal }) => loadSession(signal), staleTime: SESSION_STALE_TIME_MS },
    client,
  );
  const session = query.data ?? null;
  const error = query.error;

  /** Load the session again now. A failure is the query's error, which the console shows when it has no session. */
  const refresh = useCallback(async () => {
    try {
      await client.fetchQuery({
        queryKey: SESSION_QUERY_KEY,
        queryFn: ({ signal }) => loadSession(signal),
        staleTime: 0,
      });
    } catch {
      // the query's error says why.
    }
  }, [client]);

  // the page's language follows the session's, as Django's base template did.
  useEffect(() => {
    if (!session) return;
    document.documentElement.lang = session.language.current;
    document.documentElement.dir = session.language.bidi ? "rtl" : "ltr";
  }, [session]);

  // a session that an api call returned, e.g. signing in, without loading it again.
  const replace = useCallback(
    (next: ConsoleSession) => {
      client.setQueryData(SESSION_QUERY_KEY, next);
    },
    [client],
  );

  const value = useMemo<SessionState>(() => ({ session, error, refresh, replace }), [session, error, refresh, replace]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
