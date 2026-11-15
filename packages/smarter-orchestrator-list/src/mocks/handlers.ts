/**
 * MSW request handlers for the Django api that this package calls. Stories and tests use them
 * to answer its requests. See storybook/preview.ts and test/server.ts in the workspace.
 */
import { http, HttpResponse } from "msw";

import type { Orchestrator, OrchestrationRun } from "../lib/Types";

import { ACTIONS_URL as BASE, API_URL, makeObject, makeRun, ownedObjects, sharedObjects } from "./fixtures";

/** The list api: the owned and shared objects. */
export function listHandlers(owned: Orchestrator[] = ownedObjects, shared: Orchestrator[] = sharedObjects) {
  return [
    http.post(`${API_URL}owned/`, () => HttpResponse.json({ objects: owned })),
    http.post(`${API_URL}shared/`, () => HttpResponse.json({ objects: shared })),
  ];
}

/** The clone, rename and delete apis, which succeed. */
export const actionHandlers = [
  http.post(`${BASE}clone/:id/:newName/`, ({ params }) =>
    HttpResponse.json(makeObject(99, { name: String(params.newName) })),
  ),
  http.post(`${BASE}rename/:id/:newName/`, ({ params }) =>
    HttpResponse.json(makeObject(1, { name: String(params.newName) })),
  ),
  http.post(`${BASE}delete/:id/`, ({ params }) => HttpResponse.json({ message: `${params.id} deleted.` })),
];

/** The list api fails. */
export const listErrorHandlers = [
  http.post(`${API_URL}:tab/`, () => HttpResponse.json({ error: "Database unavailable" }, { status: 500 })),
];

/** The url of every orchestrator's runs. */
export const RUNS_URL = "/api/v1/orchestrators/:hashedId/runs/";

/**
 * The runs api: the user's runs, and a start that answers 202 with a pending run.
 *
 * @param runs - The runs that the list returns.
 */
export function runsHandlers(runs: OrchestrationRun[] = [makeRun(2), makeRun(1)]) {
  return [
    http.get(RUNS_URL, () => HttpResponse.json(runs)),
    http.post(RUNS_URL, () =>
      HttpResponse.json(makeRun(3, { status: "pending", result: null, iterationCount: 0, steps: [] }), {
        status: 202,
      }),
    ),
  ];
}
