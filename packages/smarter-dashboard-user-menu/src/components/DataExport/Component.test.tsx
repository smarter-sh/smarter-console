import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { appContext, runningExport, sessionContext } from "@/mocks/fixtures";
import {
  dataExportErrorHandlers,
  dataExportFailureHandlers,
  dataExportHandlers,
  dataExportInProgressHandlers,
  dataExportLimitHandlers,
  dataExportRefusedHandlers,
} from "@/mocks/handlers";
import { server } from "@test/server";

import DataExportDialog from "@/components/DataExport/Component";

const apiUrl = appContext.urls.dataExportApi;

/** Open the dialog, with its timers short, so that an export runs through its steps at once. */
function openDialog(onClose = vi.fn()) {
  render(
    <DataExportDialog
      sessionContext={sessionContext}
      apiUrl={apiUrl}
      onClose={onClose}
      pollInterval={1}
      stepDuration={1}
    />,
  );
  return onClose;
}

const requestButton = () => screen.findByRole("button", { name: "Request my data" });

describe("DataExportDialog", () => {
  it("explains what happens, where the link goes, and how many requests are left", async () => {
    server.use(...dataExportHandlers());
    openDialog();
    expect(screen.getByRole("dialog", { name: "Get a copy of your data" })).toBeInTheDocument();
    expect(screen.getByText("What you'll get")).toBeInTheDocument();
    expect(screen.getByText("How long it takes")).toBeInTheDocument();
    expect(screen.getByText("Your secrets stay secret")).toBeInTheDocument();
    expect(
      await screen.findByText("A download link is emailed to ada@example.edu. It works for 24 hours."),
    ).toBeInTheDocument();
    expect(screen.getByText("4 of 5 requests left today")).toBeInTheDocument();
    expect(await requestButton()).toBeEnabled();
  });

  it("runs an export through every step, and says where the email went", async () => {
    server.use(...dataExportHandlers());
    const user = userEvent.setup();
    openDialog();
    await user.click(await requestButton());
    expect(await screen.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
    expect(
      screen.getByText("A link to your data is on its way to ada@example.edu. It works for 24 hours."),
    ).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("28 KB")).toBeInTheDocument();
    expect(screen.getByText("1 resource could not be exported. The README says which, and why.")).toBeInTheDocument();
    // the focus moves in an effect, after the render that shows the heading.
    await waitFor(() => expect(screen.getByRole("button", { name: "Done" })).toHaveFocus());
  });

  it("shows the steps, and the manifests written, while the export runs", async () => {
    server.use(...dataExportHandlers());
    const user = userEvent.setup();
    render(
      <DataExportDialog sessionContext={sessionContext} apiUrl={apiUrl} onClose={vi.fn()} pollInterval={60_000} />,
    );
    await user.click(await requestButton());
    expect(await screen.findByRole("heading", { name: "Preparing your data…" })).toBeInTheDocument();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Write their manifests")).toBeInTheDocument();
    // the dialog's close button, and the footer's.
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(2);
  });

  it("follows an export that is already in progress, with its progress bar", async () => {
    server.use(...dataExportInProgressHandlers);
    render(
      <DataExportDialog
        sessionContext={sessionContext}
        apiUrl={apiUrl}
        onClose={vi.fn()}
        pollInterval={60_000}
        stepDuration={1}
      />,
    );
    const bar = await screen.findByRole("progressbar", { name: "Manifests written" });
    expect(bar).toHaveValue(runningExport.manifestCount);
    expect(screen.getByText("10 of 24")).toBeInTheDocument();
  });

  it("says why an export failed, and offers to try again", async () => {
    server.use(...dataExportFailureHandlers());
    const user = userEvent.setup();
    openDialog();
    await user.click(await requestButton());
    expect(await screen.findByRole("heading", { name: "Your data couldn't be exported" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("The private storage could not be reached.");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("3 of 5 requests left today")).toBeInTheDocument();
  });

  it("fails the export when its progress can't be read", async () => {
    // the first handler that matches answers, so the failing one comes first.
    server.use(
      http.get(`${apiUrl}:id/`, () => HttpResponse.json({ error: "Gateway timeout" }, { status: 504 })),
      ...dataExportHandlers(),
    );
    const user = userEvent.setup();
    openDialog();
    await user.click(await requestButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Gateway timeout");
  });

  it("can't start once the day's requests are used up", async () => {
    server.use(...dataExportLimitHandlers);
    openDialog();
    expect(
      await screen.findByText("You can download your data 5 times a day. Please try again tomorrow."),
    ).toBeInTheDocument();
    expect(await requestButton()).toBeDisabled();
  });

  it("can't start without an email address", async () => {
    server.use(
      http.get(apiUrl, () =>
        HttpResponse.json({ email: "", linkHours: 24, exportsPerDay: 5, exportsLeftToday: 5, latest: null }),
      ),
    );
    openDialog();
    expect(
      await screen.findByText("Your account has no email address to send the download link to."),
    ).toBeInTheDocument();
    expect(screen.getByText("A download link is emailed to you. It works for 24 hours.")).toBeInTheDocument();
    expect(await requestButton()).toBeDisabled();
  });

  it("shows the api's reason when it refuses to start", async () => {
    server.use(...dataExportRefusedHandlers);
    const user = userEvent.setup();
    openDialog();
    await user.click(await requestButton());
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again tomorrow.");
    expect(screen.getByRole("heading", { name: "Get a copy of your data" })).toBeInTheDocument();
  });

  it("shows why the overview didn't load", async () => {
    server.use(...dataExportErrorHandlers);
    openDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent("Service unavailable");
    expect(await requestButton()).toBeDisabled();
  });

  it("closes on Escape, the close button, Cancel and a click on the backdrop, and keeps the focus inside", async () => {
    server.use(...dataExportHandlers());
    const user = userEvent.setup();
    const onClose = openDialog();
    await requestButton();
    await waitFor(() => expect(screen.getByRole("button", { name: "Request my data" })).toHaveFocus());

    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
    await user.tab({ shift: true });
    expect(screen.getByRole("button", { name: "Request my data" })).toHaveFocus();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    // the backdrop has no role: a click on it is a mouse convenience, whose keyboard equivalent is Escape.
    // eslint-disable-next-line testing-library/no-node-access
    await user.click(screen.getByRole("dialog").parentElement as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(4);
  });

  it("locks the page's scroll while it is open", async () => {
    server.use(...dataExportHandlers());
    const { unmount } = render(<DataExportDialog sessionContext={sessionContext} apiUrl={apiUrl} onClose={vi.fn()} />);
    expect(document.body).toHaveStyle({ overflow: "hidden" });
    await requestButton();
    unmount();
    expect(document.body).not.toHaveStyle({ overflow: "hidden" });
  });
});
