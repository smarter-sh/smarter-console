import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DAILY_LIMIT_ERROR,
  EXAMPLE_COMMIT,
  EXAMPLE_REPOSITORY,
  NOT_A_REPOSITORY_ERROR,
  REPOSITORY_APPLY_API_URL,
  applyingRun,
  cloningRun,
  finishedRun,
  noRuns,
  queuedRun,
  recentRuns,
  sessionContext,
} from "@/mocks/fixtures";
import {
  progressingRunHandler,
  repositoryIdleHandlers,
  repositoryInProgressHandlers,
  repositoryRecentHandlers,
  runListHandler,
  startRunErrorHandler,
  startRunHandler,
} from "@/mocks/handlers";
import { server } from "@test/server";

import RepositoryApply from "@/components/RepositoryApply";

function renderPage(pollInterval = 1) {
  return render(
    <RepositoryApply sessionContext={sessionContext} apiUrl={REPOSITORY_APPLY_API_URL} pollInterval={pollInterval} />,
  );
}

const urlInput = () => screen.getByLabelText("Public GitHub repository");
const applyButton = () => screen.getByRole("button", { name: /Apply repository|Starting/ });

/** Type a repository's url, and apply it. */
async function applyRepository(user: ReturnType<typeof userEvent.setup>, url = EXAMPLE_REPOSITORY) {
  await screen.findByText("You haven't applied a repository yet.");
  await user.type(urlInput(), url);
  await user.click(applyButton());
}

/** The table's rows of manifests, without its header row and the open details' rows. */
function manifestRows() {
  const table = screen.getByRole("table", { name: "Discovered manifests, in apply order" });
  return within(table)
    .getAllByRole("row")
    .filter((row) => row.closest("thead") === null && within(row).queryAllByRole("cell").length === 5);
}

describe("RepositoryApply", () => {
  beforeEach(() => {
    // fetchDjangoUrl reports the CSRF cookie that tests don't have.
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("explains what happens, and checks the url as the user types it", async () => {
    server.use(...repositoryIdleHandlers());
    const user = userEvent.setup();
    renderPage();
    expect(screen.getByText(/The repository's scripts never run/)).toBeInTheDocument();
    expect(await screen.findByText(/You can apply up to 20 repositories a day./)).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();

    await user.type(urlInput(), "https://gitlab.com/smarter-sh/example-manifests");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter a public GitHub repository's url: https://github.com/<owner>/<repository>.",
    );
    expect(urlInput()).toHaveAttribute("aria-invalid", "true");
    expect(applyButton()).toBeDisabled();

    await user.clear(urlInput());
    await user.type(urlInput(), `${EXAMPLE_REPOSITORY}.git`);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(applyButton()).toBeEnabled();
  });

  it("starts a run, and follows it until it finishes", async () => {
    let body: unknown;
    server.use(
      http.post(REPOSITORY_APPLY_API_URL, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(queuedRun, { status: 202 });
      }),
      ...repositoryIdleHandlers(),
    );
    const user = userEvent.setup();
    renderPage();
    await applyRepository(user);
    expect(body).toEqual({ url: EXAMPLE_REPOSITORY });

    // queued, then cloning, then applying, then finished.
    expect(await screen.findByText("Finished: all 134 manifests attempted.")).toBeInTheDocument();
    const run = screen.getByRole("region", { name: /smarter-sh\/example-manifests/ });
    expect(within(run).getByRole("link", { name: "smarter-sh/example-manifests" })).toHaveAttribute(
      "href",
      EXAMPLE_REPOSITORY,
    );
    expect(within(run).getByRole("link", { name: "a2ca1f7" })).toHaveAttribute(
      "href",
      `${EXAMPLE_REPOSITORY}/commit/${EXAMPLE_COMMIT}`,
    );
    const progress = within(run).getByRole("progressbar", { name: "Manifests attempted" });
    expect(progress).toHaveAttribute("aria-valuetext", "134 of 134");
    expect(within(run).getByRole("button", { name: "Failed 14" })).toBeInTheDocument();
    expect(within(run).getByRole("button", { name: "Skipped 6" })).toBeInTheDocument();
    expect(within(run).getByRole("button", { name: "Applied 114" })).toBeInTheDocument();
    expect(manifestRows()).toHaveLength(134);

    // the run is in the recent runs, and another can be applied.
    const recent = screen.getByRole("region", { name: "Recent runs" });
    expect(within(recent).getByRole("button", { name: /smarter-sh\/example-manifests/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await waitFor(() => expect(applyButton()).toBeEnabled());
  });

  it("shows each stage while the run is in progress, and the manifest being applied", async () => {
    server.use(runListHandler(noRuns), startRunHandler(queuedRun), progressingRunHandler([cloningRun, applyingRun]));
    const user = userEvent.setup();
    renderPage(20);
    await applyRepository(user);

    expect(await screen.findByText("Waiting to start…")).toBeInTheDocument();
    expect(screen.getByText("The repository's manifests show here once it has been cloned.")).toBeInTheDocument();
    expect(screen.getByText("The commit is known once the repository has been cloned.")).toBeInTheDocument();
    expect(applyButton()).toBeDisabled();
    expect(screen.getByText("A repository is being applied. You can apply another one when it's done.")).toBeVisible();

    expect(await screen.findByText("Cloning the repository, and finding its manifests…")).toBeInTheDocument();
    const stages = screen.getByRole("list", { name: "Stages" });
    expect(within(stages).getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step");

    expect(await screen.findByText("Applying manifest 65 of 134…")).toBeInTheDocument();
    expect(within(stages).getAllByRole("listitem")[2]).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("progressbar", { name: "Manifests attempted" })).toHaveAttribute(
      "aria-valuetext",
      "64 of 134",
    );
    const row = manifestRows()[64];
    expect(row).toHaveTextContent("Applying");
    expect(manifestRows()[65]).toHaveTextContent("Pending");
  });

  it("shows the run that is already in progress, instead of starting another", async () => {
    server.use(runListHandler(noRuns), startRunHandler(applyingRun, 200), progressingRunHandler([applyingRun]));
    const user = userEvent.setup();
    renderPage(60_000);
    await applyRepository(user);
    expect(
      await screen.findByText(
        "You already have a repository being applied. Here it is; apply another one when it's done.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Applying manifest 65 of 134…")).toBeInTheDocument();
  });

  it.each([NOT_A_REPOSITORY_ERROR, DAILY_LIMIT_ERROR])("shows the api's refusal inline: %s", async (error) => {
    server.use(startRunErrorHandler(error), ...repositoryIdleHandlers());
    const user = userEvent.setup();
    renderPage();
    await applyRepository(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(error);
    expect(urlInput()).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("region", { name: /smarter-sh/ })).not.toBeInTheDocument();

    // typing again clears it.
    await user.type(urlInput(), "x");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("filters the manifests by status", async () => {
    server.use(...repositoryRecentHandlers());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /smarter-sh\/example-manifests/ }));
    const failed = await screen.findByRole("button", { name: "Failed 14" });
    expect(screen.getByRole("button", { name: "All 134" })).toHaveAttribute("aria-pressed", "true");

    await user.click(failed);
    expect(failed).toHaveAttribute("aria-pressed", "true");
    const rows = manifestRows();
    expect(rows).toHaveLength(14);
    for (const row of rows) expect(row).toHaveTextContent("Failed");
    expect(rows.filter((row) => row.textContent?.includes("MCPClient"))).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "Skipped 6" }));
    expect(manifestRows()).toHaveLength(6);
    for (const row of manifestRows()) expect(row).toHaveTextContent("Budget");

    await user.click(screen.getByRole("button", { name: "Pending 0" }));
    expect(screen.getByText("No manifest is pending.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Applied 114" }));
    expect(manifestRows()).toHaveLength(114);
  });

  it("opens a failure's details: its message, which can be copied, its output, and its file", async () => {
    server.use(...repositoryRecentHandlers());
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /smarter-sh\/example-manifests/ }));
    await user.click(await screen.findByRole("button", { name: "Failed 14" }));

    const toggle = screen.getByRole("button", { name: "Failed: details of MCPClient github" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const details = screen.getByRole("region", { name: "Details of MCPClient github" });
    expect(toggle).toHaveAttribute("aria-controls", details.id);
    const panel = within(details);
    expect(panel.getByText("Why it failed")).toBeInTheDocument();
    expect(panel.getByText(/Secret github_personal_access_token not found, or not shared with you./)).toBeVisible();
    expect(panel.getByText("Apply output")).toBeInTheDocument();
    expect(panel.getByRole("link", { name: "View the file on GitHub" })).toHaveAttribute(
      "href",
      `${EXAMPLE_REPOSITORY}/blob/${EXAMPLE_COMMIT}/smarter/mcp-clients/github.yaml`,
    );
    expect(panel.getByRole("link", { name: "View the file on GitHub" })).toHaveAttribute("rel", "noopener noreferrer");

    await user.click(panel.getByRole("button", { name: "Copy the message of MCPClient github" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("SAMBrokerErrorNotFound"));
    expect(await panel.findByText("Copied")).toBeInTheDocument();

    // a multi-line validation error, and a skipped Budget's reason.
    await user.click(screen.getByRole("button", { name: "Failed: details of Vectorstore example_research_papers" }));
    expect(screen.getByText(/1 validation error for SAMVectorstore/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Skipped 6" }));
    await user.click(screen.getByRole("button", { name: "Skipped: details of Budget account_monthly_cap" }));
    expect(screen.getByText("Why it was skipped")).toBeInTheDocument();
    expect(screen.queryByText("Apply output")).not.toBeInTheDocument();

    // closing it.
    await user.click(screen.getByRole("button", { name: "Skipped: details of Budget account_monthly_cap" }));
    expect(screen.queryByText("Why it was skipped")).not.toBeInTheDocument();
  });

  it("doesn't say Copied when the clipboard refuses", async () => {
    server.use(...repositoryRecentHandlers());
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /smarter-sh\/example-manifests/ }));
    await user.click(await screen.findByRole("button", { name: "Applied: details of Proxy anthropic" }));
    expect(screen.getByText("No message.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Failed 14" }));
    await user.click(screen.getByRole("button", { name: "Failed: details of MCPClient asana" }));
    await user.click(screen.getByRole("button", { name: "Copy the message of MCPClient asana" }));
    expect(writeText).toHaveBeenCalled();
    expect(screen.queryByText("Copied")).not.toBeInTheDocument();
  });

  it("lists the recent runs, and shows the one chosen", async () => {
    server.use(...repositoryRecentHandlers());
    const user = userEvent.setup();
    renderPage();
    const recent = await screen.findByRole("region", { name: "Recent runs" });
    const buttons = await within(recent).findAllByRole("button");
    expect(buttons).toHaveLength(recentRuns.runs.length);
    expect(buttons[0]).toHaveTextContent("smarter-sh/example-manifests");
    expect(buttons[0]).toHaveTextContent("Finished");
    expect(buttons[0]).toHaveTextContent("114 applied, 6 skipped, 14 failed");
    expect(buttons[0]).toHaveTextContent("Nov 23, 2026");
    expect(buttons[1]).toHaveTextContent("smarter-sh/example-manifest");
    expect(buttons[1]).toHaveTextContent("Failed");
    // nothing is shown until one is chosen, since none is in progress.
    expect(screen.queryByRole("table")).not.toBeInTheDocument();

    await user.click(buttons[3]);
    expect(await screen.findByText("Finished: all 5 manifests attempted.")).toBeInTheDocument();
    expect(buttons[3]).toHaveAttribute("aria-current", "true");
    expect(manifestRows()).toHaveLength(5);
  });

  it("shows a run that failed as a whole, with why, at the top", async () => {
    server.use(...repositoryRecentHandlers());
    const user = userEvent.setup();
    renderPage();
    const recent = await screen.findByRole("region", { name: "Recent runs" });
    await user.click((await within(recent).findAllByRole("button"))[1]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This run failed.");
    expect(alert).toHaveTextContent("The repository could not be cloned. Check that it exists, and that it is public.");
    expect(screen.getByText("No manifests were discovered.")).toBeInTheDocument();
    const stages = screen.getByRole("list", { name: "Stages" });
    expect(within(stages).getAllByRole("listitem")[1]).toHaveTextContent("Clone (failed)");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();

    // one that failed after cloning stopped while applying.
    await user.click(within(recent).getAllByRole("button")[2]);
    expect(await screen.findByText("The repository holds no Smarter manifest.")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Stages" })).getAllByRole("listitem")[2]).toHaveTextContent(
      "Apply (failed)",
    );
  });

  it("resumes following the newest run when it is still in progress", async () => {
    server.use(...repositoryInProgressHandlers());
    renderPage(60_000);
    expect(await screen.findByText("Applying manifest 65 of 134…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply repository/ })).toBeDisabled();
    const recent = screen.getByRole("region", { name: "Recent runs" });
    expect(within(recent).getAllByRole("button")[0]).toHaveTextContent("62 applied, 2 failed, 70 pending");
  });

  it("reports a run that can't be loaded, until it is dismissed", async () => {
    server.use(
      runListHandler(recentRuns),
      http.get(`${REPOSITORY_APPLY_API_URL}:id/`, () => HttpResponse.json({ error: "Not found." }, { status: 404 })),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /smarter-sh\/stackademy/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found.");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports the recent runs that can't be loaded, with the status when the api says nothing", async () => {
    server.use(http.get(REPOSITORY_APPLY_API_URL, () => new HttpResponse("oops", { status: 500 })));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Request failed: 500");
  });

  it("stops following a run whose progress can't be loaded", async () => {
    server.use(
      runListHandler({ ...noRuns, runs: [applyingRun] }),
      http.get(`${REPOSITORY_APPLY_API_URL}:id/`, () => HttpResponse.json({ error: "Not found." }, { status: 404 })),
    );
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Not found.");
  });

  it("follows a finished run no further", async () => {
    let requests = 0;
    server.use(
      runListHandler(recentRuns),
      http.get(`${REPOSITORY_APPLY_API_URL}:id/`, () => {
        requests += 1;
        return HttpResponse.json(finishedRun);
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /smarter-sh\/example-manifests/ }));
    await screen.findByText("Finished: all 134 manifests attempted.");
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requests).toBe(1);
  });
});
