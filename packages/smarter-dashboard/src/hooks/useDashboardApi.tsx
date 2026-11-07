/**
 * useDashboardApi
 *
 * POSTs to a dashboard API endpoint, and returns its JSON response, or the
 * error message of a failed request. An empty url skips the request.
 *
 * Each response is a query of the console's cache (TanStack Query, see
 * @smarter/common's lib/query), keyed by the url and the request's body. So
 * a dashboard opened again, e.g. after visiting a list, shows its widgets at
 * once: a response younger than the cache's stale time without a request, and
 * an older one while it is requested again.
 *
 * - ``body`` is the request's body, e.g. a chart's ``{ periodicity }``. A new
 *   body is a new request, and the previous response stays shown until it
 *   arrives.
 * - ``refreshMs`` requests again once the response is this old, while the
 *   page is visible. A hidden tab doesn't poll, and a stale response is
 *   requested again when the window regains focus.
 *
 * ``refresh(body)`` requests again now, for a refresh button, with an optional
 * request body, such as ``{ refresh: true }`` for an endpoint that caches its
 * own results. ``refreshing`` is true until that request settles.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { fetchDjangoUrl, gettext, interpolate, useSmarterQueryClient } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { loggerPrefix } from "../const";

interface DashboardApiResult<T> {
  /** The response, or null while there's none, or the request failed. */
  data: T | null;
  /** The failed request's error message, or null. */
  error: string | null;
  /** Whether the first response hasn't arrived yet. */
  isLoading: boolean;
  /** Requests again now, with this request body, or an empty one. */
  refresh: (body?: object) => void;
  /** Whether a request that refresh() started hasn't settled yet. */
  refreshing: boolean;
}

interface DashboardApiOptions {
  /** The request's body. Empty if omitted. */
  body?: object;
  /** Request again once the response is this old, while the page is visible. */
  refreshMs?: number;
}

/** The key of a dashboard api's response: its url, and the request's body. */
export function dashboardQueryKey(url: string, body: object = {}) {
  return ["smarter-dashboard", url, body] as const;
}

/**
 * POSTs the body to a dashboard api, and returns its JSON response.
 *
 * @param sessionContext - The request's authentication and headers.
 * @param url - The api's url.
 * @param body - The request's body.
 * @param signal - Aborts the request, when TanStack Query no longer needs it.
 * @returns The response.
 * @throws Error - With the status of a failed response.
 */
export async function postDashboardApi<T>(
  sessionContext: SessionContext,
  url: string,
  body: object = {},
  signal?: AbortSignal,
): Promise<T> {
  try {
    const response = await fetchDjangoUrl(sessionContext, url, JSON.stringify(body), signal);
    if (!response.ok) {
      throw new Error(interpolate(gettext("Request failed: %(status)s"), { status: response.status }));
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(loggerPrefix, "Error fetching", url, error);
    throw error;
  }
}

export default function useDashboardApi<T>(
  sessionContext: SessionContext,
  url: string,
  { body = {}, refreshMs }: DashboardApiOptions = {},
): DashboardApiResult<T> {
  // the console's cache, or the widget's own outside the console, e.g. in its tests.
  const queryClient = useSmarterQueryClient();
  const queryKey = dashboardQueryKey(url, body);
  // the body, as a value that stays the same while the body does.
  const bodyKey = JSON.stringify(body);
  const query = useQuery(
    {
      queryKey,
      queryFn: ({ signal }) => postDashboardApi<T>(sessionContext, url, body, signal),
      enabled: !!url,
      placeholderData: keepPreviousData,
      // a widget that polls is fresh until its next poll.
      ...(refreshMs ? { refetchInterval: refreshMs, staleTime: refreshMs } : {}),
    },
    queryClient,
  );

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(
    (refreshBody?: object) => {
      if (!url) return;
      setRefreshing(true);
      queryClient
        .fetchQuery({
          queryKey,
          queryFn: ({ signal }: { signal: AbortSignal }) =>
            postDashboardApi<T>(sessionContext, url, refreshBody ?? {}, signal),
          staleTime: 0,
        })
        .catch(() => {
          // the query's error shows it.
        })
        .finally(() => setRefreshing(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the key is the url and body, which it names.
    [queryClient, sessionContext, url, bodyKey],
  );

  const failed = query.isError && !query.isFetching;
  return {
    data: failed ? null : (query.data ?? null),
    error: failed ? query.error.message : null,
    isLoading: !!url && query.data === undefined && !failed,
    refresh,
    refreshing,
  };
}
