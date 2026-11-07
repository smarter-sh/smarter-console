/**
 * ResourceChart
 *
 * Loads a resource's budget versus actual series, and charts it. Loaded in its own chunk,
 * with recharts. The series is a query of the console's cache (TanStack Query).
 */
import { useQuery } from "@tanstack/react-query";
import { fetchDjangoUrl, gettext, interpolate, useSmarterQueryClient } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import BudgetChart from "./BudgetChart";
import type { BudgetSeriesRow } from "./format";
import type { BudgetResourceStatus } from "../../lib/Types";
import { loggerPrefix } from "../../lib/const";

const PERIODS = 12;

type SeriesResponse = { status: { budget: string }; series: BudgetSeriesRow[] }[];

/**
 * Loads a resource's series, for its budget.
 *
 * @param sessionContext - The request's authentication and headers.
 * @param status - The resource's status under its budget, which names the series' url.
 * @param signal - Aborts the request, when TanStack Query no longer needs it.
 * @returns The budget's series for the resource, or none.
 * @throws Error - With the status of a failed response.
 */
async function loadSeries(
  sessionContext: SessionContext,
  status: BudgetResourceStatus,
  signal: AbortSignal,
): Promise<BudgetSeriesRow[]> {
  try {
    const response = await fetchDjangoUrl(
      sessionContext,
      `${status.seriesUrl}?periods=${PERIODS}`,
      JSON.stringify({}),
      signal,
    );
    if (!response.ok)
      throw new Error(
        interpolate(gettext("Failed to load the budget series (%(status)s)."), { status: response.status }),
      );
    const data = (await response.json()) as SeriesResponse;
    return data.find((s) => s.status.budget === status.budget)?.series ?? [];
  } catch (error) {
    console.error(loggerPrefix, "Error loading budget series:", error);
    throw error;
  }
}

export default function ResourceChart({
  sessionContext,
  status,
}: {
  sessionContext: SessionContext;
  status: BudgetResourceStatus;
}) {
  // the series is a query of the console's cache: a chart shown again, e.g. after Hide and Chart, shows at once.
  const queryClient = useSmarterQueryClient();
  const query = useQuery(
    {
      queryKey: ["smarter-budget-series", status.seriesUrl, PERIODS, status.budget],
      queryFn: ({ signal }) => loadSeries(sessionContext, status, signal),
    },
    queryClient,
  );
  const series = query.data ?? null;
  const errMessage = query.isError ? query.error.message : "";

  if (errMessage) return <div className="text-danger fs-7">{errMessage}</div>;
  if (series === null) return <div className="text-muted fs-7">{gettext("Loading…")}</div>;
  return (
    <BudgetChart
      series={series}
      unit={status.unit}
      period={status.period}
      periodicLimit={status.periodicLimit}
      height={260}
    />
  );
}
