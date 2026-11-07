/** The page of a route that failed, in place of React Router's bare default page. */
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, data, RouterProvider, type RouteObject } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RouteError } from "@/routes/RouteError";

// the reload itself: jsdom can't load a page again.
const { reloadOnce } = vi.hoisted(() => ({ reloadOnce: vi.fn(() => true) }));
vi.mock("@/lib/staleRelease", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/staleRelease")>()),
  reloadOnce,
}));

afterEach(() => {
  reloadOnce.mockClear();
});

/** Mounts a route that fails as the page does, under RouteError. */
function mount(route: Omit<RouteObject, "path" | "children" | "index">) {
  const routes: RouteObject[] = [{ errorElement: <RouteError />, children: [{ path: "/", ...route } as RouteObject] }];
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: ["/"] })} />);
}

function Broken(): never {
  throw new Error("Cannot read properties of undefined");
}

describe("RouteError", () => {
  it("says that something went wrong, and offers to reload or return home", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mount({ element: <Broken /> });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Something went wrong.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return Home" })).toHaveAttribute("href", "/");
    expect(reloadOnce).not.toHaveBeenCalled();
  });

  it("is the not found page for a route that answered 404", async () => {
    mount({
      loader: () => {
        throw data(null, { status: 404 });
      },
      element: <p>never</p>,
    });
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("loads the console's new release when a page's code can't load", async () => {
    mount({
      lazy: async () => {
        throw new TypeError("Failed to fetch dynamically imported module: /static/react/assets/Page-abc123.js");
      },
    });
    expect(await screen.findByRole("status")).toHaveTextContent("Loading...");
    expect(reloadOnce).toHaveBeenCalledOnce();
  });

  it("says that something went wrong when the console just reloaded for that, rather than reload again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reloadOnce.mockReturnValueOnce(false);
    mount({
      lazy: async () => {
        throw new TypeError("Failed to fetch dynamically imported module: /static/react/assets/Page-abc123.js");
      },
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});
