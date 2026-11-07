/**
 * The splash: the console's first paint, while it loads.
 *
 * index.html holds it, as a few lines of inline HTML and CSS, with no image, font or script of its own, so that a
 * browser paints it from the page's HTML alone, even on a slow network. The stylesheets that would otherwise hold
 * back that first paint, the theme's, the font's and the console's own, load without blocking it: each marks
 * itself data-smarter-style, and data-loaded once it has loaded, or failed to.
 *
 * The splash fades out once the console is ready: those stylesheets have loaded, so that the console never shows
 * unstyled, and the console has its session, or knows that it can't get it (see App's SessionGate), and then its
 * fonts, so that the text doesn't re-flow, and move the page, once it shows. On a fast
 * network that takes a moment, so the splash stays at least SPLASH_MIN_MS from the page's request, long enough to
 * be seen and read; on a slow one, it has been up longer than that, and fades out at once. A sign-in page shows
 * without it: index.html marks its splash silent (SPLASH_SILENT_CLASS), which hides it and skips the minimum.
 */

/** The splash's element in index.html. */
export const SPLASH_ID = "smarter-splash";

/** The class that fades the splash out. index.html's inline style defines it. */
export const SPLASH_DONE_CLASS = "smarter-splash-done";

/**
 * The class of a splash that isn't shown: index.html's inline script adds it on a sign-in page, which shows as
 * soon as it's ready, without the splash.
 */
export const SPLASH_SILENT_CLASS = "smarter-splash-silent";

/** How long the splash stays, at least, in milliseconds from the page's request: performance.now(). */
export const SPLASH_MIN_MS = 1200;

/**
 * How long the splash waits, at most, for the console's text font, in milliseconds, once the console is ready: a
 * font that arrives after the splash goes re-flows the page's text, and moves what is below it.
 */
export const FONTS_WAIT_MS = 1500;

/**
 * The text font's faces that the console uses: the theme's Inter (--bs-font-sans-serif), in the theme's weights.
 * They are one variable font (src/fonts.css), which index.html preloads. Its icon fonts, Keen's, much larger, don't
 * move text, so the splash doesn't wait for them.
 */
export const TEXT_FONTS = ["300 1em Inter", "400 1em Inter", "500 1em Inter", "600 1em Inter", "700 1em Inter"];

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
 * Resolves once the text font's faces have loaded, or failed to, or after FONTS_WAIT_MS: a slow font doesn't hold
 * the console back. Without the CSS Font Loading API, at once.
 *
 * @param doc - The page.
 */
export function fontsLoaded(doc: Document = document): Promise<void> {
  if (!doc.fonts?.load) return Promise.resolve();
  const loads = Promise.all(TEXT_FONTS.map((font) => doc.fonts.load(font).catch(() => []))).then(() => undefined);
  const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, FONTS_WAIT_MS));
  return Promise.race([loads, timeout]);
}

/**
 * Resolves once the browser has rendered the next frame: a style change made before it, e.g. a stylesheet that has
 * just been switched on, has been applied by then. Without requestAnimationFrame, at once.
 */
export function afterNextFrame(): Promise<void> {
  if (typeof window.requestAnimationFrame !== "function") return Promise.resolve();
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  });
}

/**
 * Fades the splash out, and removes it, once the console is ready, its stylesheets have loaded, and then the fonts
 * that it renders with, up to FONTS_WAIT_MS.
 *
 * @param doc - The page.
 * @returns Resolves once the splash has started to fade.
 */
export async function hideSplashWhenReady(doc: Document = document): Promise<void> {
  await Promise.all([stylesheetsLoaded(doc), ready]);
  // the console has rendered, so the fonts that it uses have been asked for.
  await fontsLoaded(doc);
  const splash = doc.getElementById(SPLASH_ID);
  // a silent splash, a sign-in page's, isn't seen, so it has no minimum time.
  const silent = splash?.classList.contains(SPLASH_SILENT_CLASS) ?? false;
  const remaining = SPLASH_MIN_MS - performance.now();
  if (!silent && remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
  // a frame with the stylesheets applied, before the console shows: its layout settles while index.html still holds
  // back its transitions, e.g. the sidebar's margin, which would otherwise slide into place in view.
  await afterNextFrame();
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
