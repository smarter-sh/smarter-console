/**
 * The splash: the console's first paint, while it loads.
 *
 * index.html holds it, as a few lines of inline HTML and CSS, with no image, font or script of its own, so that a
 * browser paints it from the page's HTML alone, even on a slow network. The stylesheets that would otherwise hold
 * back that first paint, the theme's, the font's and the console's own, load without blocking it: each marks
 * itself data-smarter-style, and data-loaded once it has loaded, or failed to.
 *
 * The splash fades out once the console is ready: those stylesheets have loaded, so that the console never shows
 * unstyled, and the console has its session, or knows that it can't get it (see App's SessionGate). On a fast
 * network that takes a moment, so the splash stays at least SPLASH_MIN_MS from the page's request, long enough to
 * be seen and read; on a slow one, it has been up longer than that, and fades out at once.
 */

/** The splash's element in index.html. */
export const SPLASH_ID = "smarter-splash";

/** The class that fades the splash out. index.html's inline style defines it. */
export const SPLASH_DONE_CLASS = "smarter-splash-done";

/** How long the splash stays, at least, in milliseconds from the page's request: performance.now(). */
export const SPLASH_MIN_MS = 1200;

/** How long the fade lasts, in milliseconds, after which the splash is removed. */
export const SPLASH_FADE_MS = 300;

/** The stylesheets that the splash waits for. */
const STYLESHEETS = "link[data-smarter-style]";

let markReady: () => void = () => {};
let ready = new Promise<void>((resolve) => {
  markReady = resolve;
});

/** Says that the console is ready to show: it has its session, or knows that it can't get it. */
export function splashAppReady(): void {
  markReady();
}

/** Whether a stylesheet has loaded, or failed to. */
function loaded(link: HTMLLinkElement): boolean {
  return link.dataset.loaded !== undefined;
}

/**
 * Resolves once every stylesheet that the splash waits for has loaded, or failed to.
 *
 * @param doc - The page.
 */
export function stylesheetsLoaded(doc: Document = document): Promise<void> {
  const links = Array.from(doc.querySelectorAll<HTMLLinkElement>(STYLESHEETS));
  const pending = links.filter((link) => !loaded(link));
  return Promise.all(
    pending.map(
      (link) =>
        new Promise<void>((resolve) => {
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/**
 * Fades the splash out, and removes it, once the console is ready and its stylesheets have loaded.
 *
 * @param doc - The page.
 * @returns Resolves once the splash has started to fade.
 */
export async function hideSplashWhenReady(doc: Document = document): Promise<void> {
  await Promise.all([stylesheetsLoaded(doc), ready]);
  const remaining = SPLASH_MIN_MS - performance.now();
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
  const splash = doc.getElementById(SPLASH_ID);
  if (!splash) return;
  splash.classList.add(SPLASH_DONE_CLASS);
  window.setTimeout(() => splash.remove(), SPLASH_FADE_MS);
}

/** For tests: the console isn't ready again. */
export function resetSplashForTests(): void {
  ready = new Promise<void>((resolve) => {
    markReady = resolve;
  });
}
