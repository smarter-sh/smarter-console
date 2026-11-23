/**
 * One repository apply run: its repository and commit, its stage, its progress, and the manifests that it
 * discovered, which its status counts filter. A run that failed as a whole says why, at the top.
 */
import { useState } from "react";

import { gettext, interpolate, interpolateNodes, ngettext } from "@smarter/common";

import {
  applyingPosition,
  commitUrl,
  isActive,
  MANIFEST_STATUSES,
  progressOf,
  repositoryName,
  RUN_STAGES,
  stageStates,
  type ManifestStatus,
  type Run,
  type RunStage,
} from "../../lib/repositoryApply";
import ManifestTable from "./ManifestTable";
import { manifestStatusLabel, runStatusLabel } from "./labels";
import { RunStatusBadge } from "./StatusBadge";

type Filter = "all" | ManifestStatus;

const STAGE_ICONS: Record<string, string> = {
  done: "ki-check",
  failed: "ki-cross",
};

/** Each stage's name in the stepper. */
function stageLabel(stage: RunStage): string {
  switch (stage) {
    case "queued":
      return gettext("Queued");
    case "cloning":
      return gettext("Clone");
    case "applying":
      return gettext("Apply");
    default:
      return gettext("Finished");
  }
}

/** What the run is doing, in a sentence. */
function statusLine(run: Run): string {
  const { done, total } = progressOf(run.counts);
  switch (run.status) {
    case "queued":
      return gettext("Waiting to start…");
    case "cloning":
      return gettext("Cloning the repository, and finding its manifests…");
    case "applying":
      return interpolate(gettext("Applying manifest %(current)s of %(total)s…"), {
        current: Math.min(done + 1, total),
        total,
      });
    case "finished":
      return interpolate(
        ngettext("Finished: %(total)s manifest attempted.", "Finished: all %(total)s manifests attempted.", total),
        { total },
      );
    default:
      return gettext("The run failed.");
  }
}

/** The empty table's message, for each filter. */
function emptyMessage(run: Run, filter: Filter): string {
  if (run.manifests.length === 0) {
    if (isActive(run)) return gettext("The repository's manifests show here once it has been cloned.");
    return gettext("No manifests were discovered.");
  }
  switch (filter) {
    case "failed":
      return gettext("No manifest failed.");
    case "skipped":
      return gettext("No manifest was skipped.");
    case "applied":
      return gettext("No manifest was applied.");
    case "pending":
      return gettext("No manifest is pending.");
    default:
      return gettext("No manifests were discovered.");
  }
}

function Stepper({ run }: { run: Run }) {
  const states = stageStates(run);
  return (
    <ol className="smarter-ra-stepper list-unstyled d-flex flex-wrap gap-2 mb-0" aria-label={gettext("Stages")}>
      {RUN_STAGES.map((stage, index) => {
        const state = states[stage];
        return (
          <li
            key={stage}
            className={`smarter-ra-stage smarter-ra-stage-${state}`}
            aria-current={state === "active" ? "step" : undefined}
          >
            <span className="smarter-ra-stage-marker" aria-hidden="true">
              {STAGE_ICONS[state] ? <i className={`ki-outline ${STAGE_ICONS[state]} fs-7`} /> : index + 1}
            </span>
            <span>{stageLabel(stage)}</span>
            {state === "failed" && <span className="visually-hidden"> {gettext("(failed)")}</span>}
            {state === "done" && <span className="visually-hidden"> {gettext("(done)")}</span>}
          </li>
        );
      })}
    </ol>
  );
}

function ProgressBar({ run }: { run: Run }) {
  const { done, total } = progressOf(run.counts);
  const width = (count: number) => (total > 0 ? `${(100 * count) / total}%` : "0%");
  return (
    <div className="d-flex align-items-center gap-3">
      <div
        className="progress flex-grow-1 smarter-ra-progress"
        role="progressbar"
        aria-label={gettext("Manifests attempted")}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={interpolate(gettext("%(done)s of %(total)s"), { done, total })}
      >
        <div className="progress-bar bg-success" style={{ width: width(run.counts.applied) }} />
        <div className="progress-bar bg-warning" style={{ width: width(run.counts.skipped) }} />
        <div className="progress-bar bg-danger" style={{ width: width(run.counts.failed) }} />
      </div>
      <span className="text-muted fs-7 text-nowrap">
        {interpolate(gettext("%(done)s of %(total)s"), { done, total })}
      </span>
    </div>
  );
}

const FILTER_CLASSES: Record<Filter, string> = {
  all: "btn-light-primary",
  failed: "btn-light-danger",
  skipped: "btn-light-warning",
  applied: "btn-light-success",
  pending: "btn-light",
};

function RunView({ run }: { run: Run }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const repository = repositoryName(run.url);
  const commit = commitUrl(run);
  const { total } = progressOf(run.counts);
  const manifests = filter === "all" ? run.manifests : run.manifests.filter((m) => m.status === filter);

  const toggle = (position: number) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(position)) next.delete(position);
      else next.add(position);
      return next;
    });
  };

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: gettext("All"), count: total },
    ...MANIFEST_STATUSES.map((status) => ({
      key: status,
      label: manifestStatusLabel(status),
      count: run.counts[status],
    })),
  ];

  return (
    <section className="card card-flush border smarter-ra-run" aria-labelledby={`smarter-ra-run-${run.id}`}>
      <div className="card-header align-items-center flex-wrap gap-3 py-4">
        <div className="d-flex flex-column">
          <h4 id={`smarter-ra-run-${run.id}`} className="mb-1 d-flex align-items-center gap-2 flex-wrap">
            <i className="ki-outline ki-github fs-2" aria-hidden="true" />
            <a href={run.url} target="_blank" rel="noopener noreferrer">
              {repository}
            </a>
            <RunStatusBadge status={run.status} failed={run.counts.failed} />
          </h4>
          <span className="text-muted fs-7">
            {commit
              ? interpolateNodes(gettext("Commit %(commit)s"), {
                  commit: (
                    <a href={commit} target="_blank" rel="noopener noreferrer" className="font-monospace">
                      {run.commit.slice(0, 7)}
                    </a>
                  ),
                })
              : gettext("The commit is known once the repository has been cloned.")}
          </span>
        </div>
        <Stepper run={run} />
      </div>

      <div className="card-body pt-2">
        {run.status === "failed" && (
          <div role="alert" className="alert alert-danger d-flex align-items-start gap-3">
            <i className="ki-outline ki-information-5 fs-2 text-danger" aria-hidden="true" />
            <div>
              <div className="fw-bold">{gettext("This run failed.")}</div>
              <div className="smarter-ra-pre-line">{run.error || gettext("No reason was given.")}</div>
            </div>
          </div>
        )}

        <p className="mb-3" aria-live="polite">
          {statusLine(run)}
          <span className="visually-hidden"> {runStatusLabel(run.status)}</span>
        </p>

        {total > 0 && (
          <>
            <ProgressBar run={run} />
            <div className="d-flex flex-wrap gap-2 my-4" role="group" aria-label={gettext("Show the manifests")}>
              {filters.map(({ key, label, count }) => (
                <button
                  key={key}
                  type="button"
                  className={`btn btn-sm ${FILTER_CLASSES[key]} ${filter === key ? "active fw-bold" : ""} py-1 px-3`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label} <span className="fw-bolder ms-1">{count}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <ManifestTable
          manifests={manifests}
          applyingPosition={applyingPosition(run)}
          expanded={expanded}
          onToggle={toggle}
          emptyMessage={emptyMessage(run, filter)}
        />
      </div>
    </section>
  );
}

export default RunView;
