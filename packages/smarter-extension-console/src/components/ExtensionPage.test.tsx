import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import ExtensionPage from "@/components/ExtensionPage";
import type { ExtensionDetail } from "@/lib/types";
import {
  accounts,
  API_URL,
  brokenDetail,
  detailContext,
  disabledDetail,
  makeDetail,
  readOnlyDetailContext,
} from "@/mocks/fixtures";
import { detailHandlers, errorHandlers } from "@/mocks/handlers";
import { server } from "@test/server";

function renderPage(props: Partial<Parameters<typeof ExtensionPage>[0]> = {}) {
  return render(<ExtensionPage context={detailContext} slug="weather" {...props} />);
}

describe("ExtensionPage", () => {
  it("shows the page's shape while the extension loads", () => {
    // the requests never answer, as on a very slow network.
    server.use(http.all("*", () => new Promise<Response>(() => {})));
    renderPage();
    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the extension, its documentation and its update", async () => {
    server.use(...detailHandlers());
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Weather" })).toBeInTheDocument();
    expect(screen.getByText("Version 0.1.0")).toBeInTheDocument();
    expect(screen.getByText("Current weather, from Open-Meteo.")).toBeInTheDocument();
    expect(screen.getByText(/Version 0.2.0 of Weather is available/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Extensions/ })).toHaveAttribute("href", "/extensions/");
  });

  it("updates, disables and enables the extension", async () => {
    server.use(...detailHandlers());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }));
    expect(await screen.findByText("Updated Weather to 0.2.0.")).toBeInTheDocument();
    expect(screen.getByText("Version 0.2.0")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disable" }));
    expect(await screen.findByText("Disabled Weather.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enable" }));
    expect(await screen.findByText("Enabled Weather.")).toBeInTheDocument();
  });

  it("is read-only for a user who is not a superuser", async () => {
    server.use(...detailHandlers());
    renderPage({ context: readOnlyDetailContext });
    expect(await screen.findByRole("heading", { level: 1, name: "Weather" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Enable|Disable|Update to|Uninstall)/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/is available. You have/)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Settings" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Availability" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tools" })).toBeInTheDocument();
  });

  it("can't be enabled until its required settings are configured", async () => {
    server.use(...detailHandlers(disabledDetail));
    renderPage();
    expect(await screen.findByRole("button", { name: "Enable" })).toBeDisabled();
    expect(screen.getByText(/Configure google_maps_api_key on the Settings tab/)).toBeInTheDocument();
  });

  it("shows its tools, as the LLM sees them", async () => {
    server.use(...detailHandlers());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Tools" }));
    expect(screen.getByText("ext_weather_get_weather")).toBeInTheDocument();
    expect(screen.getByText(/"location"/)).toBeInTheDocument();
  });

  it("explains an extension whose code doesn't load", async () => {
    server.use(...detailHandlers(brokenDetail));
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/The extension's code does not load/)).toBeInTheDocument();
    expect(screen.getByText(/post_install failed/)).toBeInTheDocument();
    expect(screen.getByText("This extension has no documentation.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tools" }));
    expect(screen.getByText("The tools can't be listed.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Resources" }));
    expect(screen.getByText("This extension has no waffle switches.")).toBeInTheDocument();
    expect(screen.getByText("This extension has created no resources.")).toBeInTheDocument();
  });

  it("saves its settings", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}:slug/configure/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ message: "Saved the settings of Weather.", extension: makeDetail() });
      }),
      ...detailHandlers(),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Settings" }));
    await user.clear(screen.getByLabelText(/retries/));
    await user.type(screen.getByLabelText(/retries/), "5");
    await user.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByText("Saved the settings of Weather.")).toBeInTheDocument();
    expect(body).toEqual({ values: { retries: 5 }, secrets: {} });
  });

  it("restricts it to some accounts", async () => {
    let body: unknown;
    server.use(
      http.post(`${API_URL}:slug/availability/`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          message: "Available to 1 account(s).",
          extension: makeDetail({ allAccounts: false }),
        });
      }),
      ...detailHandlers(),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Availability" }));
    await user.click(screen.getByLabelText("Only these accounts may use it"));
    await user.type(await screen.findByLabelText("Filter accounts"), "acme");
    expect(screen.queryByLabelText(/3141-5926-5359/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/2718-2818-2845/));
    expect(screen.getByText("1 selected.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save availability" }));
    expect(await screen.findByText("Available to 1 account(s).")).toBeInTheDocument();
    expect(body).toEqual({ allAccounts: false, accountIds: [2] });
  });

  it("shows why the accounts can't be listed", async () => {
    server.use(
      http.post(`${API_URL}accounts/`, () => HttpResponse.json({ error: "No accounts for you" }, { status: 500 })),
      ...detailHandlers(),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Availability" }));
    await user.click(screen.getByLabelText("Only these accounts may use it"));
    expect(await screen.findByText("No accounts for you")).toBeInTheDocument();
  });

  it("rolls back to an earlier version, after confirming", async () => {
    server.use(...detailHandlers());
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    renderPage({ confirm });
    await user.click(await screen.findByRole("tab", { name: "Versions" }));
    expect(within(screen.getByRole("row", { name: /0.1.0/ })).getByText("Running")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roll back to 0.0.9" }));
    expect(screen.queryByText(/Rolled Weather back/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roll back to 0.0.9" }));
    expect(await screen.findByText("Rolled Weather back to 0.0.9.")).toBeInTheDocument();
  });

  it("lists its switches and resources", async () => {
    server.use(...detailHandlers());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Resources" }));
    expect(screen.getByText("ext_weather_verbose")).toBeInTheDocument();
    expect(screen.getByText("weather_example")).toBeInTheDocument();
  });

  it("uninstalls it, after confirming, and returns to the list", async () => {
    server.use(...detailHandlers());
    const navigate = vi.fn();
    const confirm = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    renderPage({ navigate, confirm });
    await user.click(await screen.findByRole("button", { name: "Uninstall Weather" }));
    expect(navigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Uninstall Weather" }));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/extensions/"));
  });

  it("shows why an action failed", async () => {
    server.use(
      http.post(`${API_URL}:slug/disable/`, () => HttpResponse.json({ error: "on_disable refused" }, { status: 400 })),
      ...detailHandlers(),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    expect(await screen.findByText("on_disable refused")).toBeInTheDocument();
  });

  it("shows why the extension can't be loaded", async () => {
    server.use(...errorHandlers);
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Extensions" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Database unavailable")).not.toBeInTheDocument();
  });

  it("dismisses an action's message", async () => {
    server.use(...detailHandlers());
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Disable" }));
    expect(await screen.findByText("Disabled Weather.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Disabled Weather.")).not.toBeInTheDocument();
  });

  it("shows what is unknown about an uploaded extension", async () => {
    server.use(
      ...detailHandlers(
        makeDetail({
          installedVersion: null,
          publisher: "",
          source: "upload",
          // a badge that this console doesn't know yet, as from a newer backend.
          trustBadge: "experimental" as ExtensionDetail["trustBadge"],
          trustBadgeLabel: "Experimental",
          license: "",
          homepage: "",
          latestCheckedAt: null,
          updateAvailable: false,
          tools: [],
          switches: [{ name: "ext_weather_verbose", description: "Log the raw forecast.", active: true }],
          resources: [{ kind: "Secret", name: "weather_example", owner: "admin", version: "0.1.0", managed: false }],
          versions: [{ ...makeDetail().versions[1], createdAt: null }],
        }),
      ),
    );
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText("Not installed")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByText("Experimental")).toHaveClass("badge-light-secondary");
    expect(screen.getByText("An uploaded archive")).toBeInTheDocument();
    expect(screen.queryByText("License")).not.toBeInTheDocument();
    expect(screen.queryByText("Homepage")).not.toBeInTheDocument();
    expect(screen.queryByText("Updates checked")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Tools" }));
    expect(screen.getByText("This extension has no tools.")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Resources" }));
    expect(screen.getByText("On")).toBeInTheDocument();
    expect(screen.getByText(/, by a lifecycle hook/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Versions" }));
    expect(screen.getByRole("button", { name: "Roll back to 0.0.9" })).toBeInTheDocument();
  });

  it("changes the accounts it is restricted to, then makes it available to every account", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post(`${API_URL}accounts/`, () =>
        HttpResponse.json({ objects: [...accounts, { id: 3, accountNumber: "1414-2135-6237", companyName: "" }] }),
      ),
      http.post(`${API_URL}:slug/availability/`, async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ message: "Saved the availability.", extension: null });
      }),
      ...detailHandlers(makeDetail({ allAccounts: false, accounts: [accounts[0]] })),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: "Availability" }));
    expect(await screen.findByLabelText(/3141-5926-5359/)).toBeChecked();
    expect(screen.getByLabelText("1414-2135-6237")).not.toBeChecked();
    await user.click(screen.getByLabelText(/3141-5926-5359/));
    expect(screen.getByText("0 selected.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save availability" }));
    expect(await screen.findByText("Saved the availability.")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Every account may use it"));
    expect(screen.queryByLabelText("Filter accounts")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save availability" }));
    await waitFor(() => expect(bodies).toHaveLength(2));
    expect(bodies).toEqual([
      { allAccounts: false, accountIds: [] },
      { allAccounts: true, accountIds: [] },
    ]);
  });

  it("stays on the page when uninstalling fails", async () => {
    server.use(
      http.post(`${API_URL}:slug/uninstall/`, () =>
        HttpResponse.json({ error: "pre_uninstall refused" }, { status: 400 }),
      ),
      ...detailHandlers(),
    );
    const navigate = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    renderPage({ navigate });
    await user.click(await screen.findByRole("button", { name: "Uninstall Weather" }));
    expect(await screen.findByText("pre_uninstall refused")).toBeInTheDocument();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Uninstall Weather?"));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("returns to the list, by default, once uninstalled", async () => {
    server.use(...detailHandlers());
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    // a fragment's url, which jsdom can navigate to.
    renderPage({ context: { ...detailContext, listUrl: "#extensions" } });
    await user.click(await screen.findByRole("button", { name: "Uninstall Weather" }));
    await waitFor(() => expect(window.location.hash).toBe("#extensions"));
    window.location.hash = "";
  });
});
