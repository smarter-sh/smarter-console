import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { appContext, sessionContext, tokenUsage } from "@/mocks/fixtures";
import { server } from "@test/server";

import TokenUsageChart from "@/components/TokenUsage/Chart";

vi.mock("recharts", async (importOriginal) => (await import("@test/recharts")).withFixedSize(await importOriginal()));

const apiUrl = appContext.chargesApiUrl;

describe("TokenUsageChart", () => {
  it("charts the token usage of the last day, and reloads it for another window", async () => {
    const requested: unknown[] = [];
    server.use(
      http.post(apiUrl, async ({ request }) => {
        requested.push(await request.json());
        return HttpResponse.json(tokenUsage);
      }),
    );
    const user = userEvent.setup();
    render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} height={300} />);
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
    // the y axis's ticks are formatted numbers: the stacked peak is 2,400 + 1,600.
    expect(await screen.findByText("4,000")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "Loading…" })).not.toBeInTheDocument();
    expect(screen.queryByText("No token usage in this period.")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Time period" })).toHaveValue("24_hours");

    await user.selectOptions(screen.getByRole("combobox", { name: "Time period" }), "7_days");
    await vi.waitFor(() => expect(requested).toEqual([{ periodicity: "24_hours" }, { periodicity: "7_days" }]));
  });

  it("offers only the windows that the api has", () => {
    server.use(http.post(apiUrl, () => HttpResponse.json(tokenUsage)));
    render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} />);
    const options = screen.getAllByRole("option").map((option) => option.getAttribute("value"));
    expect(options).toEqual(["12_hours", "24_hours", "7_days", "1_month", "1_year"]);
  });

  it("says so when there was no usage", async () => {
    const points = tokenUsage.points.map((point) => ({
      ...point,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    }));
    server.use(http.post(apiUrl, () => HttpResponse.json({ ...tokenUsage, points })));
    render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByText("No token usage in this period.")).toBeInTheDocument();
  });

  it("keeps the response to the latest window when an earlier one arrives later", async () => {
    let releaseFirst: () => void = () => {};
    server.use(
      http.post(apiUrl, async ({ request }) => {
        const { periodicity } = (await request.json()) as { periodicity: string };
        if (periodicity === "24_hours") {
          await new Promise<void>((resolve) => {
            releaseFirst = resolve;
          });
          return HttpResponse.json(tokenUsage);
        }
        return HttpResponse.json({ periodicity, period: "month", points: [] });
      }),
    );
    const user = userEvent.setup();
    render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Time period" }), "1_year");
    expect(await screen.findByText("No token usage in this period.")).toBeInTheDocument();
    releaseFirst();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("No token usage in this period.")).toBeInTheDocument();
  });

  it.each([
    [
      HttpResponse.json({ error: "Unknown periodicity: 2_weeks." }, { status: 400 }),
      "(400): Unknown periodicity: 2_weeks.",
    ],
    [
      HttpResponse.json({ error: { detail: "not a string" } }, { status: 404, statusText: "Not Found" }),
      "(404): Not Found",
    ],
    [new HttpResponse("not json", { status: 500, statusText: "Server Error" }), "(500): Server Error"],
    [new HttpResponse(null, { status: 200 }), "(200): the server didn't answer with JSON"],
    [
      new HttpResponse("<!DOCTYPE html><html></html>", { status: 200, headers: { "Content-Type": "text/html" } }),
      "(200): the server didn't answer with JSON",
    ],
  ])("shows why the usage failed to load", async (response, message) => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(apiUrl, () => response.clone()));
    render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByText(`Failed to load token usage ${message}`)).toBeInTheDocument();
  });

  it("shows a period's usage on hover, hourly by default, and a value that isn't a number as it is", async () => {
    const [first, second] = tokenUsage.points.slice(2, 4);
    const points = [first, { ...second, prompt_tokens: "n/a", completion_tokens: null }];
    // without a period, the series is hourly.
    server.use(http.post(apiUrl, () => HttpResponse.json({ periodicity: "24_hours", points })));
    const { container } = render(<TokenUsageChart sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByText("02:00 AM")).toBeInTheDocument();
    /* eslint-disable testing-library/no-container, testing-library/no-node-access -- Recharts' chart and tooltip have no roles. */
    const chart = container.querySelector(".recharts-wrapper")!;
    // the chart is 800 pixels wide, with two periods: the first is on the left, the second on the right.
    fireEvent.mouseMove(chart, { clientX: 100, clientY: 150 });
    const tooltip = await waitFor(() => {
      const element = container.querySelector(".recharts-tooltip-wrapper");
      expect(element).toHaveTextContent(/1,200/);
      return element!;
    });
    fireEvent.mouseMove(chart, { clientX: 780, clientY: 150 });
    await waitFor(() => expect(tooltip).toHaveTextContent(/n\/a/));
    /* eslint-enable testing-library/no-container, testing-library/no-node-access */
  });
});
