/**
 * MSW request handlers for the cli api and the repository apply api. See storybook/preview.ts and test/server.ts
 * in the workspace.
 */
import { http, HttpResponse } from "msw";

import { schemaHandler, validHandler } from "@smarter/manifest-editor/mocks";

import type { Run, RunList } from "../lib/repositoryApply";
import {
  APPLY_API_URL,
  EXAMPLE_SECRET,
  REPOSITORY_APPLY_API_URL,
  applyResult,
  applyingRun,
  applyingRunFinished,
  cloningRun,
  emptyRepositoryRun,
  failedRun,
  finishedRun,
  noRuns,
  queuedRun,
  recentRuns,
  recentRunsInProgress,
  stackademyRun,
} from "./fixtures";

/** The example-manifest command: a Secret's example, and no other kind's. */
export const exampleHandler = http.post("/api/v1/cli/example-manifest/:kind/", ({ params }) =>
  params.kind === "secret"
    ? HttpResponse.json({ data: EXAMPLE_SECRET })
    : HttpResponse.json({ error: "not found" }, { status: 404 }),
);

export const applyHandlers = [
  validHandler,
  schemaHandler,
  exampleHandler,
  http.post(APPLY_API_URL, () => HttpResponse.json(applyResult)),
];

export const applyErrorHandlers = [
  http.post(APPLY_API_URL, () => HttpResponse.json({ error: "Invalid manifest" }, { status: 400 })),
  ...applyHandlers,
];

// ---------------------------------------------------------------------------------------------------------------
// The repository apply api
// ---------------------------------------------------------------------------------------------------------------

/** GET the api's url: the user's runs. */
export const runListHandler = (list: RunList = recentRuns) =>
  http.get(REPOSITORY_APPLY_API_URL, () => HttpResponse.json(list));

/** GET a run: whichever of runs has its id, else 404. */
export const runDetailHandler = (
  runs: Run[] = [finishedRun, failedRun, emptyRepositoryRun, stackademyRun, applyingRunFinished],
) =>
  http.get(`${REPOSITORY_APPLY_API_URL}:id/`, ({ params }) => {
    const run = runs.find((r) => String(r.id) === params.id);
    return run ? HttpResponse.json(run) : HttpResponse.json({ error: "Not found." }, { status: 404 });
  });

/**
 * GET a run, which progresses: each request answers the next of the stages, and the last stage from then on.
 * Each call makes a new sequence, so that each test or story starts at its first stage.
 */
export const progressingRunHandler = (stages: Run[] = [cloningRun, applyingRun, applyingRunFinished]) => {
  let next = 0;
  return http.get(`${REPOSITORY_APPLY_API_URL}:id/`, () => {
    const run = stages[Math.min(next, stages.length - 1)];
    next += 1;
    return HttpResponse.json(run);
  });
};

/** POST the api's url: a new run (202), or the run already in progress (200). */
export const startRunHandler = (run: Run = queuedRun, status: 200 | 202 = 202) =>
  http.post(REPOSITORY_APPLY_API_URL, () => HttpResponse.json(run, { status }));

/** POST the api's url: refused, with the api's message. */
export const startRunErrorHandler = (error: string) =>
  http.post(REPOSITORY_APPLY_API_URL, () => HttpResponse.json({ error }, { status: 400 }));

/** No runs yet; starting one starts example-manifests, which progresses to finished. */
export const repositoryIdleHandlers = () => [
  runListHandler(noRuns),
  startRunHandler(),
  progressingRunHandler(),
  ...applyHandlers,
];

/** Recent runs, none in progress, each of which can be opened. */
export const repositoryRecentHandlers = () => [runListHandler(recentRuns), runDetailHandler(), ...applyHandlers];

/** The newest run is applying, and stays so: the page follows it. */
export const repositoryInProgressHandlers = () => [
  runListHandler(recentRunsInProgress),
  progressingRunHandler([applyingRun]),
  ...applyHandlers,
];
