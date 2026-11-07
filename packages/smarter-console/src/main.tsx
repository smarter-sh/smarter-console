/** The console's entry point: mounts the app, with the browser's router, in index.html's root element. */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";

import "@/fonts.css";
import App from "@/App";
import { hideSplashWhenReady } from "@/lib/splash";
import { reloadOnce } from "@/lib/staleRelease";
import { routes } from "@/router";

const rootElement = document.getElementById("smarter-console-root");
if (!rootElement) throw new Error("The console's root element, #smarter-console-root, is missing.");

const router = createBrowserRouter(routes);

// a chunk that Vite preloads, e.g. a page's stylesheet, failed: the tab runs an earlier release of the console. Load
// the new one, once (see lib/staleRelease), rather than throw.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadOnce()) event.preventDefault();
});

// index.html's splash fades out once the console has its session, and its stylesheets have loaded.
void hideSplashWhenReady();

createRoot(rootElement).render(
  <StrictMode>
    <App router={router} />
  </StrictMode>,
);
