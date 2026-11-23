/**
 * The status badges of a repository apply run and of its manifests: each one an icon and its status's name, so
 * that the status is never told by color alone.
 */
import { gettext } from "@smarter/common";

import type { ManifestStatus, RunStatus } from "../../lib/repositoryApply";
import { manifestStatusLabel, runStatusLabel } from "./labels";

const MANIFEST_BADGES: Record<ManifestStatus, { className: string; icon: string }> = {
  pending: { className: "badge-light text-muted", icon: "ki-time" },
  applied: { className: "badge-light-success", icon: "ki-check-circle" },
  skipped: { className: "badge-light-warning", icon: "ki-minus-circle" },
  failed: { className: "badge-light-danger", icon: "ki-cross-circle" },
};

const RUN_BADGES: Record<RunStatus, { className: string; icon: string | null }> = {
  queued: { className: "badge-light text-muted", icon: "ki-time" },
  cloning: { className: "badge-light-primary", icon: null },
  applying: { className: "badge-light-primary", icon: null },
  finished: { className: "badge-light-success", icon: "ki-check-circle" },
  failed: { className: "badge-light-danger", icon: "ki-cross-circle" },
};

/** A spinner, beside the text that says what is in progress. */
function Spinner() {
  return <span className="spinner-border spinner-border-sm me-1 smarter-ra-spinner" aria-hidden="true" />;
}

/** A manifest's status; a pending manifest that is being applied says so, with a spinner. */
export function ManifestStatusBadge({ status, applying = false }: { status: ManifestStatus; applying?: boolean }) {
  if (applying) {
    return (
      <span className="badge badge-light-primary smarter-ra-badge">
        <Spinner />
        {gettext("Applying")}
      </span>
    );
  }
  const { className, icon } = MANIFEST_BADGES[status];
  return (
    <span className={`badge ${className} smarter-ra-badge`}>
      <i className={`ki-outline ${icon} fs-6 me-1`} aria-hidden="true" />
      {manifestStatusLabel(status)}
    </span>
  );
}

/** A run's status; a finished run with failed manifests is a warning. */
export function RunStatusBadge({ status, failed = 0 }: { status: RunStatus; failed?: number }) {
  const { icon } = RUN_BADGES[status];
  const className = status === "finished" && failed > 0 ? "badge-light-warning" : RUN_BADGES[status].className;
  return (
    <span className={`badge ${className} smarter-ra-badge`}>
      {icon ? <i className={`ki-outline ${icon} fs-6 me-1`} aria-hidden="true" /> : <Spinner />}
      {runStatusLabel(status)}
    </span>
  );
}
