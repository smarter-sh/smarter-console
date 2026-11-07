/**
 * ListView
 *
 * Renders a responsive, table-based list of orchestrator resources with key details and actions.
 * Features:
 * - Displays orchestrator information in a styled table with columns for name, dates, orchestrator, model, orchestrators, status, and actions.
 * - Integrates Toolbar for per-orchestrator actions (open, edit, clone, rename, delete).
 * - Formats dates and status using shared utilities.
 * - Shows skeleton (ghost) rows while loading, and supports incremental rendering for large lists.
 *
 * Props:
 * @param isLoading - Whether the orchestrator data is loading (shows skeleton rows if true).
 * @param ghostRows - Number of skeleton rows to display while loading.
 * @param sessionContext - Authentication and API context for actions.
 * @param orchestrators - Array of orchestrator objects to display.
 * @param onRequery - Callback to refresh orchestrator data.
 *
 * Usage:
 * <ListView
 *   sessionContext={sessionContext}
 *   orchestrators={orchestrators}
 *   isLoading={isLoading}
 *   ghostRows={ghostRows}
 *   onRequery={onRequery}
 * />
 *
 * Intended for views where orchestrators are presented in a list/table format.
 */
import React, { useState, useEffect } from "react";

import { formatDateTime, gettext, SkeletonRows, SortableHeader } from "@smarter/common";
import type { SessionContext, SkeletonColumn, Sorting } from "@smarter/common";

import type { Orchestrator, OrchestratorListViewProps } from "../../lib/Types";
import { Toolbar } from "../Toolbar";
import { StatusBar } from "../StatusBar";
import { loggerPrefix } from "../../lib/const";

import "./styles.css";

/**
 * TableHeader
 *
 * Renders the table header row for the orchestrator list, including column titles for all displayed fields.
 * Its sortable columns sort the list, with the list api (see SortableHeader).
 */
const TableHeader = ({ sorting }: { sorting?: Sorting }) => {
  return (
    <thead className="table-light border-bottom-2">
      <tr className="">
        <SortableHeader column="name" sorting={sorting} className=" p-1">
          {gettext("Name")}
        </SortableHeader>
        <SortableHeader column="createdAt" sorting={sorting} className="d-none d-lg-table-cell width-100">
          {gettext("Created")}
        </SortableHeader>
        <SortableHeader column="updatedAt" sorting={sorting} className="d-none d-lg-table-cell width-100">
          {gettext("Updated")}
        </SortableHeader>
        <SortableHeader column="description" sorting={sorting} className="">
          {gettext("Description")}
        </SortableHeader>
        <SortableHeader column="isActive" sorting={sorting} className="">
          {gettext("Active")}
        </SortableHeader>
        <SortableHeader column="strategy" sorting={sorting} className="d-none d-lg-table-cell">
          {gettext("Strategy")}
        </SortableHeader>
        <th className="d-none d-md-table-cell">{gettext("Status")}</th>
        <th className="">{gettext("Operations")}</th>
      </tr>
    </thead>
  );
};

/**
 * CreatedDate and UpdatedDate
 *
 * Format a row's creation date, and its last update relative to its creation.
 */
const CreatedDate = ({ date }: { date: string }) => {
  return <span>{formatDateTime(date, "date")}</span>;
};

const UpdatedDate = ({ date, createdAt }: { date: string | null; createdAt: string }) => {
  return <span>{formatDateTime(date, "relative", createdAt)}</span>;
};

/**
 * OrchestratorRow
 *
 * Renders a single orchestrator as a table row, displaying its details and action toolbar.
 *
 * @param orchestrator - The orchestrator object to display.
 * @param sessionContext - Session context for actions.
 * @param onRequery - Callback to refresh orchestrator data after an action.
 */
const OrchestratorRow = React.memo(function OrchestratorRow({
  orchestrator,
  sessionContext,
  onRequery,
}: {
  orchestrator: Orchestrator;
  sessionContext: SessionContext;
  onRequery: () => void;
}) {
  return (
    <tr className="" key={orchestrator.id}>
      {/* Name */}
      <td className="p-1 m-0">
        {/* the row opens the orchestrator's detail: see TabbedListView. */}
        <span className="fw-semibold text-gray-900">{orchestrator.name}</span>
      </td>
      {/* Created Date */}
      <td className="d-none d-lg-table-cell width-100">
        <CreatedDate date={orchestrator.createdAt} />
      </td>
      {/* Updated Date */}
      <td className="d-none d-lg-table-cell width-100">
        <UpdatedDate date={orchestrator.updatedAt} createdAt={orchestrator.createdAt} />
      </td>
      {/* Description */}
      <td className="">{orchestrator.description}</td>
      <td className="">{orchestrator.isActive}</td>
      <td className="">{orchestrator.strategy}</td>
      {/* Status */}
      <td className="d-none d-md-table-cell ">
        <StatusBar orchestrator={orchestrator} />
      </td>
      {/* Actions */}
      <td className="text-end ">
        <Toolbar sessionContext={sessionContext} orchestrator={orchestrator} onRequery={onRequery} />
      </td>
    </tr>
  );
});

/**
 * The columns of the table's skeleton rows, while the list loads: the class names of each column's cells, so
 * that a column hidden at a width is hidden in the skeleton too. See SkeletonRows in @smarter/common.
 */
const SKELETON_COLUMNS: SkeletonColumn[] = [
  "p-1 m-0", // Name
  "d-none d-lg-table-cell width-100", // Created Date
  "d-none d-lg-table-cell width-100", // Updated Date
  { className: "", shape: "paragraph" }, // Description
  "",
  "",
  "d-none d-md-table-cell", // Status
  "text-end", // Actions
];

/**
 * ChunkedRows
 *
 * Incrementally renders orchestrator rows in chunks to avoid UI blocking.
 * Uses requestIdleCallback (if available) or setTimeout as a fallback to schedule rendering.
 *
 * @param orchestrators - Array of orchestrator objects to render.
 * @param sessionContext - Session context for actions.
 * @param onRequery - Callback to refresh orchestrator data.
 * @param chunkSize - Number of rows to render per chunk (default: 5).
 */
function ChunkedRows({
  orchestrators,
  sessionContext,
  onRequery,
  chunkSize = 5,
}: {
  orchestrators: Orchestrator[];
  sessionContext: SessionContext;
  onRequery: () => void;
  chunkSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(chunkSize);

  useEffect(() => {
    if (visibleCount >= orchestrators.length) return;
    const next = () => setVisibleCount((c) => Math.min(c + chunkSize, orchestrators.length));
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(next);
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = setTimeout(next, 0);
    return () => clearTimeout(timeoutId);
  }, [visibleCount, orchestrators.length, chunkSize]);
  return (
    <>
      {orchestrators.slice(0, visibleCount).map((orchestrator) => (
        <OrchestratorRow
          key={orchestrator.id}
          orchestrator={orchestrator}
          sessionContext={sessionContext}
          onRequery={onRequery}
        />
      ))}
    </>
  );
}

/**
 * ListView
 *
 * Main component for displaying a responsive, table-based list of orchestrator resources.
 * Handles loading state with skeleton rows and incremental rendering for large lists.
 *
 * @param isLoading - Whether the orchestrator data is loading (shows skeleton rows if true).
 * @param ghostRows - Number of skeleton rows to display while loading.
 * @param sessionContext - Authentication and API context for actions.
 * @param orchestrators - Array of orchestrator objects to display.
 * @param onRequery - Callback to refresh orchestrator data.
 * @param sorting - The sort of the list, which its sortable column headers change.
 */
export function ListView({
  isLoading,
  ghostRows,
  sessionContext,
  objects,
  onRequery,
  sorting,
}: OrchestratorListViewProps) {
  console.debug(
    `${loggerPrefix} ListView() Rendering ListView - {isLoading: ${isLoading}, ghostRows: ${ghostRows}, objects length: ${Array.isArray(objects) ? objects.length : "N/A"}}`,
  );
  console.debug(`${loggerPrefix} SessionContext:`, sessionContext);
  console.debug(`${loggerPrefix} Objects:`, objects);
  return (
    <div className="table-responsive orchestrator-list-table-wrap ps-3 pe-3">
      <table className="table table-striped table-hover align-middle border">
        <TableHeader sorting={sorting} />
        <tbody>
          {isLoading ? (
            <SkeletonRows count={ghostRows} columns={SKELETON_COLUMNS} />
          ) : (
            <ChunkedRows orchestrators={objects} sessionContext={sessionContext} onRequery={onRequery} />
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ListView;
