/**
 * The Token Usage chart: the prompt and completion tokens of the user's LLM requests, stacked,
 * one point per hour, day or month of the chosen window.
 *
 * It POSTs ``{"periodicity": "<window>"}`` to the dashboard's charges api, which answers with a
 * TokenUsageSeries (see ``smarter.apps.dashboard.views.views.api.charges``). Charges are aggregated
 * by the hour, so the shortest window is 12 hours.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fetchDjangoUrl, gettext, interpolate, useSmarterQueryClient } from "@smarter/common";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";

import { formatPeriod } from "../BudgetVsActual/format";
import type { TokenUsageChartProps, TokenUsagePoint, TokenUsageSeries } from "./types";
import { loggerPrefix } from "../../const";
import { dashboardQueryKey } from "../../hooks/useDashboardApi";

const AREAS: { key: keyof TokenUsagePoint; label: string; color: string }[] = [
  { key: "prompt_tokens", label: gettext("Request"), color: "#ff5733" },
  { key: "completion_tokens", label: gettext("Completion"), color: "#17C653" },
];

const PERIODICITY_OPTIONS = [
  { label: gettext("Half Day"), value: "12_hours" },
  { label: gettext("Day"), value: "24_hours" },
  { label: gettext("Week"), value: "7_days" },
  { label: gettext("Month"), value: "1_month" },
  { label: gettext("Year"), value: "1_year" },
];

const DEFAULT_PERIODICITY = "24_hours";

type DropdownProps = {
  value: string;
  onChange: (value: string) => void;
};

function ChargesPeriodicityDropdown({ value, onChange }: DropdownProps) {
  return (
    <select
      className="form-select form-select-sm w-auto"
      aria-label={gettext("Time period")}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {PERIODICITY_OPTIONS.map((option) => (
        <option value={option.value} key={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

/** The error message of a failed response: its JSON ``error``, if that's a string, or its status text. */
async function errorOf(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const error = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
  return typeof error === "string" ? error : response.statusText;
}

/**
 * Fetches the token usage of a period.
 *
 * @param sessionContext - The request's authentication and headers.
 * @param apiUrl - The token usage api's url.
 * @param periodicity - The period, e.g. 24_hours.
 * @param signal - Aborts the request, when TanStack Query no longer needs it.
 * @returns The series.
 * @throws Error - With the status and error of a failed response, or of a response that isn't JSON.
 */
async function fetchTokenUsage(
  sessionContext: TokenUsageChartProps["sessionContext"],
  apiUrl: string,
  periodicity: string,
  signal: AbortSignal,
): Promise<TokenUsageSeries> {
  try {
    const response = await fetchDjangoUrl(sessionContext, apiUrl, JSON.stringify({ periodicity }), signal);
    if (!response.ok) {
      throw new Error(
        interpolate(gettext("Failed to load token usage (%(status)s): %(error)s"), {
          status: response.status,
          error: await errorOf(response),
        }),
      );
    }
    // an html page, e.g. a login page after a redirect, or an error page, is not a series.
    if (!(response.headers.get("Content-Type") ?? "").includes("application/json")) {
      throw new Error(
        interpolate(gettext("Failed to load token usage (%(status)s): %(error)s"), {
          status: response.status,
          error: gettext("the server didn't answer with JSON"),
        }),
      );
    }
    const data = (await response.json()) as TokenUsageSeries;
    console.debug(loggerPrefix, "Successfully fetched token usage:", data);
    return data;
  } catch (error) {
    console.error(loggerPrefix, "Error fetching token usage:", error);
    throw error;
  }
}

export default function TokenUsageChart({ sessionContext, apiUrl, height = 400 }: TokenUsageChartProps) {
  const [periodicity, setPeriodicity] = useState(DEFAULT_PERIODICITY);
  // each period's series is a query of the console's cache, which shows it at once when the dashboard opens again.
  // While another period loads, the chart keeps showing the previous one.
  const queryClient = useSmarterQueryClient();
  const query = useQuery(
    {
      queryKey: dashboardQueryKey(apiUrl, { periodicity }),
      queryFn: ({ signal }) => fetchTokenUsage(sessionContext, apiUrl, periodicity, signal),
      placeholderData: keepPreviousData,
    },
    queryClient,
  );
  const series = query.data ?? null;
  const errMessage = query.isError && !query.isFetching ? query.error.message : "";
  // loading until the period's series arrives: the first, and each period chosen.
  const isLoading = query.isFetching && (query.data === undefined || query.isPlaceholderData);

  const rows = (series?.points ?? []).map((point) => ({
    ...point,
    label: formatPeriod(point.period_start, series?.period ?? "hour"),
  }));
  const empty = !isLoading && !errMessage && series !== null && rows.every((row) => row.total_tokens === 0);

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <ChargesPeriodicityDropdown value={periodicity} onChange={setPeriodicity} />
      </div>

      {errMessage && <div style={{ color: "#b91c1c", marginBottom: "0.5rem", fontSize: "0.9rem" }}>{errMessage}</div>}
      {empty && <div className="text-muted fs-7 mb-2">{gettext("No token usage in this period.")}</div>}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(value: number) => value.toLocaleString()} />
          <Tooltip
            formatter={(value) => {
              if (typeof value === "number") {
                return value.toLocaleString();
              }
              return value ?? "";
            }}
          />
          <Legend />
          {AREAS.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              name={area.label}
              stackId="usage"
              fill={area.color}
              stroke={area.color}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {isLoading && <div style={{ marginTop: "0.5rem", fontSize: "0.85rem", opacity: 0.6 }}>{gettext("Loading…")}</div>}
    </div>
  );
}
