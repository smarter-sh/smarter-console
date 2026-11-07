/**
 * Vite configuration of @smarter/console, the single-page web console (ADR-035).
 *
 * - `npm run dev` serves the console at http://localhost:5173/. Every path that belongs to the backend is
 *   proxied to the Django dev server at http://localhost:9357, so the browser sees one origin, and Django's
 *   session and CSRF cookies work as they do in production.
 * - `npm run build` writes index.html and its assets into dist/react/@smarter/console/. A release's tarball of
 *   dist/ unpacks into the backend's static folder, from which Django serves the console's pages at
 *   /static/react/@smarter/console/ (or the CDN, with SMARTER_STATIC_FILES_ON_CDN).
 * - @smarter/common and the other packages of workspaceSources.ts are read from their source, not their dist/
 *   builds, so that a rebuild of one (e.g. make lint's build:deps, which empties dist/ first) never breaks the dev
 *   server, and a change to one shows at once.
 * - console.debug() calls are removed from production builds.
 * - The built scripts and styles load their chunks, fonts and images relative to themselves, so that they follow
 *   them to the CDN while the backend serves the page with its CDN's STATIC_URL (SMARTER_STATIC_FILES_ON_CDN).
 */
import { defineConfig, type ConfigEnv, type Plugin, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import packageJson from "./package.json" with { type: "json" };

import { WORKSPACE_SOURCES } from "../../workspaceSources.ts";

const packageName = packageJson.name;

/** The Django dev server, which serves the backend while the console runs on Vite's dev server. */
const DJANGO = "http://localhost:9357";

/**
 * The paths that belong to the backend: its apis, Django admin, social sign-in, the translation
 * catalogs, static files, and the Terminal's WebSocket. Everything else is the console's.
 */
const BACKEND_PATHS = ["/api", "/admin", "/social-auth", "/i18n", "/jsi18n", "/static"];

function backendProxy(): Record<string, ProxyOptions> {
  const proxy: Record<string, ProxyOptions> = {};
  for (const backendPath of BACKEND_PATHS) {
    proxy[backendPath] = { target: DJANGO };
  }
  proxy["/ws"] = { target: DJANGO, ws: true };
  return proxy;
}

/** A stylesheet link that Vite writes into the built index.html. */
const VITE_STYLESHEET = /<link rel="stylesheet" crossorigin href="([^"]+)">/g;

/**
 * The console's own stylesheet, which Vite links in the built index.html, loads without holding back the splash's
 * first paint, as the theme's stylesheets do (see index.html, and src/lib/splash.ts, which waits for it). On the dev
 * server, Vite injects the styles from the console's script instead.
 */
export function nonBlockingStylesheets(): Plugin {
  return {
    name: "smarter-non-blocking-stylesheets",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: (html: string) =>
        html.replace(
          VITE_STYLESHEET,
          (_link, href: string) =>
            `<link rel="stylesheet" crossorigin href="${href}" media="print" data-smarter-style ` +
            `onload="this.media = 'all'; this.dataset.loaded = '1'" onerror="this.dataset.loaded = '1'">`,
        ),
    },
  };
}

/** A font's preload in index.html, whose href names the font's file in its npm package. */
const FONT_PRELOAD = /<link\s+rel="preload"\s+as="font"([^>]*?)\s+href="([^"]+\/([^"/]+)\.woff2)"\s*\/?>/g;

/**
 * Vite resolves a font's url() in index.html's inline @font-face to its hashed build asset, but not a preload's
 * href. This plugin points each font preload at that asset, found by name in the build's output, so that the browser
 * fetches the font once, early. A preload whose font isn't in the build is removed, rather than left to fail. On
 * the dev server the preloads are removed too: preloading matters only on a slow network.
 */
export function fontPreloads(): Plugin {
  let base = "/";
  return {
    name: "smarter-font-preloads",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler: (html, context) => {
        const fileNames = Object.keys(context.bundle ?? {});
        return html.replace(FONT_PRELOAD, (_link, attributes: string, _href: string, name: string) => {
          const asset = new RegExp(`(^|/)${name}-[\\w-]+\\.woff2$`);
          const fileName = fileNames.find((candidate) => asset.test(candidate));
          if (!fileName) return "";
          return `<link rel="preload" as="font"${attributes} href="${base}${fileName}">`;
        });
      },
    },
  };
}

export default defineConfig(({ command }: ConfigEnv) => ({
  plugins: [react(), nonBlockingStylesheets(), fontPreloads()],
  base: command === "serve" ? "/" : `/static/react/${packageName}/`,
  resolve: {
    alias: {
      ...WORKSPACE_SOURCES,
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  experimental: {
    renderBuiltUrl(_filename: string, { hostType }: { hostType: "js" | "css" | "html" }) {
      if (hostType === "js" || hostType === "css") return { relative: true };
      return undefined;
    },
  },
  build: {
    manifest: "manifest.json",
    outDir: `../../dist/react/${packageName}`,
    emptyOutDir: true,
    rolldownOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        // The Oxc minifier's way of removing console.debug() calls, which can log sensitive data.
        minify: {
          compress: {
            treeshake: {
              manualPureFunctions: ["console.debug"],
            },
          },
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: backendProxy(),
  },
}));
