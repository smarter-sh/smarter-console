/** A page of the console that fails shows the error page inside the console's frame, whose sidebar still works. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { dashboardHandlers } from "@smarter/dashboard/mocks";

import { server } from "@test/server";

import App from "@/App";
import { DROPZONE_PATH } from "@/lib/tools";
import { userSessionHandler } from "@/mocks/handlers";
import { routes } from "@/router";

// the Apply Manifest page fails as it renders.
vi.mock("@/routes/ToolPages", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/routes/ToolPages")>()),
  ApplyManifestPage: () => {
    throw new Error("Cannot read properties of undefined");
  },
}));

describe("a page of the console that fails", () => {
  it("shows the error page inside the frame, and the sidebar leaves it", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(userSessionHandler, ...dashboardHandlers);
    const router = createMemoryRouter(routes, { initialEntries: [DROPZONE_PATH] });
    render(<App router={router} />);

    expect(await screen.findByRole("heading", { name: "Something went wrong." })).toBeInTheDocument();
    const sidebar = within(screen.getByRole("navigation", { name: "Main" }));
    await userEvent.setup().click(sidebar.getByRole("link", { name: "Dashboard" }));
    expect(await screen.findByRole("region", { name: "My Resources" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Something went wrong." })).not.toBeInTheDocument();
  });
});
