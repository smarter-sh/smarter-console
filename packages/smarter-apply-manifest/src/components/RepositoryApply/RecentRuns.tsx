/**
 * The user's most recent repository apply runs, newest first: each one's repository, when it started, its status
 * and its counts. Choosing one shows it.
 */
import { gettext, interpolate } from "@smarter/common";

import { repositoryName, type Run } from "../../lib/repositoryApply";
import { RunStatusBadge } from "./StatusBadge";

interface RecentRunsProps {
  runs: Run[];
  /** The id of the run that shows, if any. */
  selectedId: number | null;
  onSelect: (id: number) => void;
}

/** When a run started, in the browser's locale. */
function startedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** A run's counts, in a few words: only those that aren't zero. */
function countsText(run: Run): string {
  const { applied, skipped, failed, pending } = run.counts;
  const parts: string[] = [];
  if (applied) parts.push(interpolate(gettext("%(count)s applied"), { count: applied }));
  if (skipped) parts.push(interpolate(gettext("%(count)s skipped"), { count: skipped }));
  if (failed) parts.push(interpolate(gettext("%(count)s failed"), { count: failed }));
  if (pending) parts.push(interpolate(gettext("%(count)s pending"), { count: pending }));
  return parts.join(", ");
}

function RecentRuns({ runs, selectedId, onSelect }: RecentRunsProps) {
  return (
    <section aria-labelledby="smarter-ra-recent-title">
      <h5 id="smarter-ra-recent-title" className="mb-3">
        {gettext("Recent runs")}
      </h5>
      {runs.length === 0 ? (
        <p className="text-muted fs-7">{gettext("You haven't applied a repository yet.")}</p>
      ) : (
        <ul className="list-unstyled d-flex flex-column gap-2 mb-0">
          {runs.map((run) => {
            const selected = run.id === selectedId;
            return (
              <li key={run.id}>
                <button
                  type="button"
                  className={`btn btn-outline btn-outline-dashed w-100 text-start p-3 smarter-ra-recent ${
                    selected ? "btn-active-light-primary active" : "btn-light"
                  }`}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => onSelect(run.id)}
                >
                  <span className="d-flex justify-content-between align-items-center gap-2">
                    <span className="fw-semibold text-break">{repositoryName(run.url)}</span>
                    <RunStatusBadge status={run.status} failed={run.counts.failed} />
                  </span>
                  <span className="d-block text-muted fs-8 mt-1">{startedAt(run.createdAt)}</span>
                  {countsText(run) && <span className="d-block fs-8 mt-1">{countsText(run)}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default RecentRuns;
