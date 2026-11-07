/**
 * A page whose code belongs to an earlier release of the console.
 *
 * Each page's code is a chunk of its own, with a hashed name, which the console loads when the page first opens. A
 * browser tab opened before a new release still runs the earlier release, and asks for that release's chunks; when
 * the backend no longer serves them, the page can't load. Loading the console again, once, gets the new release. A
 * reload that just happened isn't repeated, so a chunk that is missing for another reason shows the error page
 * instead of reloading forever.
 */
import { loggerPrefix } from "@/lib/const";

/** The sessionStorage key of the time of the last reload for a new release. */
export const RELOAD_KEY = "smarter-console-release-reload";

/** How long after a reload for a new release another one is refused, in milliseconds. */
export const RELOAD_GUARD_MS = 10 * 1000;

/**
 * The messages of a dynamic import or a stylesheet preload that failed, in Chromium, Firefox, Safari and Vite.
 */
const STALE_CHUNK_MESSAGES = [
  "Failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "Importing a module script failed",
  "Unable to preload CSS",
];

/**
 * Whether an error is a page's code, or its stylesheet, failing to load.
 *
 * @param error - What the route, or Vite's preload, threw.
 * @returns True for a failed chunk.
 */
export function isStaleChunkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return STALE_CHUNK_MESSAGES.some((message) => error.message.includes(message));
}

/**
 * Loads the console again, unless it did so for a new release a moment ago.
 *
 * @param reload - Loads the page again. window.location.reload, but for tests.
 * @returns Whether it reloaded.
 */
export function reloadOnce(reload: () => void = () => window.location.reload()): boolean {
  const now = Date.now();
  let last: number;
  try {
    last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    // storage may be blocked: then the guard can't hold, so don't reload.
    return false;
  }
  if (now - last < RELOAD_GUARD_MS) return false;
  try {
    window.sessionStorage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  console.warn(`${loggerPrefix} a page of an earlier release couldn't load: loading the console's new release.`);
  reload();
  return true;
}
