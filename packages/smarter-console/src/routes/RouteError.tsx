/**
 * The page of a route that failed: React Router's errorElement, in place of its bare default page.
 *
 * On a page inside the console's frame, it shows inside the frame, so that the sidebar and the header still work.
 * A page whose code belongs to an earlier release (see lib/staleRelease) loads the console again, once. A route that
 * answered 404 is the not found page. Anything else says that something went wrong, and offers to reload the page or
 * to return home.
 */
import { gettext } from "@smarter/common";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { loggerPrefix } from "@/lib/const";
import { isStaleChunkError, reloadOnce } from "@/lib/staleRelease";
import { NotFoundPage } from "@/routes/NotFoundPage";

export function RouteError() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;
  // a page of an earlier release: the new release is loading.
  if (isStaleChunkError(error) && reloadOnce()) {
    return (
      <p role="status" className="text-center py-10">
        {gettext("Loading...")}
      </p>
    );
  }

  console.error(`${loggerPrefix} RouteError: a page failed:`, error);
  return (
    <section role="alert" className="text-center py-10">
      <h1 className="fs-2 fw-bold mb-4">{gettext("Something went wrong.")}</h1>
      <div className="d-flex justify-content-center gap-3">
        <button type="button" className="btn btn-sm btn-light" onClick={() => window.location.reload()}>
          {gettext("Reload")}
        </button>
        <Link to="/" className="btn btn-sm btn-primary">
          {gettext("Return Home")}
        </Link>
      </div>
    </section>
  );
}
