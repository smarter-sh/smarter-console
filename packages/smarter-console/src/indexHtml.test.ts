/**
 * The console's page, index.html, which Django serves at the console's paths. See
 * smarter.apps.dashboard.views.console_app.
 */
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { fontPreloads, nonBlockingStylesheets } from "../vite.config";

const html = fs.readFileSync(path.resolve(import.meta.dirname, "..", "index.html"), "utf-8");

describe("index.html", () => {
  it("loads the translation catalog before the console's own script", () => {
    // @smarter/common's gettext() reads window.django, which /jsi18n/ defines.
    const catalog = html.indexOf('src="/jsi18n/"');
    const app = html.indexOf('src="/src/main.tsx"');
    expect(catalog).toBeGreaterThan(-1);
    expect(app).toBeGreaterThan(catalog);
  });

  it("sets the theme's mode before the theme's stylesheets", () => {
    // the theme defines its colors and layout variables under [data-bs-theme=light] and [data-bs-theme=dark].
    const mode = html.indexOf('setAttribute("data-bs-theme"');
    const theme = html.indexOf("style.bundle.css");
    expect(mode).toBeGreaterThan(-1);
    expect(theme).toBeGreaterThan(mode);
  });

  it("links the platform's icons from the backend's static files", () => {
    // as the backend's templates/base.html does: Vite's dev server proxies /static/, and the backend rewrites it.
    expect(html).toContain('<link rel="icon" href="/static/images/logo/favicon.ico" />');
    expect(html).toContain('href="/static/images/logo/apple-touch-icon.png"');
    expect(html).toContain('<link rel="manifest" href="/static/site.webmanifest" />');
  });

  it("paints a splash from the page alone, before anything else loads", () => {
    // the splash comes first in the body, and its style is inline: no image, font or script of its own.
    const body = html.slice(html.indexOf("<body>"));
    expect(body.indexOf('id="smarter-splash"')).toBeLessThan(body.indexOf('id="smarter-console-root"'));
    expect(html).toContain("#smarter-splash {");
    // no stylesheet holds back the first paint: each loads as print, then all, and src/lib/splash.ts waits for it.
    const stylesheets = html.match(/<link[^>]*rel="stylesheet"[^>]*>/gs) ?? [];
    expect(stylesheets).toHaveLength(2);
    for (const link of stylesheets) {
      expect(link).toContain('media="print"');
      expect(link).toContain("data-smarter-style");
      expect(link).toContain("this.dataset.loaded = '1'");
    }
    // the tagline, and the light that sweeps across the splash, wait 1.5 seconds, after a fast network's splash has
    // gone; with reduced motion, nothing sweeps.
    expect(html).toContain("animation: smarter-splash-reveal 500ms ease 1500ms forwards;");
    expect(html).toContain("animation: smarter-splash-sweep 2.4s ease-in-out 1500ms infinite;");
    expect(html).toMatch(/prefers-reduced-motion: reduce[\s\S]*#smarter-splash::before \{\s*animation: none;/);
    // the console stays hidden under the splash until the splash starts to fade.
    expect(html).toContain("#smarter-splash:not(.smarter-splash-done) ~ #smarter-console-root {");
    // nor slides into place: the theme's layout transitions wait for the splash too.
    expect(html).toMatch(
      /#smarter-splash:not\(\.smarter-splash-done\) ~ #smarter-console-root \* \{\s*transition: none !important;/,
    );
    // the translations' script is deferred, so it doesn't either.
    expect(html).toContain('<script defer src="/jsi18n/"></script>');
  });

  it("makes the build's own stylesheet load without holding back the splash", () => {
    const plugin = nonBlockingStylesheets();
    const transform = plugin.transformIndexHtml as { handler: (html: string) => string };
    const built = transform.handler('<link rel="stylesheet" crossorigin href="/static/assets/index-abc.css">');
    expect(built).toContain('href="/static/assets/index-abc.css" media="print" data-smarter-style');
    expect(built).toContain("onload=\"this.media = 'all'; this.dataset.loaded = '1'\"");
  });

  it("preloads Inter from the console's own build, not Google Fonts", () => {
    expect(html).not.toContain("fonts.googleapis.com");
    expect(html).not.toContain("fonts.gstatic.com");
    expect(html).toMatch(
      /<link\s+rel="preload"\s+as="font"\s+type="font\/woff2"\s+crossorigin\s+href="@fontsource-variable\/inter\/files\/inter-latin-wght-normal\.woff2"/,
    );
  });

  it("points a font's preload at the font's hashed asset in the build", () => {
    const plugin = fontPreloads();
    const configResolved = plugin.configResolved as (config: { base: string }) => void;
    configResolved({ base: "/static/react/@smarter/console/" });
    const transform = plugin.transformIndexHtml as {
      handler: (html: string, context: { bundle?: Record<string, unknown> }) => string;
    };
    const page = '<link rel="preload" as="font" type="font/woff2" crossorigin href="pkg/files/inter-latin.woff2" />';
    const built = transform.handler(page, { bundle: { "assets/inter-latin-Ab_1.woff2": {}, "assets/x.js": {} } });
    expect(built).toBe(
      '<link rel="preload" as="font" type="font/woff2" crossorigin href="/static/react/@smarter/console/assets/inter-latin-Ab_1.woff2">',
    );
    // without the font in the build, e.g. on the dev server, the preload is removed rather than left to fail.
    expect(transform.handler(page, {})).toBe("");
  });

  it("has the root element that main.tsx mounts the console in", () => {
    expect(html).toContain('id="smarter-console-root"');
  });
});
