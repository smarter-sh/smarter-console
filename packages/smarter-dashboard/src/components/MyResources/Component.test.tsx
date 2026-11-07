import { createSmarterQueryClient } from "@smarter/common";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { appContext, myResources } from "@/mocks/fixtures";
import { server } from "@test/server";

import MyResources from "@/components/MyResources/Component";

const apiUrl = appContext.myResourcesApiUrl;
const sessionContext = appContext.sessionContext;

describe("MyResources", () => {
  it("shows its tiles' and its grid's skeletons while the counts load", () => {
    server.use(http.post(apiUrl, () => new Promise<Response>(() => {})));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    const region = screen.getByRole("region", { name: "My Resources" });
    expect(region).toHaveAttribute("aria-busy", "true");
    // the tiles' labels show; their counts, and the grid's items, are skeletons, which screen readers skip.
    expect(within(region).getByText("LLM Clients")).toBeInTheDocument();
    expect(within(region).queryByRole("list", { name: "More resources" })).not.toBeInTheDocument();
    expect(within(region).queryByText(/pending/)).not.toBeInTheDocument();
  });

  it("links pending deployments to the unfiltered list from an api without a pending link", async () => {
    const { pending_deployments_url: _, ...older } = myResources;
    server.use(http.post(apiUrl, () => HttpResponse.json(older)));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByRole("link", { name: "2 pending" })).toHaveAttribute("href", older.llmclients_url);
  });

  it("counts a single pending deployment", async () => {
    server.use(http.post(apiUrl, () => HttpResponse.json({ ...myResources, pending_deployments: 1 })));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByRole("link", { name: "1 pending" })).toHaveAttribute(
      "href",
      "/workbench/?filter=pending",
    );
    expect(screen.getByText(/^\s*deployment$/)).toBeInTheDocument();
  });

  it("counts your MCPClients, and links to their list", async () => {
    server.use(http.post(apiUrl, () => HttpResponse.json(myResources)));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    const link = await screen.findByRole("link", { name: /MCPClients/ });
    expect(link).toHaveAttribute("href", myResources.mcpclients_url);
    expect(link).toHaveTextContent(String(myResources.mcpclients_qty));
    expect(screen.queryByText("Connections")).not.toBeInTheDocument();
  });

  it("counts the other kinds in a compact grid, each linked to its list", async () => {
    server.use(http.post(apiUrl, () => HttpResponse.json(myResources)));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    const more = await screen.findByRole("list", { name: "More resources" });
    const guardrails = within(more).getByRole("link", { name: /Guardrails/ });
    expect(guardrails).toHaveAttribute("href", myResources.guardrails_url);
    expect(guardrails).toHaveTextContent(String(myResources.guardrails_qty));
    expect(within(more).getAllByRole("link")).toHaveLength(6);
    expect(within(more).getByRole("link", { name: /Extensions/ })).toHaveAttribute("target", "_blank");
  });

  it("hides a kind that the platform has turned off", async () => {
    server.use(http.post(apiUrl, () => HttpResponse.json({ ...myResources, vectorstores_url: null })));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    const more = await screen.findByRole("list", { name: "More resources" });
    expect(within(more).queryByRole("link", { name: /VectorStores/ })).not.toBeInTheDocument();
    expect(within(more).getAllByRole("link")).toHaveLength(5);
  });

  it("counts nothing for a response without counts", async () => {
    server.use(http.post(apiUrl, () => HttpResponse.json({})));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    await vi.waitFor(() => expect(screen.queryByText(/pending/)).not.toBeInTheDocument());
    expect(screen.getByRole("region", { name: "My Resources" })).toBeInTheDocument();
  });

  it("shows why the resources failed to load", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(apiUrl, () => new HttpResponse(null, { status: 503 })));
    render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    expect(await screen.findByText("Failed to load resources: Request failed: 503")).toBeInTheDocument();
  });

  it("stops loading when it unmounts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let signal: AbortSignal | null = null;
    server.use(
      http.post(apiUrl, async ({ request }) => {
        signal = request.signal;
        await delay("infinite");
        return HttpResponse.json(myResources);
      }),
    );
    const { unmount } = render(<MyResources sessionContext={sessionContext} apiUrl={apiUrl} />);
    await vi.waitFor(() => expect(signal).not.toBeNull());
    unmount();
    await vi.waitFor(() => expect(signal?.aborted).toBe(true));
  });

  it("shows its counts at once when the dashboard opens again, from the console's cache", async () => {
    let requests = 0;
    server.use(
      http.post(apiUrl, () => {
        requests += 1;
        return HttpResponse.json(myResources);
      }),
    );
    const client = createSmarterQueryClient();
    const widget = (
      <QueryClientProvider client={client}>
        <MyResources sessionContext={sessionContext} apiUrl={apiUrl} />
      </QueryClientProvider>
    );
    const view = render(widget);
    expect(await screen.findByRole("link", { name: "2 pending" })).toBeInTheDocument();
    view.unmount();
    render(widget);
    expect(screen.getByRole("link", { name: "2 pending" })).toBeInTheDocument();
    // and asks again behind it, for what changed since.
    await vi.waitFor(() => expect(requests).toBe(2));
  });
});
