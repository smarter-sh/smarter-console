/**
 * The console: its session, then its routes. The routes render only once the session has loaded, so that
 * every page can rely on it. The pages share one cache of api responses, TanStack Query's QueryClient (see
 * lib/queryCache), which starts empty for each user and account. On Vite's dev server, TanStack Query's Devtools
 * show that cache: each query's key, freshness and data.
 */
import { gettext } from "@smarter/common";
import { QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { RouterProvider, type createBrowserRouter } from "react-router";

import { useInPlaceLinks } from "@/lib/inPlaceLinks";
import { useSessionQueryClient } from "@/lib/queryCache";
import { SessionProvider } from "@/session/SessionProvider";
import { useConsoleSession } from "@/session/context";

type Router = ReturnType<typeof createBrowserRouter>;

/**
 * TanStack Query's Devtools, on Vite's dev server only, in a chunk of their own. A production build, where
 * import.meta.env.DEV is false, drops the import, and the package with it; the tests, Vite's test mode, leave them
 * out too.
 */
const QueryDevtools =
  import.meta.env.DEV && import.meta.env.MODE !== "test"
    ? lazy(async () => ({ default: (await import("@tanstack/react-query-devtools")).ReactQueryDevtools }))
    : () => null;

function SessionGate({ router }: { router: Router }) {
  const { session, error, refresh } = useConsoleSession();
  const queryClient = useSessionQueryClient(session);
  // the packages' plain links to the console's pages open in place, as the sidebar's do.
  useInPlaceLinks(router);
  if (error && !session) {
    return (
      <div role="alert" className="text-center py-10">
        <p>{gettext("The console couldn't reach the server.")}</p>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => void refresh()}>
          {gettext("Try again")}
        </button>
      </div>
    );
  }
  if (!session) {
    return (
      <div role="status" className="text-center py-10">
        {gettext("Loading...")}
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Suspense fallback={null}>
        <QueryDevtools buttonPosition="bottom-left" />
      </Suspense>
    </QueryClientProvider>
  );
}

export default function App({ router }: { router: Router }) {
  return (
    <SessionProvider>
      <SessionGate router={router} />
    </SessionProvider>
  );
}
