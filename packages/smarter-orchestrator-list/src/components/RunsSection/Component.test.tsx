import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import { server } from "@test/server";

import { makeObject, makeRun, sessionContext } from "@/mocks/fixtures";
import { RUNS_URL, runsHandlers } from "@/mocks/handlers";

import RunsSection from "@/components/RunsSection/Component";

function renderSection(overrides = {}) {
  return render(<RunsSection sessionContext={sessionContext} orchestrator={makeObject(1, overrides)} />);
}

describe("RunsSection", () => {
  it("lists the user's runs, and shows the newest's steps and result", async () => {
    server.use(...runsHandlers());
    renderSection();
    expect(await screen.findByRole("button", { name: "Prepare the board pack, number 2." })).toBeInTheDocument();
    const run = screen.getByLabelText("Run");
    expect(within(run).getByText("hr_assistant")).toBeInTheDocument();
    expect(within(run).getByText("1234-5678-0002")).toBeInTheDocument();
    expect(within(run).getByText(/The board pack, number 2\./)).toBeInTheDocument();
  });

  it("shows the run that is chosen", async () => {
    server.use(...runsHandlers());
    renderSection();
    await userEvent.click(await screen.findByRole("button", { name: "Prepare the board pack, number 1." }));
    expect(within(screen.getByLabelText("Run")).getByText(/The board pack, number 1\./)).toBeInTheDocument();
  });

  it("starts a run toward the objective, and shows it", async () => {
    let body: unknown = null;
    // the test's own handler first: MSW answers with the first that matches.
    server.use(
      http.post(RUNS_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(makeRun(3, { status: "pending", result: null, steps: [] }), { status: 202 });
      }),
      ...runsHandlers([]),
    );
    renderSection();
    expect(await screen.findByText("You haven't run it yet.")).toBeInTheDocument();
    const start = screen.getByRole("button", { name: "Start a run" });
    expect(start).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Objective"), "  Prepare the board pack.  ");
    server.use(
      http.get(RUNS_URL, () => HttpResponse.json([makeRun(3, { status: "pending", result: null, steps: [] })])),
    );
    await userEvent.click(start);
    expect(await screen.findByText("Pending")).toBeInTheDocument();
    expect(body).toEqual({ objective: "Prepare the board pack." });
    expect(screen.getByText("This run hasn't ended yet. Its steps appear as they end.")).toBeInTheDocument();
    expect(screen.getByLabelText("Objective")).toHaveValue("");
  });

  it("shows why a run may not start", async () => {
    server.use(
      http.post(RUNS_URL, () =>
        HttpResponse.json({ detail: "You may not use every LLMClient of the Orchestrator." }, { status: 403 }),
      ),
      ...runsHandlers([]),
    );
    renderSection();
    await userEvent.type(screen.getByLabelText("Objective"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Start a run" }));
    expect(await screen.findByText("You may not use every LLMClient of the Orchestrator.")).toBeInTheDocument();
  });

  it("explains a refusal without a reason by its status", async () => {
    server.use(
      http.post(RUNS_URL, () => new HttpResponse("oops", { status: 500 })),
      ...runsHandlers([]),
    );
    renderSection();
    await userEvent.type(screen.getByLabelText("Objective"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Start a run" }));
    expect(await screen.findByText("The run could not start (500).")).toBeInTheDocument();
  });

  it("doesn't start an inactive orchestrator", async () => {
    server.use(...runsHandlers([]));
    renderSection({ isActive: false });
    await userEvent.type(screen.getByLabelText("Objective"), "x");
    expect(screen.getByRole("button", { name: "Start a run" })).toBeDisabled();
    expect(screen.getByText("An inactive orchestrator can't run.")).toBeInTheDocument();
  });

  it("says when the runs could not be loaded", async () => {
    server.use(http.get(RUNS_URL, () => HttpResponse.json({ detail: "x" }, { status: 500 })));
    renderSection();
    expect(await screen.findByText("The runs could not be loaded (500).")).toBeInTheDocument();
  });

  it("follows a run until it ends, and shows a failure", async () => {
    let calls = 0;
    server.use(
      http.get(RUNS_URL, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.json([makeRun(4, { status: "running", result: null, steps: [] })]);
        return HttpResponse.json([
          makeRun(4, {
            status: "failed",
            result: null,
            errorMessage: "hr_assistant failed: The step failed.",
            steps: [
              {
                sequence: 1,
                llmclient: "hr_assistant",
                accountNumber: "1234-5678-0002",
                role: "executor",
                status: "failed",
                errorMessage: "The step failed.",
                createdAt: null,
              },
            ],
          }),
        ]);
      }),
    );
    renderSection();
    expect(await screen.findByText("Running")).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText("Failed").length).toBeGreaterThan(0), { timeout: 5000 });
    expect(screen.getByText("hr_assistant failed: The step failed.")).toBeInTheDocument();
    expect(screen.getByText("The step failed.")).toBeInTheDocument();
  });
});
