/**
 * Plain links to the console's own pages, opened in place.
 *
 * The console's packages link to its pages with plain <a href> elements: they don't use the router, and some of them
 * render outside the console too, e.g. the LLMClient deployment page on a deployed LLMClient's own host. A click on
 * such a link would load the whole console again: its session, theme, translations and code. The console listens for
 * clicks on the document instead, and opens a link to one of its routes with the router, as the sidebar's links do.
 * Every other link behaves as the browser decides: another origin, a backend path such as /admin/ or /api/, a link
 * to a new tab or a download, and a click with a modifier key or a button other than the main one.
 */
import { matchRoutes, type RouteObject } from "react-router";
import { useEffect } from "react";

/** What the console needs of its router: its routes, and a way to open a path. */
export interface InPlaceRouter {
  routes: RouteObject[];
  navigate: (to: string) => unknown;
}

/**
 * The console path that a link opens, or null when the browser should follow the link itself.
 *
 * @param href - The link's resolved url, e.g. anchor.href.
 * @param routes - The console's routes.
 * @param origin - The console's origin, window.location.origin.
 * @returns The path, with its query and fragment, of a route other than a catch-all; otherwise null.
 */
export function consolePath(href: string, routes: RouteObject[], origin: string): string | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  const matches = matchRoutes(routes, url.pathname);
  if (!matches) return null;
  // the deepest match is the page. A catch-all ("*") is the console's not found page: the backend serves that path.
  const page = matches[matches.length - 1].route;
  if (page.path === "*") return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The link that a click landed on, or null. */
function clickedLink(event: MouseEvent): HTMLAnchorElement | null {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  return target.closest("a[href]");
}

/** Whether the browser should handle the click: a modifier key, another button, or a link with its own intent. */
function browserHandles(event: MouseEvent, link: HTMLAnchorElement): boolean {
  if (event.defaultPrevented) return true;
  if (event.button !== 0) return true;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return true;
  const target = link.getAttribute("target");
  if (target && target !== "_self") return true;
  if (link.hasAttribute("download")) return true;
  return false;
}

/**
 * The document's click listener, which opens links to the console's routes in place.
 *
 * @param router - The console's router.
 * @returns The listener.
 */
export function inPlaceLinkListener(router: InPlaceRouter): (event: MouseEvent) => void {
  return (event: MouseEvent) => {
    const link = clickedLink(event);
    if (!link) return;
    if (browserHandles(event, link)) return;
    const path = consolePath(link.href, router.routes, window.location.origin);
    if (!path) return;
    event.preventDefault();
    void router.navigate(path);
  };
}

/**
 * Opens plain links to the console's routes in place, while the component that calls it is mounted.
 *
 * @param router - The console's router.
 */
export function useInPlaceLinks(router: InPlaceRouter): void {
  useEffect(() => {
    const listener = inPlaceLinkListener(router);
    document.addEventListener("click", listener);
    return () => document.removeEventListener("click", listener);
  }, [router]);
}
