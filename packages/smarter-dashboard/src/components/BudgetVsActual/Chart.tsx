/**
 * BudgetVsActualChart
 *
 * Lets the user choose one of the budgets that apply to them, or to the resources they may see,
 * and charts its budget versus the actual spending of the last 12 billing periods.
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchDjangoUrl, gettext, interpolate, interpolateNodes, useSmarterQueryClient } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import BudgetChart from "./BudgetChart";
import { formatAmount } from "./format";
import type { BudgetSeries, BudgetStatus } from "./types";
import { loggerPrefix } from "../../const";
import { dashboardQueryKey } from "../../hooks/useDashboardApi";

const PERIODS = 12;

const keyOf = (status: BudgetStatus) => `${status.budget}|${status.resource_locator}`;

async function postJson<T>(sessionContext: SessionContext, url: string, signal: AbortSignal, what: string): Promise<T> {
  try {
    const response = await fetchDjangoUrl(sessionContext, url, JSON.stringify({}), signal);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(`(${response.status}) ${body?.error || response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(loggerPrefix, `Error fetching ${what}:`, error);
    throw error;
  }
}

function Usage({
  label,
  actual,
  limit,
  percent,
  status,
}: {
  label: string;
  actual: number;
  limit: number;
  percent: number | null;
  status: BudgetStatus;
}) {
  if (!limit) return null;
  const over = percent !== null && percent >= 100;
  return (
    <span className={`badge ${over ? "badge-light-danger" : "badge-light-success"} me-2 fs-7`}>
      {interpolateNodes(gettext("%(label)s: %(amount)s of %(amount2)s"), {
        label,
        amount: formatAmount(actual, status.unit),
        amount2: formatAmount(limit, status.unit),
      })}
      {percent !== null ? ` (${percent}%)` : ""}
    </span>
  );
}

export default function BudgetVsActualChart({
  sessionContext,
  apiUrl,
}: {
  sessionContext: SessionContext;
  apiUrl: string;
}) {
  // the budgets, and the chosen budget's series, are queries of the console's cache, which shows them at once when
  // the dashboard opens again. The budgets are the same response as BudgetAlerts', with the same key.
  const queryClient = useSmarterQueryClient();
  const statusesQuery = useQuery(
    {
      queryKey: dashboardQueryKey(apiUrl),
      queryFn: ({ signal }) => postJson<BudgetStatus[]>(sessionContext, apiUrl, signal, "budgets"),
    },
    queryClient,
  );
  const statuses = statusesQuery.data ?? null;
  // the budget that the user chose, or the first.
  const [chosen, setSelected] = useState<string>("");
  const selected = chosen || (statuses && statuses.length > 0 ? keyOf(statuses[0]) : "");
  const status = useMemo(() => statuses?.find((s) => keyOf(s) === selected) ?? null, [statuses, selected]);

  const base = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
  const seriesUrl = status ? `${base}${encodeURIComponent(status.resource_locator)}/series/?periods=${PERIODS}` : "";
  const seriesQuery = useQuery(
    {
      queryKey: dashboardQueryKey(seriesUrl),
      queryFn: ({ signal }) => postJson<BudgetSeries[]>(sessionContext, seriesUrl, signal, "budget series"),
      enabled: !!status,
    },
    queryClient,
  );
  const series = (status && seriesQuery.data?.find((s) => s.status.budget === status.budget)) ?? null;
  const failed = [statusesQuery, seriesQuery].find((query) => query.isError);
  const errMessage = failed?.error?.message ?? "";

  if (statuses === null && !errMessage)
    return <div style={{ fontSize: "0.85rem", opacity: 0.6 }}>{gettext("Loading…")}</div>;
  if (statuses !== null && statuses.length === 0) {
    return <div className="text-muted">{gettext("No budgets apply to you, or to your resources.")}</div>;
  }

  return (
    <div>
      {errMessage && <div style={{ color: "#b91c1c", marginBottom: "0.5rem", fontSize: "0.9rem" }}>{errMessage}</div>}
      {statuses && (
        <div className="d-flex flex-wrap align-items-center mb-4 gap-2">
          <select
            className="form-select form-select-sm w-auto"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {statuses.map((s) => (
              <option key={keyOf(s)} value={keyOf(s)}>
                {s.budget} — {s.resource_locator}
              </option>
            ))}
          </select>
          {status && (
            <>
              <Usage
                label={interpolate(gettext("This %(period)s"), { period: status.period })}
                actual={status.periodic_actual}
                limit={status.periodic_limit}
                percent={status.periodic_percent}
                status={status}
              />
              <Usage
                label={gettext("Total")}
                actual={status.absolute_actual}
                limit={status.absolute_limit}
                percent={status.absolute_percent}
                status={status}
              />
              {status.is_locked && (
                <span className="badge badge-danger fs-7" title={status.lock_reason ?? ""}>
                  {gettext("Blocked")}
                </span>
              )}
              {status.is_expired && <span className="badge badge-light fs-7">{gettext("Ended")}</span>}
            </>
          )}
        </div>
      )}
      {status && series && (
        <BudgetChart
          series={series.series}
          unit={status.unit}
          period={status.period}
          periodicLimit={status.periodic_limit}
        />
      )}
    </div>
  );
}
