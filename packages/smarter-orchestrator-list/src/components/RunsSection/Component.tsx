/**
 * RunsSection React Component
 *
 * The Runs section of an orchestrator's Details tab: start a run toward an objective, then follow it. The backend
 * executes a run in the background, one step at a time, so the section lists the user's newest runs, and asks for
 * them again every few seconds while one of them is pending or running. Choosing a run shows its steps, each a
 * call of one LLMClient in its own account, and its result, or why it failed. See the backend's ADR-037.
 *
 * Only the user who started a run may read it, so the list holds the user's runs only.
 *
 * Props:
 * - sessionContext (SessionContext): Authentication and API context.
 * - orchestrator (Orchestrator): The orchestrator.
 *
 * Usage:
 * <RunsSection sessionContext={sessionContext} orchestrator={orchestrator} />
 */
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DetailSection,
  fetchDjangoUrl,
  formatDateTime,
  getDjangoUrl,
  gettext,
  interpolate,
  useSmarterQueryClient,
} from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { loggerPrefix, runsUrl } from "../../lib/const";
import type { Orchestrator, OrchestrationRun, OrchestrationRunStatus } from "../../lib/Types";

/** How often the runs are asked for again while one of them hasn't ended, in milliseconds. */
export const POLL_INTERVAL = 3000;

/** The statuses of a run that hasn't ended. */
const ACTIVE_STATUSES: OrchestrationRunStatus[] = ["pending", "running"];

interface RunsSectionProps {
  sessionContext: SessionContext;
  orchestrator: Orchestrator;
}

/**
 * Load the user's newest runs of the orchestrator.
 *
 * @param sessionContext - The session.
 * @param url - The orchestrator's runs url.
 * @param signal - Aborts the request.
 * @returns The runs, newest first.
 */
async function loadRuns(sessionContext: SessionContext, url: string, signal: AbortSignal): Promise<OrchestrationRun[]> {
  const response = await getDjangoUrl(sessionContext, url, signal);
  if (!response.ok) {
    console.error(loggerPrefix, "Error loading the runs:", response.status);
    throw new Error(interpolate(gettext("The runs could not be loaded (%(status)s)."), { status: response.status }));
  }
  return (await response.json()) as OrchestrationRun[];
}

/**
 * Start a run of the orchestrator.
 *
 * @param sessionContext - The session.
 * @param url - The orchestrator's runs url.
 * @param objective - What the run is to achieve.
 * @returns The run, pending.
 * @throws Error with the backend's reason, e.g. that the user may not use every LLMClient of the orchestrator.
 */
async function startRun(sessionContext: SessionContext, url: string, objective: string): Promise<OrchestrationRun> {
  const response = await fetchDjangoUrl(sessionContext, url, JSON.stringify({ objective }));
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(loggerPrefix, "Error starting a run:", response.status);
    const detail = (body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string" && detail) throw new Error(detail);
    throw new Error(interpolate(gettext("The run could not start (%(status)s)."), { status: response.status }));
  }
  return body as OrchestrationRun;
}

/** A run status's label and badge. */
function statusBadge(status: OrchestrationRunStatus | OrchestrationRun["steps"][number]["status"]) {
  const badges: Record<string, { label: string; className: string }> = {
    pending: { label: gettext("Pending"), className: "badge-light-warning" },
    running: { label: gettext("Running"), className: "badge-light-primary" },
    succeeded: { label: gettext("Succeeded"), className: "badge-light-success" },
    failed: { label: gettext("Failed"), className: "badge-light-danger" },
    cancelled: { label: gettext("Cancelled"), className: "badge-light" },
    skipped: { label: gettext("Skipped"), className: "badge-light" },
    max_iterations_exceeded: { label: gettext("Stopped at its maximum iterations"), className: "badge-light-warning" },
  };
  const badge = badges[status] ?? { label: status, className: "badge-light" };
  return <span className={`badge ${badge.className} fw-semibold`}>{badge.label}</span>;
}

/** A run's steps, its result, and why it failed, if it did. */
function RunDetail({ run }: { run: OrchestrationRun }) {
  const active = ACTIVE_STATUSES.includes(run.status);
  return (
    <div className="mt-4" aria-label={gettext("Run")}>
      <p className="fw-semibold mb-2">{run.objective}</p>
      {run.steps.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm table-row-bordered align-middle mb-3">
            <thead>
              <tr className="fw-semibold text-gray-600">
                <th scope="col">{gettext("Step")}</th>
                <th scope="col">{gettext("LLMClient")}</th>
                <th scope="col">{gettext("Account")}</th>
                <th scope="col">{gettext("Role")}</th>
                <th scope="col">{gettext("Status")}</th>
              </tr>
            </thead>
            <tbody>
              {run.steps.map((step) => (
                <tr key={step.sequence}>
                  <td>{step.sequence}</td>
                  <td>
                    <code>{step.llmclient}</code>
                  </td>
                  <td>{step.accountNumber}</td>
                  <td>{step.role}</td>
                  <td>
                    {statusBadge(step.status)}
                    {step.errorMessage && <div className="text-danger fs-7 mt-1">{step.errorMessage}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {active && (
        <p className="text-muted fs-7">{gettext("This run hasn't ended yet. Its steps appear as they end.")}</p>
      )}
      {run.errorMessage && <div className="alert alert-light-danger fs-7 py-2">{run.errorMessage}</div>}
      {run.result && (
        <div className="border rounded p-4 bg-light" style={{ whiteSpace: "pre-wrap" }}>
          {run.result}
        </div>
      )}
    </div>
  );
}

function RunsSection({ sessionContext, orchestrator }: RunsSectionProps) {
  const queryClient = useSmarterQueryClient();
  const url = runsUrl(orchestrator.hashedId);
  const queryKey = ["smarter-orchestrator-runs", url];
  const query = useQuery(
    {
      queryKey,
      queryFn: ({ signal }) => loadRuns(sessionContext, url, signal),
      // asked for again while a run hasn't ended, so its steps and result appear.
      refetchInterval: (current) => {
        const runs = current.state.data ?? [];
        const active = runs.some((run) => ACTIVE_STATUSES.includes(run.status));
        return active ? POLL_INTERVAL : false;
      },
    },
    queryClient,
  );
  const [objective, setObjective] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const mutation = useMutation(
    {
      mutationFn: (text: string) => startRun(sessionContext, url, text),
      onSuccess: (run) => {
        setObjective("");
        setSelectedId(run.id);
        void queryClient.invalidateQueries({ queryKey });
      },
    },
    queryClient,
  );

  const runs = query.data ?? [];
  const selected = runs.find((run) => run.id === selectedId) ?? runs[0] ?? null;
  const objectiveId = `orchestrator-${orchestrator.id}-objective`;
  const canStart = orchestrator.isActive && objective.trim().length > 0 && !mutation.isPending;

  return (
    <DetailSection title={gettext("Runs")} icon="rocket">
      <form
        className="mb-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (canStart) mutation.mutate(objective.trim());
        }}
      >
        <label htmlFor={objectiveId} className="form-label fw-semibold">
          {gettext("Objective")}
        </label>
        <textarea
          id={objectiveId}
          className="form-control mb-2"
          rows={2}
          value={objective}
          placeholder={gettext("e.g. Prepare the board pack for Q4 2025.")}
          onChange={(event) => setObjective(event.target.value)}
        />
        <button type="submit" className="btn btn-sm btn-primary" disabled={!canStart}>
          {mutation.isPending ? gettext("Starting...") : gettext("Start a run")}
        </button>
        {!orchestrator.isActive && (
          <span className="text-muted fs-7 ms-3">{gettext("An inactive orchestrator can't run.")}</span>
        )}
        {mutation.isError && <div className="text-danger fs-7 mt-2">{mutation.error.message}</div>}
      </form>

      {query.isError && <div className="text-danger fs-7">{query.error.message}</div>}
      {query.isSuccess && runs.length === 0 && <p className="text-muted fs-7">{gettext("You haven't run it yet.")}</p>}
      {runs.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm table-row-bordered table-hover align-middle mb-0">
            <thead>
              <tr className="fw-semibold text-gray-600">
                <th scope="col">{gettext("Started")}</th>
                <th scope="col">{gettext("Objective")}</th>
                <th scope="col">{gettext("Status")}</th>
                <th scope="col">{gettext("Steps")}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className={selected?.id === run.id ? "table-active" : undefined}>
                  <td>{formatDateTime(run.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-start"
                      onClick={() => setSelectedId(run.id)}
                    >
                      {run.objective}
                    </button>
                  </td>
                  <td>{statusBadge(run.status)}</td>
                  <td>{run.iterationCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && <RunDetail run={selected} />}
    </DetailSection>
  );
}

export default RunsSection;
