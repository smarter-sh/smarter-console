/**
 * ListView
 *
 * Renders a responsive, table-based list of custom domains with key details and links.
 * Features:
 * - Displays custom domain information in a styled table with columns for the domain, dates,
 *   the llmclient that it serves, its AWS hosted zone, status, and actions.
 * - Integrates Toolbar for per-domain actions (open, edit, visit, clone, rename, delete).
 * - Formats dates and status using shared utilities.
 * - Shows skeleton (ghost) rows while loading, and supports incremental rendering for large lists.
 *
 * Props:
 * @param isLoading - Whether the custom domain data is loading (shows skeleton rows if true).
 * @param ghostRows - Number of skeleton rows to display while loading.
 * @param sessionContext - Authentication and API context for actions.
 * @param objects - Array of custom domain objects to display.
 * @param onRequery - Callback to refresh custom domain data.
 *
 * Usage:
 * <ListView
 *   sessionContext={sessionContext}
 *   objects={customDomains}
 *   isLoading={isLoading}
 *   ghostRows={ghostRows}
 *   onRequery={onRequery}
 * />
 */
import React, { useState, useEffect } from "react";

import { formatDateTime, gettext, SkeletonRows, SortableHeader } from "@smarter/common";
import type { SessionContext, SkeletonColumn, Sorting } from "@smarter/common";

import type { CustomDomain, CustomDomainListViewProps } from "../../lib/Types";
import { Toolbar } from "../Toolbar";
import { StatusBar, VerificationBadge } from "../StatusBar";
import { loggerPrefix } from "../../lib/const";

import "./styles.css";

/**
 * TableHeader
 *
 * Renders the table header row for the custom domain list, including column titles for all displayed fields.
 * Its sortable columns sort the list, with the list api (see SortableHeader).
 */
const TableHeader = ({ sorting }: { sorting?: Sorting }) => {
  return (
    <thead className="table-light border-bottom-2">
      <tr className="">
        <SortableHeader column="name" sorting={sorting} className=" p-1">
          {gettext("Name")}
        </SortableHeader>
        <SortableHeader column="domainName" sorting={sorting} className="">
          {gettext("Domain")}
        </SortableHeader>
        <SortableHeader column="createdAt" sorting={sorting} className="d-none d-lg-table-cell width-100">
          {gettext("Created")}
        </SortableHeader>
        <SortableHeader column="updatedAt" sorting={sorting} className="d-none d-lg-table-cell width-100">
          {gettext("Updated")}
        </SortableHeader>
        <SortableHeader column="llmclient" sorting={sorting} className="">
          {gettext("LLMClient")}
        </SortableHeader>
        <SortableHeader column="awsHostedZoneId" sorting={sorting} className="d-none d-xl-table-cell">
          {gettext("Hosted Zone")}
        </SortableHeader>
        <SortableHeader column="verificationStatus" sorting={sorting} className="">
          {gettext("Verification")}
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

const UpdatedDate = ({ date, createdAt }: { date: string; createdAt: string }) => {
  return <span>{formatDateTime(date, "relative", createdAt)}</span>;
};

/**
 * CustomDomainRow
 *
 * Renders a single custom domain as a table row, displaying its details and action toolbar.
 *
 * @param customDomain - The custom domain object to display.
 * @param sessionContext - Session context for actions.
 * @param onRequery - Callback to refresh custom domain data after an action.
 */
const CustomDomainRow = React.memo(function CustomDomainRow({
  customDomain,
  sessionContext,
  onRequery,
}: {
  customDomain: CustomDomain;
  sessionContext: SessionContext;
  onRequery: () => void;
}) {
  const llmclient = customDomain.llmclient;
  return (
    <tr className="" key={customDomain.id}>
      {/* Name */}
      <td className="p-1 m-0">
        {/* the row opens the custom domain's detail: see TabbedListView. */}
        <span className="fw-semibold text-gray-900">{customDomain.name}</span>
      </td>
      {/* Domain */}
      <td className="">{customDomain.domainName}</td>
      {/* Created Date */}
      <td className="d-none d-lg-table-cell width-100">
        <CreatedDate date={customDomain.createdAt} />
      </td>
      {/* Updated Date */}
      <td className="d-none d-lg-table-cell width-100">
        <UpdatedDate date={customDomain.updatedAt} createdAt={customDomain.createdAt} />
      </td>
      {/* LLMClient */}
      <td className="">
        {llmclient ? (
          <a href={llmclient.sandboxUrl}>{llmclient.name}</a>
        ) : (
          <span className="text-muted">{gettext("None")}</span>
        )}
      </td>
      {/* Hosted Zone */}
      <td className="d-none d-xl-table-cell">
        <code>{customDomain.awsHostedZoneId}</code>
      </td>
      {/* Verification */}
      <td className="">
        <VerificationBadge customDomain={customDomain} />
      </td>
      {/* Status */}
      <td className="d-none d-md-table-cell ">
        <StatusBar customDomain={customDomain} />
      </td>
      {/* Actions */}
      <td className="text-end ">
        <Toolbar sessionContext={sessionContext} customDomain={customDomain} onRequery={onRequery} />
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
  "", // Domain
  "d-none d-lg-table-cell width-100", // Created Date
  "d-none d-lg-table-cell width-100", // Updated Date
  "", // LLMClient
  "d-none d-xl-table-cell", // Hosted Zone
  "", // Verification
  "d-none d-md-table-cell", // Status
  "text-end", // Actions
];

/**
 * ChunkedRows
 *
 * Incrementally renders custom domain rows in chunks to avoid UI blocking.
 * Uses requestIdleCallback (if available) or setTimeout as a fallback to schedule rendering.
 *
 * @param customDomains - Array of custom domain objects to render.
 * @param sessionContext - Session context for actions.
 * @param onRequery - Callback to refresh custom domain data.
 * @param chunkSize - Number of rows to render per chunk (default: 5).
 */
function ChunkedRows({
  customDomains,
  sessionContext,
  onRequery,
  chunkSize = 5,
}: {
  customDomains: CustomDomain[];
  sessionContext: SessionContext;
  onRequery: () => void;
  chunkSize?: number;
}) {
  const [visibleCount, setVisibleCount] = useState(chunkSize);

  useEffect(() => {
    if (visibleCount >= customDomains.length) return;
    const next = () => setVisibleCount((c) => Math.min(c + chunkSize, customDomains.length));
    if (window.requestIdleCallback) {
      const idleId = window.requestIdleCallback(next);
      return () => window.cancelIdleCallback(idleId);
    }
    const timeoutId = setTimeout(next, 0);
    return () => clearTimeout(timeoutId);
  }, [visibleCount, customDomains.length, chunkSize]);
  return (
    <>
      {customDomains.slice(0, visibleCount).map((customDomain) => (
        <CustomDomainRow
          key={customDomain.id}
          customDomain={customDomain}
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
 * Main component for displaying a responsive, table-based list of custom domains.
 * Handles loading state with skeleton rows and incremental rendering for large lists.
 *
 * @param isLoading - Whether the custom domain data is loading (shows skeleton rows if true).
 * @param ghostRows - Number of skeleton rows to display while loading.
 * @param sessionContext - Authentication and API context for actions.
 * @param objects - Array of custom domain objects to display.
 * @param onRequery - Callback to refresh custom domain data.
 * @param sorting - The sort of the list, which its sortable column headers change.
 */
export function ListView({
  isLoading,
  ghostRows,
  sessionContext,
  objects,
  onRequery,
  sorting,
}: CustomDomainListViewProps) {
  console.debug(
    `${loggerPrefix} ListView() Rendering ListView - {isLoading: ${isLoading}, ghostRows: ${ghostRows}, objects length: ${Array.isArray(objects) ? objects.length : "N/A"}}`,
  );
  return (
    <div className="table-responsive custom-domain-list-table-wrap ps-3 pe-3">
      <table className="table table-striped table-hover align-middle border">
        <TableHeader sorting={sorting} />
        <tbody>
          {isLoading ? (
            <SkeletonRows count={ghostRows} columns={SKELETON_COLUMNS} />
          ) : (
            <ChunkedRows customDomains={objects} sessionContext={sessionContext} onRequery={onRequery} />
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ListView;
