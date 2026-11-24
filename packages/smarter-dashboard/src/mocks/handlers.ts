/**
 * MSW request handlers for the Django dashboard api. Stories and tests use them to answer its
 * requests. See storybook/preview.ts and test/server.ts in the workspace.
 */
import { http, HttpResponse } from "msw";

import {
  activity,
  appContext,
  budgetSeries,
  budgets,
  gettingStarted,
  globalSearchErrorResponse,
  globalSearchResponse,
  myResources,
  newestDoodles,
  quickActions,
  serviceHealth,
  tokenUsage,
} from "./fixtures";

export const myResourcesHandler = http.post(appContext.myResourcesApiUrl, () => HttpResponse.json(myResources));
export const serviceHealthHandler = http.post(appContext.serviceHealthApiUrl, () => HttpResponse.json(serviceHealth));
export const quickActionsHandler = http.post(appContext.quickActionsApiUrl, () => HttpResponse.json(quickActions));
export const gettingStartedHandler = http.post(appContext.gettingStartedApiUrl, () =>
  HttpResponse.json(gettingStarted),
);
export const activityHandler = http.post(appContext.activityApiUrl, () => HttpResponse.json(activity));
export const newestDoodlesHandler = http.post(appContext.newestDoodlesApiUrl, () => HttpResponse.json(newestDoodles));
/** Any doodle's artwork, in Storybook: a plain placeholder picture. */
export const doodleArtworkHandler = http.get(
  "/api/v1/doodles/artwork/:file",
  () =>
    new HttpResponse(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><rect width="400" height="300" fill="#f1faff"/><circle cx="200" cy="150" r="80" fill="#1b84ff"/></svg>',
      { headers: { "Content-Type": "image/svg+xml" } },
    ),
);
/** Answers "Bad Key=x" with its error, any query that has no "production" with no results, and others with two lists. */
export const globalSearchHandler = http.post(appContext.globalSearchApiUrl, async ({ request }) => {
  const { query } = (await request.json()) as { query: string };
  if (query.includes("=")) return HttpResponse.json({ ...globalSearchErrorResponse, query });
  if (!query.includes("production")) return HttpResponse.json({ ...globalSearchResponse, query, count: 0, groups: [] });
  return HttpResponse.json(globalSearchResponse);
});
export const chargesHandler = http.post(appContext.chargesApiUrl, () => HttpResponse.json(tokenUsage));
export const budgetsHandlers = [
  http.post(appContext.budgetsApiUrl, () => HttpResponse.json(budgets)),
  http.post(`${appContext.budgetsApiUrl}:locator/series/`, () => HttpResponse.json(budgetSeries)),
];

/** Every dashboard api. */
export const dashboardHandlers = [
  myResourcesHandler,
  serviceHealthHandler,
  quickActionsHandler,
  globalSearchHandler,
  gettingStartedHandler,
  activityHandler,
  newestDoodlesHandler,
  doodleArtworkHandler,
  chargesHandler,
  ...budgetsHandlers,
];

/** Every dashboard api fails. */
export const dashboardErrorHandlers = [
  http.post("/api/web/dashboard/*", () => HttpResponse.json({ error: "Service unavailable" }, { status: 503 })),
];
