/** The splash fades out once the console is ready, and its stylesheets have loaded. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  hideSplashWhenReady,
  resetSplashForTests,
  SPLASH_DONE_CLASS,
  SPLASH_FADE_MS,
  SPLASH_ID,
  SPLASH_MIN_MS,
  FONTS_WAIT_MS,
  fontsLoaded,
  TEXT_FONTS,
  splashAppReady,
  stylesheetsLoaded,
} from "@/lib/splash";

/** A stylesheet that the splash waits for, loaded or not. */
function stylesheet(loaded = false): HTMLLinkElement {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.setAttribute("data-smarter-style", "");
  if (loaded) link.dataset.loaded = "1";
  document.head.appendChild(link);
  return link;
}

/** index.html's splash. */
function splash(): HTMLElement {
  const element = document.createElement("div");
  element.id = SPLASH_ID;
  document.body.appendChild(element);
  return element;
}

/** Whether a promise has settled, after the pending callbacks have run. */
async function settled(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

beforeEach(() => {
  resetSplashForTests();
  // the page was requested long enough ago: the splash's minimum time has passed.
  vi.spyOn(performance, "now").mockReturnValue(SPLASH_MIN_MS + 1);
});

afterEach(() => {
  document.head.querySelectorAll("link[data-smarter-style]").forEach((link) => link.remove());
  document.getElementById(SPLASH_ID)?.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("stylesheetsLoaded()", () => {
  it("resolves at once when every stylesheet has loaded", async () => {
    stylesheet(true);
    expect(await settled(stylesheetsLoaded())).toBe(true);
  });

  it("waits for a stylesheet to load, or to fail", async () => {
    const first = stylesheet();
    const second = stylesheet();
    const waiting = stylesheetsLoaded();
    expect(await settled(waiting)).toBe(false);
    first.dispatchEvent(new Event("load"));
    expect(await settled(waiting)).toBe(false);
    second.dispatchEvent(new Event("error"));
    expect(await settled(waiting)).toBe(true);
  });
});

describe("hideSplashWhenReady()", () => {
  it("fades the splash out once the console is ready and its stylesheets have loaded, then removes it", async () => {
    const element = splash();
    const link = stylesheet();
    const hiding = hideSplashWhenReady();

    splashAppReady();
    expect(await settled(hiding)).toBe(false);
    expect(element).not.toHaveClass(SPLASH_DONE_CLASS);

    // the removal's timer only: performance.now() stays this test's.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    link.dispatchEvent(new Event("load"));
    await vi.waitFor(() => expect(element).toHaveClass(SPLASH_DONE_CLASS));
    expect(document.getElementById(SPLASH_ID)).toBe(element);
    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(document.getElementById(SPLASH_ID)).toBeNull();
  });

  it("waits for the console, when the stylesheets have loaded first", async () => {
    const element = splash();
    stylesheet(true);
    const hiding = hideSplashWhenReady();
    expect(await settled(hiding)).toBe(false);
    splashAppReady();
    await hiding;
    expect(element).toHaveClass(SPLASH_DONE_CLASS);
  });

  it("stays at least SPLASH_MIN_MS from the page's request, so that it can be seen on a fast network", async () => {
    const element = splash();
    stylesheet(true);
    splashAppReady();
    vi.useFakeTimers();
    // ready 200 ms after the request.
    vi.spyOn(performance, "now").mockReturnValue(200);
    const hiding = hideSplashWhenReady();
    await vi.advanceTimersByTimeAsync(SPLASH_MIN_MS - 200 - 1);
    expect(element).not.toHaveClass(SPLASH_DONE_CLASS);
    await vi.advanceTimersByTimeAsync(1);
    await hiding;
    expect(element).toHaveClass(SPLASH_DONE_CLASS);
  });

  it("waits for the console's text font, at most FONTS_WAIT_MS", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    // a page whose fonts never arrive. jsdom has no document.fonts.
    const page = { fonts: { load: () => new Promise<FontFace[]>(() => {}) } } as unknown as Document;
    let done = false;
    void fontsLoaded(page).then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(FONTS_WAIT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("goes on at once when the fonts have loaded", async () => {
    const load = vi.fn((_font: string) => Promise.resolve([] as FontFace[]));
    const page = { fonts: { load } } as unknown as Document;
    await expect(fontsLoaded(page)).resolves.toBeUndefined();
    // the text font's faces only: the icon fonts, which don't move text, aren't waited for.
    expect(load.mock.calls.map(([font]) => font)).toEqual(TEXT_FONTS);
    // and without the CSS Font Loading API, e.g. in jsdom.
    await expect(fontsLoaded()).resolves.toBeUndefined();
  });

  it("does nothing without a splash, e.g. in a page of its own", async () => {
    splashAppReady();
    await expect(hideSplashWhenReady()).resolves.toBeUndefined();
  });
});
