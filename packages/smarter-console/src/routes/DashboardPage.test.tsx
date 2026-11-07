/** The dashboard keeps its widgets' responses in the console's cache while the user visits other pages. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";

import { dashboardHandlers } from "@smarter/dashboard/mocks";
import { listHandlers } from "@smarter/guardrail-list/mocks";

import { server } from "@test/server";

import App from "@/App";
import { dashboardUrls } from "@/lib/dashboard";
import { userSessionHandler } from "@/mocks/handlers";
import { routes } from "@/router";

describe("the dashboard", () => {
  it("shows My Resources at once when the user comes back to it, without asking the api again", async () => {
    let requests = 0;
    const counts = { llmclients_qty: 3, pending_deployments: 2, llmclients_url: "/workbench/" };
    // the first matching handler wins: this one, rather than the dashboard's own.
    server.use(
      http.post(dashboardUrls.myResources, () => {
        requests += 1;
        return HttpResponse.json(counts);
      }),
      userSessionHandler,
      ...dashboardHandlers,
      ...listHandlers(),
    );
    const router = createMemoryRouter(routes, { initialEntries: ["/dashboard"] });
    render(<App router={router} />);
    expect(await screen.findByRole("link", { name: "2 pending" })).toBeInTheDocument();

    // to a list, in place, and back.
    const user = userEvent.setup();
    const sidebar = within(screen.getByRole("navigation", { name: "Main" }));
    await user.click(sidebar.getByRole("link", { name: "Guardrails" }));
    expect(await screen.findByRole("row", { name: /first_example/ })).toBeInTheDocument();
    await user.click(sidebar.getByRole("link", { name: "Dashboard" }));

    // from the cache, before any request could answer.
    expect(screen.getByRole("link", { name: "2 pending" })).toBeInTheDocument();
    expect(requests).toBe(1);
  });
});
