/**
 * The manifests that a run discovered, in apply order: each one's position, kind, name, file (a link to it on
 * GitHub) and status. A manifest that failed, was skipped, or printed something opens its details below its row:
 * the message, which can be copied, what applying it printed, and its file on GitHub.
 *
 * The table scrolls inside its own box, with its header in view, so that a run of a few hundred manifests keeps
 * the page usable.
 */
import { Fragment, useId } from "react";

import { CopyButton, gettext, interpolate } from "@smarter/common";

import { hasDetails, type RunManifest } from "../../lib/repositoryApply";
import { manifestStatusLabel } from "./labels";
import { ManifestStatusBadge } from "./StatusBadge";

interface ManifestTableProps {
  manifests: RunManifest[];
  /** The position of the manifest being applied, if any. */
  applyingPosition: number | null;
  /** The positions of the manifests whose details are open. */
  expanded: Set<number>;
  onToggle: (position: number) => void;
  /** Shown when there are no manifests to list. */
  emptyMessage: string;
}

/** What a manifest's message says, and what applying it printed, with copy, and a link to its file. */
function ManifestDetails({ manifest, id }: { manifest: RunManifest; id: string }) {
  const title =
    manifest.status === "failed"
      ? gettext("Why it failed")
      : manifest.status === "skipped"
        ? gettext("Why it was skipped")
        : gettext("Message");
  return (
    <div
      id={id}
      role="region"
      aria-label={interpolate(gettext("Details of %(kind)s %(name)s"), { kind: manifest.kind, name: manifest.name })}
      className="smarter-ra-details p-4"
    >
      {manifest.message ? (
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold">{title}</span>
            <CopyButton
              text={manifest.message}
              className="btn btn-sm btn-light py-1 px-3"
              iconClassName="fs-6 me-1"
              label={interpolate(gettext("Copy the message of %(kind)s %(name)s"), {
                kind: manifest.kind,
                name: manifest.name,
              })}
            />
          </div>
          <pre className={`smarter-ra-message smarter-ra-message-${manifest.status}`}>{manifest.message}</pre>
        </div>
      ) : (
        <p className="text-muted mb-3">{gettext("No message.")}</p>
      )}
      {manifest.output && (
        <details className="mb-3">
          <summary className="fw-semibold">{gettext("Apply output")}</summary>
          <pre className="smarter-ra-message mt-2">{manifest.output}</pre>
        </details>
      )}
      <a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer" className="fw-semibold">
        <i className="ki-outline ki-github fs-5 me-1" aria-hidden="true" />
        {gettext("View the file on GitHub")}
      </a>
    </div>
  );
}

function ManifestTable({ manifests, applyingPosition, expanded, onToggle, emptyMessage }: ManifestTableProps) {
  const idPrefix = useId();

  if (manifests.length === 0) {
    return <p className="text-muted py-6 text-center mb-0">{emptyMessage}</p>;
  }

  return (
    <div className="smarter-ra-table-scroll">
      <table className="table table-row-bordered table-row-gray-200 align-middle gs-3 gy-2 mb-0">
        <caption className="visually-hidden">{gettext("Discovered manifests, in apply order")}</caption>
        <thead>
          <tr className="fw-bold text-muted fs-7 text-uppercase">
            <th scope="col" className="text-end">
              #
            </th>
            <th scope="col">{gettext("Kind")}</th>
            <th scope="col">{gettext("Name")}</th>
            <th scope="col" className="d-none d-md-table-cell">
              {gettext("File")}
            </th>
            <th scope="col">{gettext("Status")}</th>
          </tr>
        </thead>
        <tbody>
          {manifests.map((manifest) => {
            const isOpen = expanded.has(manifest.position);
            const applying = manifest.position === applyingPosition;
            const detailsId = `${idPrefix}-details-${manifest.position}`;
            return (
              <Fragment key={manifest.position}>
                <tr className={isOpen ? "smarter-ra-row-open" : undefined}>
                  <td className="text-end text-muted fs-7">{manifest.position + 1}</td>
                  <td>
                    <span className="badge badge-light-info fw-semibold">{manifest.kind}</span>
                  </td>
                  <td className="fw-semibold text-break">{manifest.name}</td>
                  <td className="d-none d-md-table-cell text-break fs-7">
                    <a href={manifest.sourceUrl} target="_blank" rel="noopener noreferrer">
                      {manifest.path}
                    </a>
                  </td>
                  <td className="text-nowrap">
                    {hasDetails(manifest) ? (
                      <button
                        type="button"
                        className="btn btn-link p-0 smarter-ra-toggle"
                        aria-expanded={isOpen}
                        aria-controls={isOpen ? detailsId : undefined}
                        aria-label={interpolate(gettext("%(status)s: details of %(kind)s %(name)s"), {
                          status: manifestStatusLabel(manifest.status),
                          kind: manifest.kind,
                          name: manifest.name,
                        })}
                        onClick={() => onToggle(manifest.position)}
                      >
                        <ManifestStatusBadge status={manifest.status} />
                        <i
                          className={`ki-outline ${isOpen ? "ki-down" : "ki-right"} fs-7 ms-1 text-muted`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <ManifestStatusBadge status={manifest.status} applying={applying} />
                    )}
                  </td>
                </tr>
                {isOpen && (
                  <tr className="smarter-ra-details-row">
                    <td colSpan={5} className="p-0">
                      <ManifestDetails manifest={manifest} id={detailsId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default ManifestTable;
