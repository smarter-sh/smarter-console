/**
 * The console's cache of api responses: TanStack Query (https://tanstack.com/query).
 *
 * The console makes one QueryClient, and gives it to every page with QueryClientProvider, so that a page shows what
 * it last loaded at once when it opens again, while it asks the api for fresh data. The cache lives in memory only:
 * the console's in-place navigation keeps it across pages, and a reload starts it empty. The console clears it when
 * the signed-in user, or their account, changes, so that nobody sees another user's data.
 *
 * A package that renders outside the console, e.g. in Storybook, in its tests, or on its own page, has no client
 * from the console. SmarterQueryProvider gives it one of its own.
 */
import { QueryClient, QueryClientContext, QueryClientProvider } from "@tanstack/react-query";
import { useContext, useEffect, useState, type ReactNode } from "react";

/** How long a response is fresh: a page opened again within it shows the response without asking the api again. */
export const QUERY_STALE_TIME_MS = 30 * 1000;

/** How long a response that no page shows is kept, for a page that opens again later. */
export const QUERY_GC_TIME_MS = 30 * 60 * 1000;

/**
 * The key of every page of a list api's lists, e.g. to mark them stale after a change that the list shows:
 * queryClient.invalidateQueries({ queryKey: listQueryKey(apiUrl) }). TabbedListView keys each page with it, then
 * the tab and the page's query.
 *
 * @param apiUrl - The list api's url, e.g. /api/web/guardrail/listview/.
 * @returns The key.
 */
export function listQueryKey(apiUrl: string): readonly ["smarter-list", string] {
  return ["smarter-list", apiUrl] as const;
}

/**
 * A QueryClient with the console's defaults.
 *
 * A failed request is not retried: the page shows its error, and the user can try again, as before the cache.
 *
 * @returns The client.
 */
export function createSmarterQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        retry: false,
      },
    },
  });
}

/**
 * The console's QueryClient, when there is one, and otherwise one of the component's own, made once. Pass it to
 * useQuery(options, client), so that a component also works outside the console, e.g. a dashboard widget in its
 * own tests.
 *
 * @returns The client.
 */
export function useSmarterQueryClient(): QueryClient {
  const outer = useContext(QueryClientContext);
  // made once, and only used without the console's client.
  const [own] = useState(() => (outer ? null : createSmarterQueryClient()));
  useMountedQueryClient(own);
  return (outer ?? own) as QueryClient;
}

/**
 * A QueryClient of the component's own, made once, for queries that must not share the console's cache, e.g. the
 * console's session, which decides which cache the pages get.
 *
 * @returns The client.
 */
export function useOwnQueryClient(): QueryClient {
  const [own] = useState(createSmarterQueryClient);
  useMountedQueryClient(own);
  return own;
}

/**
 * Mounts a client that no QueryClientProvider mounts, while the component is mounted: a mounted client listens
 * for the window's focus and the network, and refetches its stale queries when they return.
 *
 * @param client - The client, or null for none.
 */
function useMountedQueryClient(client: QueryClient | null): void {
  useEffect(() => {
    if (!client) return;
    client.mount();
    return () => client.unmount();
  }, [client]);
}

/**
 * Gives its children a QueryClient: the console's, when there is one, and otherwise one of their own, which all of
 * them share.
 *
 * @param children - What uses the client.
 * @returns The children, with a client.
 */
export function SmarterQueryProvider({ children }: { children: ReactNode }) {
  const client = useSmarterQueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
