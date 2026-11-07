/**
 * A resource from the resource api, by its record locator: the hook of the pages that show one resource, the
 * manifest pages and the workbench. The api finds the resource if the user may read it, by the backend's rule
 * (smarter.apps.dashboard.resource_detail.readable_instance), and answers 404 otherwise, as for one that doesn't exist,
 * so that a page shows Page not found for both.
 *
 * The resource is a TanStack Query query, which cancels its request when the page closes, but it is never served from
 * the cache: a page loads it fresh each time it opens, and the query is dropped when the page closes. The manifest
 * editor takes its manifest once, when it opens, so a cached manifest, replaced a moment later by a newer one, would
 * leave the editor on the old one, and a save would overwrite the newer change.
 */
import { useQuery } from "@tanstack/react-query";

import { ApiError, getJson } from "@/lib/api";
import { resourceUrl } from "@/lib/manifestPages";

/** What the pages read of the resource api's answer. See smarter.apps.dashboard.resource_detail.ResourceDetail. */
export interface ResourceManifest {
  kind: string;
  name: string | null;
  recordLocator: string;
  manifest: string | null;
  manifestError: string;
}

export type LoadedResource =
  { state: "loading" } | { state: "found"; resource: ResourceManifest } | { state: "not-found" } | { state: "error" };

/** The key of a resource's query. */
export function resourceQueryKey(locator: string) {
  return ["smarter-resource", locator] as const;
}

/**
 * Load a resource by its record locator.
 *
 * @param locator - The record locator, e.g. guardrail-rMTAwx.
 * @returns The resource, or whether it is still loading, not found (or not readable), or failed to load. A new
 *   locator is loading until its own answer arrives, so that a page never shows the previous resource.
 */
export function useResource(locator: string): LoadedResource {
  const query = useQuery({
    queryKey: resourceQueryKey(locator),
    queryFn: ({ signal }) => getJson<ResourceManifest>(resourceUrl(locator), signal),
    // fresh on each visit, and not loaded again while the page is open. See above.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  if (query.data) return { state: "found", resource: query.data };
  if (query.isError) {
    if (query.error instanceof ApiError && query.error.status === 404) return { state: "not-found" };
    return { state: "error" };
  }
  return { state: "loading" };
}
