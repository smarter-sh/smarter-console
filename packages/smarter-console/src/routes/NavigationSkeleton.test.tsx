/**
 * A navigation to a page whose code is loading shows that page's skeleton in the frame, and the splash waits for the
 * router's first page.
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { dashboardHandlers } from "@smarter/dashboard/mocks";

import { server } from "@test/server";

import App from "@/App";
import { userSessionHandler } from "@/mocks/handlers";
import { routes } from "@/router";

// the tool pages' code never arrives, as on a very slow network.
vi.mock("@/routes/ToolPages", () => new Promise(() => {}));

// whether the splash was told that the console is ready.
const { splashAppReady } = vi.hoisted(() => ({ splashAppReady: vi.fn() }));
vi.mock("@/lib/splash", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/splash")>()),
  splashAppReady,
}));

describe("a navigation to a page whose code is loading", () => {
  it("shows the page's skeleton in the frame, after a moment, and lets the splash go once the first page is ready", async () => {
    server.use(userSessionHandler, ...dashboardHandlers);
    const router = createMemoryRouter(routes, { initialEntries: ["/dashboard"] });
    render(<App router={router} />);
    const sidebar = within(await screen.findByRole("navigation", { name: "Main" }));
    expect(await screen.findByRole("region", { name: "My Resources" })).toBeInTheDocument();
    await waitFor(() => expect(splashAppReady).toHaveBeenCalled());

    await userEvent.setup().click(sidebar.getByRole("link", { name: "Apply Manifest" }));
    // the page's skeleton, in the frame, in place of the dashboard.
    const skeleton = await screen.findByRole("status", { name: "Loading" });
    expect(skeleton).toHaveClass("smarter-page-skeleton");
    expect(screen.queryByRole("region", { name: "My Resources" })).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(router.state.navigation.state).toBe("loading");
  });
});
