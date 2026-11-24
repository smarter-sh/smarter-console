/**
 * The repository apply api, /api/web/account/repository-apply/, with which the Apply page applies every
 * manifest of a public GitHub repository: its types, its requests, and what the page derives from a run.
 *
 * POST the api's url with {url} starts a run (202), or returns the user's run in progress (200); GET it lists the
 * user's most recent runs, with their counts only; GET <url><id>/ returns a run with its manifests, in apply
 * order. See smarter.apps.account.api.web.repository_apply in the smarter repository.
 */
import { fetchDjangoUrl, getDjangoUrl, gettext, interpolate, type SessionContext } from "@smarter/common";

/** Where a run is: queued, then cloning, then applying, and at last finished, or failed as a whole. */
export type RunStatus = "queued" | "cloning" | "applying" | "finished" | "failed";

/** What became of one of a run's manifests. */
export type ManifestStatus = "pending" | "applied" | "skipped" | "failed";

/** One of the manifests that a run discovered, in apply order. */
export interface RunManifest {
  position: number;
  /** The file's path in the repository. */
  path: string;
  kind: string;
  name: string;
  status: ManifestStatus;
  /** Why it failed, or was skipped; often several lines. */
  message: string;
  /** What applying it printed. */
  output: string;
  /** The file on GitHub, at the run's commit. */
  sourceUrl: string;
}

export type RunCounts = Record<ManifestStatus, number>;

/** A batch apply of a GitHub repository. A finished run may hold failed manifests; failed means the run failed. */
export interface Run {
  id: number;
  url: string;
  /** The commit that was cloned, or "" before then. */
  commit: string;
  status: RunStatus;
  /** Why the run failed as a whole. */
  error: string;
  createdAt: string;
  completedAt: string | null;
  counts: RunCounts;
  /** In apply order; empty in the list of runs. */
  manifests: RunManifest[];
}

/** The list of the user's runs: the 10 most recent, newest first. */
export interface RunList {
  runs: Run[];
  runsPerDay: number;
}

/** A started run, and whether it is one that was already in progress (200) rather than a new one (202). */
export interface StartedRun {
  run: Run;
  alreadyInProgress: boolean;
}

/** The statuses that a manifest may have, in the order that the page lists them. */
export const MANIFEST_STATUSES: ManifestStatus[] = ["failed", "skipped", "applied", "pending"];

/** A public GitHub repository's url: https://github.com/<owner>/<repo>, optionally with .git or a final slash. */
const GITHUB_REPOSITORY =
  /^https:\/\/github\.com\/([A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/;

/** The owner and repository of a GitHub repository's url, or null if it isn't one. */
export function parseRepository(url: string): { owner: string; repo: string } | null {
  const match = GITHUB_REPOSITORY.exec(url.trim());
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

/** Whether a url is a GitHub repository's. */
export function isRepositoryUrl(url: string): boolean {
  return parseRepository(url) !== null;
}

/** A repository's url as owner/repo, or the url itself if it isn't a GitHub repository's. */
export function repositoryName(url: string): string {
  const repository = parseRepository(url);
  return repository ? `${repository.owner}/${repository.repo}` : url;
}

/** The url of a run's commit on GitHub, or null before the repository is cloned. */
export function commitUrl(run: Pick<Run, "url" | "commit">): string | null {
  const repository = parseRepository(run.url);
  if (!repository || !run.commit) return null;
  return `https://github.com/${repository.owner}/${repository.repo}/commit/${run.commit}`;
}

/** Whether a run is still going, and its progress should be polled. */
export function isActive(run: Pick<Run, "status">): boolean {
  return run.status === "queued" || run.status === "cloning" || run.status === "applying";
}

/** How many manifests a run discovered, and how many of them it has attempted. */
export function progressOf(counts: RunCounts): { done: number; total: number } {
  const done = counts.applied + counts.skipped + counts.failed;
  return { done, total: done + counts.pending };
}

/** Whether a manifest has details to show. */
export function hasDetails(manifest: RunManifest): boolean {
  return Boolean(manifest.message || manifest.output) || manifest.status === "failed" || manifest.status === "skipped";
}

/** The position of the manifest that is being applied: the first pending one, while the run applies. */
export function applyingPosition(run: Run): number | null {
  if (run.status !== "applying") return null;
  const manifest = run.manifests.find((m) => m.status === "pending");
  return manifest ? manifest.position : null;
}

/** The stages that a run goes through, in order. */
export const RUN_STAGES = ["queued", "cloning", "applying", "finished"] as const;
export type RunStage = (typeof RUN_STAGES)[number];

/** Where a stage is: done, the run's current stage, failed there, or not reached. */
export type StageState = "done" | "active" | "failed" | "pending";

/**
 * The state of each of a run's stages. A run that failed stopped while cloning, if it has no commit, else while
 * applying (which finds the manifests first).
 */
export function stageStates(run: Pick<Run, "status" | "commit">): Record<RunStage, StageState> {
  let current: number;
  let state: StageState;
  if (run.status === "failed") {
    current = run.commit ? RUN_STAGES.indexOf("applying") : RUN_STAGES.indexOf("cloning");
    state = "failed";
  } else if (run.status === "finished") {
    current = RUN_STAGES.length;
    state = "done";
  } else {
    current = RUN_STAGES.indexOf(run.status);
    state = "active";
  }
  const states = {} as Record<RunStage, StageState>;
  RUN_STAGES.forEach((stage, index) => {
    states[stage] = index < current ? "done" : index === current ? state : "pending";
  });
  return states;
}

/** A run as the list of runs has it: its counts, without its manifests. */
export function summaryOf(run: Run): Run {
  return { ...run, manifests: [] };
}

/** The url of a run's detail. */
export function runUrl(apiUrl: string, id: number): string {
  return `${apiUrl}${id}/`;
}

/** An api's JSON response, or its error message, else its status. */
async function jsonResponse<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || interpolate(gettext("Request failed: %(status)s"), { status: response.status }));
  }
  return data;
}

/**
 * Start applying a repository, or get the user's run that is already in progress.
 *
 * @param sessionContext - The cookies and headers of the request.
 * @param apiUrl - The repository apply api's url.
 * @param url - The repository's url.
 * @returns The run, and whether it was already in progress.
 * @throws Error with the api's message, e.g. that the url isn't a public GitHub repository's, else its status.
 */
export async function startRun(sessionContext: SessionContext, apiUrl: string, url: string): Promise<StartedRun> {
  const response = await fetchDjangoUrl(sessionContext, apiUrl, JSON.stringify({ url }));
  const run = await jsonResponse<Run>(response);
  return { run, alreadyInProgress: response.status === 200 };
}

/**
 * GET a run, with its manifests.
 *
 * @param sessionContext - The cookies and headers of the request.
 * @param apiUrl - The repository apply api's url.
 * @param id - The run's id.
 * @returns The run.
 * @throws Error with the api's message, e.g. Not found., else its status.
 */
export async function getRun(sessionContext: SessionContext, apiUrl: string, id: number): Promise<Run> {
  return jsonResponse<Run>(await getDjangoUrl(sessionContext, runUrl(apiUrl, id)));
}

/**
 * GET the user's most recent runs, newest first, with their counts but not their manifests.
 *
 * @param sessionContext - The cookies and headers of the request.
 * @param apiUrl - The repository apply api's url.
 * @returns The runs, and how many the user may start a day.
 * @throws Error with the api's message, else its status.
 */
export async function listRuns(sessionContext: SessionContext, apiUrl: string): Promise<RunList> {
  return jsonResponse<RunList>(await getDjangoUrl(sessionContext, apiUrl));
}
