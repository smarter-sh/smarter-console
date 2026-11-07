/**
 * The console: its session, then its routes. The routes render only once the session has loaded, so that
 * every page can rely on it. The pages share one cache of api responses, TanStack Query's QueryClient (see
 * lib/queryCache), which starts empty for each user and account.
 */
import { gettext } from "@smarter/common";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, type createBrowserRouter } from "react-router";

import { useInPlaceLinks } from "@/lib/inPlaceLinks";
import { useSessionQueryClient } from "@/lib/queryCache";
import { SessionProvider } from "@/session/SessionProvider";
import { useConsoleSession } from "@/session/context";

type Router = ReturnType<typeof createBrowserRouter>;

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
