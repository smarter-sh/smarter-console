import { loggerPrefix } from "./const";
import type { ListPage, ListQuery, Pagination, SessionContext } from "./Types";
import fetchDjangoUrl from "./django";
import { gettext, interpolate } from "./i18n";
import { setCookieForUrl } from "../components/TabbedListView/cookie";

type LoadApiResponse<TObject> = {
  objects: TObject[];
  pagination?: Pagination;
  error?: string;
};

const getUrlOrigin = (): string => {
  if (typeof window !== "undefined" && typeof window.location?.origin === "string") {
    return window.location.origin;
  }
  return "http://localhost";
};

const buildLoadUrl = (apiUrl: string, urlSlug: string, invalidateCacheFlag: boolean, query: ListQuery = {}): string => {
  const origin = getUrlOrigin();
  const isAbsoluteApiUrl = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(apiUrl);
  const normalizedBase = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  const normalizedSlug = urlSlug.replace(/^\/+|\/+$/g, "");
  const url = new URL(`${normalizedSlug}/`, new URL(normalizedBase, origin));
  url.searchParams.set("invalidate_cache", String(invalidateCacheFlag));
  if (query.page !== undefined) url.searchParams.set("page", String(query.page));
  if (query.pageSize !== undefined) url.searchParams.set("page_size", String(query.pageSize));
  const search = query.search?.trim();
  if (search) url.searchParams.set("search", search);
  if (query.ordering) url.searchParams.set("ordering", query.ordering);
  if (query.filter) url.searchParams.set("filter", query.filter);
  query.tags?.forEach((tag) => url.searchParams.append("tag", tag));
  query.annotations?.forEach((requirement) => url.searchParams.append("annotation", requirement));

  if (isAbsoluteApiUrl) {
    return url.toString();
  }

  return `${url.pathname}${url.search}${url.hash}`;
};

const readJsonSafely = async (response: Response): Promise<unknown | null> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const getErrorMessage = (status: number, responseBody: unknown): string => {
  if (
    typeof responseBody === "object" &&
    responseBody !== null &&
    "error" in responseBody &&
    typeof responseBody.error === "string" &&
    responseBody.error.trim().length > 0
  ) {
    return responseBody.error;
  }

  return interpolate(gettext("Failed to load objects (%(status)s)"), { status });
};

/**
 * Loads a page of a list api's objects from the backend.
 *
 * It is the query function of TabbedListView's pages (see ./query): it throws on failure, so that the cache keeps
 * no failed page, and the list shows the error.
 *
 * @param sessionContext - Authentication and API context used for the request.
 * @param invalidateCacheFlag - If true, forces the backend to invalidate its cache.
 * @param urlSlug - The API slug for the API group (e.g., "owned" or "shared").
 * @param query - The page, page size, search, ordering, named filter, tags and annotation selector to request. The api's defaults apply to those omitted.
 * @param signal - Aborts the request, e.g. when TanStack Query no longer needs the page.
 * @returns The page's objects and its pagination.
 * @throws Error - With the api's error message, or one that describes the failure.
 */
export const load = async <TObject,>(
  sessionContext: SessionContext,
  invalidateCacheFlag: boolean,
  urlSlug: string,
  query: ListQuery = {},
  signal?: AbortSignal,
): Promise<ListPage<TObject>> => {
  const url = buildLoadUrl(sessionContext.ApiUrl, urlSlug, invalidateCacheFlag, query);
  let response: Response;
  try {
    response = await fetchDjangoUrl(sessionContext, url, JSON.stringify({}), signal);
  } catch (error) {
    console.error(loggerPrefix, "load(): Error loading objects:", error);
    throw error instanceof Error ? error : new Error(gettext("Unable to load objects."));
  }

  const responseBody = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(getErrorMessage(response.status, responseBody));
  }

  if (
    typeof responseBody !== "object" ||
    responseBody === null ||
    !("objects" in responseBody) ||
    !Array.isArray(responseBody.objects)
  ) {
    throw new Error(gettext("Invalid response payload: expected objects array."));
  }

  const payload = responseBody as LoadApiResponse<TObject>;
  setCookieForUrl(sessionContext.ApiUrl + urlSlug + "/", payload.objects.length, 7);
  return { objects: payload.objects, pagination: payload.pagination ?? null };
};
