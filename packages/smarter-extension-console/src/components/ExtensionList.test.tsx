import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import ExtensionList from "@/components/ExtensionList";
import {
  action,
  API_URL,
  disabledRegistry,
  listContext,
  listResponse,
  makeRegistryExtension,
  readOnlyListContext,
  registryResponse,
} from "@/mocks/fixtures";
import { errorHandlers, listHandlers } from "@/mocks/handlers";
import { server } from "@test/server";

describe("ExtensionList", () => {
  it("shows its table, with skeleton rows, while the extensions load", async () => {
    server.use(http.all("*", () => new Promise<Response>(() => {})));
    render(<ExtensionList context={listContext} />);
    expect(await screen.findAllByText("Loading...")).toHaveLength(1);
    expect(screen.getByRole("columnheader", { name: "Extension" })).toBeInTheDocument();
  });

  it("lists the installed extensions, with their versions, badges and errors", async () => {
    server.use(...listHandlers());
    render(<ExtensionList context={listContext} />);
    const row = await screen.findByRole("row", { name: /Weather/ });
    expect(within(row).getByRole("link", { name: "Weather" })).toHaveAttribute("href", "/extensions/weather/");
    expect(within(row).getByText("0.2.0 available")).toBeInTheDocument();
    expect(within(row).getByText("Official Smarter Extension")).toBeInTheDocument();
    expect(screen.getByLabelText("Error")).toHaveAttribute("title", expect.stringContaining("post_install failed"));
    expect(screen.getByLabelText("Enable Acme CRM")).not.toBeChecked();
  });

  it("enables and disables an extension, and reports it", async () => {
    server.use(...listHandlers());
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    await user.click(await screen.findByLabelText("Enable Weather"));
    expect(await screen.findByText("Disabled.")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Enable Acme CRM"));
    expect(await screen.findByText("Enabled.")).toBeInTheDocument();
  });

  it("is read-only for a user who is not a superuser", async () => {
    server.use(...listHandlers());
    const user = userEvent.setup();
    render(<ExtensionList context={readOnlyListContext} />);
    await screen.findByRole("row", { name: /Weather/ });
    expect(screen.getByLabelText("Enable Weather")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /Upload extension/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Check for updates/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    expect(await screen.findByRole("article", { name: "Weather" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Install|Update to)/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refresh" })).not.toBeInTheDocument();
  });

  it("checks the registry for updates", async () => {
    server.use(...listHandlers());
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    await screen.findByRole("row", { name: /Weather/ });
    await user.click(screen.getByRole("button", { name: /Check for updates/ }));
    expect(await screen.findByText("Updates are available: Weather 0.2.0.")).toBeInTheDocument();
  });

  it("browses, filters and installs from the registry", async () => {
    server.use(...listHandlers());
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} navigate={navigate} />);
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));

    expect(await screen.findByRole("article", { name: "Weather" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Update to 0.2.0" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Installed (0.1.0)" })).toHaveAttribute("href", "/extensions/calculator/");
    expect(screen.getByText("Not compatible with this version of Smarter")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Search extensions"), "date");
    expect(screen.queryByRole("article", { name: "Weather" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Install 0.1.0" }));
    expect(navigate).toHaveBeenCalledWith("/extensions/date-calculator/");

    await user.clear(screen.getByLabelText("Search extensions"));
    await user.selectOptions(screen.getByLabelText("Publisher"), "community");
    expect(screen.getByRole("article", { name: "Stock Quotes" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Weather" })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Search extensions"), "nothing");
    expect(screen.getByText("No extensions match.")).toBeInTheDocument();
  });

  it("shows a registry extension's details, and installs a chosen version", async () => {
    server.use(...listHandlers());
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} navigate={navigate} />);
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    const card = await screen.findByRole("article", { name: "Weather" });
    await user.click(within(card).getByRole("button", { name: "Details" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Current weather, from Open-Meteo.")).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByLabelText("Version"), "0.1.0");
    await user.click(within(dialog).getByRole("button", { name: "Install this version" }));
    expect(navigate).toHaveBeenCalledWith("/extensions/weather/");
  });

  it("uploads an archive, and opens its page", async () => {
    server.use(...listHandlers());
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} navigate={navigate} />);
    await screen.findByRole("row", { name: /Weather/ });
    await user.upload(screen.getByLabelText("Extension archive"), new File(["zip"], "acme-crm-1.0.0.zip"));
    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith("/extensions/acme-crm/"));
  });

  it("shows why an upload or an install failed", async () => {
    // the first handler that matches answers, so the failures come before the list's handlers.
    server.use(
      http.post(`${API_URL}upload/`, () =>
        HttpResponse.json({ error: "the archive is not a zip file" }, { status: 400 }),
      ),
      http.post(`${API_URL}install/`, () =>
        HttpResponse.json({ error: "the archive's sha256 is wrong" }, { status: 400 }),
      ),
      ...listHandlers(),
    );
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    await screen.findByRole("row", { name: /Weather/ });
    await user.upload(screen.getByLabelText("Extension archive"), new File(["x"], "x.zip"));
    expect(await screen.findByText("the archive is not a zip file")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    await user.click(await screen.findByRole("button", { name: "Update to 0.2.0" }));
    expect(await screen.findByText("the archive's sha256 is wrong")).toBeInTheDocument();
  });

  it("says when nothing is installed, and why the registry can't be browsed", async () => {
    server.use(...listHandlers({ ...listResponse, objects: [], registryEnabled: false }, disabledRegistry));
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    expect(await screen.findByText(/No extensions are installed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Check for updates/ })).toBeDisabled();
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    expect(await screen.findByText(/SMARTER_EXTENSION_REGISTRY_PUBLIC_KEY/)).toBeInTheDocument();
  });

  it("refreshes the registry, and shows an extension that was installed from an archive", async () => {
    let refreshes = 0;
    server.use(
      http.post(`${API_URL}registry/`, async ({ request }) => {
        if (((await request.json()) as { refresh?: boolean }).refresh) refreshes += 1;
        return HttpResponse.json({
          ...registryResponse,
          objects: [
            makeRegistryExtension({ slug: "acme-crm", displayName: "Acme CRM", license: "", action: "uploaded" }),
          ],
        });
      }),
      ...listHandlers(),
    );
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    const card = await screen.findByRole("article", { name: "Acme CRM" });
    expect(within(card).getByText("Installed from an uploaded archive")).toBeInTheDocument();
    expect(within(card).queryByText(/AGPL/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Refresh" })).toBeEnabled());
    expect(refreshes).toBe(1);

    // an uploaded extension's details can't install it from the registry.
    await user.click(within(card).getByRole("button", { name: "Details" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByLabelText("Version")).not.toBeInTheDocument();
    await user.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("installs a registry extension's newest version from its details, and opens the list", async () => {
    server.use(
      http.post(`${API_URL}install/`, () => HttpResponse.json(action("Installed.", null))),
      http.post(`${API_URL}registry/`, () =>
        HttpResponse.json({
          ...registryResponse,
          objects: [
            makeRegistryExtension({
              slug: "date-calculator",
              displayName: "Date Calculator",
              license: "",
              homepage: null,
              installedVersion: null,
              action: "install",
              detailUrl: null,
            }),
          ],
        }),
      ),
      ...listHandlers(),
    );
    const user = userEvent.setup();
    // a fragment's url, which jsdom can navigate to, with the default navigate.
    render(<ExtensionList context={{ ...listContext, listUrl: "#extensions" }} />);
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    const card = await screen.findByRole("article", { name: "Date Calculator" });
    await user.click(within(card).getByRole("button", { name: "Details" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByRole("link", { name: "homepage" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/AGPL/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Install" }));
    await waitFor(() => expect(window.location.hash).toBe("#extensions"));
    window.location.hash = "";
  });

  it("opens the list after an upload that returns no extension, and ignores an empty choice", async () => {
    server.use(
      http.post(`${API_URL}upload/`, () => HttpResponse.json(action("Uploaded.", null))),
      ...listHandlers(),
    );
    const navigate = vi.fn();
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} navigate={navigate} />);
    await screen.findByRole("row", { name: /Weather/ });
    const input = screen.getByLabelText<HTMLInputElement>("Extension archive");
    const click = vi.spyOn(input, "click");
    await user.click(screen.getByRole("button", { name: /Upload extension/ }));
    expect(click).toHaveBeenCalled();
    // the file dialog was closed without a choice: an unhandled upload request would fail the test.
    fireEvent.change(input, { target: { files: [] } });
    expect(navigate).not.toHaveBeenCalled();
    await user.upload(input, new File(["zip"], "acme-crm-1.0.0.zip"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/extensions/"));
  });

  it("says only that nothing is installed, to a user who is not a superuser", async () => {
    server.use(...listHandlers({ ...listResponse, objects: [] }));
    render(<ExtensionList context={readOnlyListContext} />);
    expect(await screen.findByText("No extensions are installed.")).toBeInTheDocument();
  });

  it("shows the api's error", async () => {
    server.use(...errorHandlers);
    const user = userEvent.setup();
    render(<ExtensionList context={listContext} />);
    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Browse the registry" }));
    await user.click(screen.getByRole("tab", { name: "Installed" }));
    expect(screen.getAllByText("Database unavailable").length).toBeGreaterThan(0);
  });
});
