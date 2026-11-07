/** Plain links to the console's own pages, which open in place instead of loading the whole console again. */
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { dashboardHandlers } from "@smarter/dashboard/mocks";
import { listHandlers } from "@smarter/guardrail-list/mocks";

import { server } from "@test/server";

import App from "@/App";
import { consolePath } from "@/lib/inPlaceLinks";
import { userSession } from "@/mocks/fixtures";
import { sessionHandler } from "@/mocks/handlers";
import { routes } from "@/router";

const ORIGIN = "http://localhost:9357";

describe("consolePath()", () => {
  it("returns the path of a link to one of the console's pages, with its query and fragment", () => {
    expect(consolePath(`${ORIGIN}/guardrail`, routes, ORIGIN)).toBe("/guardrail");
    expect(consolePath(`${ORIGIN}/workbench/llm-clients/abc/prompt/?tab=chat#top`, routes, ORIGIN)).toBe(
      "/workbench/llm-clients/abc/prompt/?tab=chat#top",
    );
    expect(consolePath("/budget/budgets/abc/", routes, ORIGIN)).toBe("/budget/budgets/abc/");
  });

  it("leaves the backend's paths to the browser: the console's catch-all is its not found page", () => {
    expect(consolePath(`${ORIGIN}/admin/`, routes, ORIGIN)).toBeNull();
    expect(consolePath(`${ORIGIN}/api/v1/openapi.json`, routes, ORIGIN)).toBeNull();
    expect(consolePath(`${ORIGIN}/static/images/logo/favicon.ico`, routes, ORIGIN)).toBeNull();
  });

  it("leaves other origins, and urls that aren't web pages, to the browser", () => {
    expect(consolePath("https://docs.smarter.sh/guardrail", routes, ORIGIN)).toBeNull();
    expect(consolePath("http://localhost:5173/guardrail", routes, ORIGIN)).toBeNull();
    expect(consolePath("mailto:someone@example.com", routes, ORIGIN)).toBeNull();
  });
});

describe("a plain link in the console", () => {
  let link: HTMLAnchorElement;

  beforeEach(() => {
    server.use(...dashboardHandlers, ...listHandlers(), sessionHandler(userSession));
    // a package's plain link, as a list's manifest link is.
    link = document.createElement("a");
    link.textContent = "a plain link";
    document.body.appendChild(link);
  });

  afterEach(() => {
    link.remove();
  });

  async function mount() {
    const router = createMemoryRouter(routes, { initialEntries: ["/dashboard"] });
    render(<App router={router} />);
    await screen.findByRole("navigation", { name: "Main" });
    return router;
  }

  it("opens a console page in place", async () => {
    const router = await mount();
    link.href = "/guardrail";
    const followed = fireEvent.click(link);
    expect(followed).toBe(false);
    // the list's route loads its package first, then the router commits the location, in the same frame.
    expect(await screen.findByRole("row", { name: /first_example/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/guardrail");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("leaves a backend path to the browser", async () => {
    const router = await mount();
    link.href = "/admin/";
    const followed = fireEvent.click(link);
    expect(followed).toBe(true);
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("leaves a new tab, a download, and a click with a modifier key to the browser", async () => {
    const router = await mount();
    link.href = "/guardrail";
    expect(fireEvent.click(link, { metaKey: true })).toBe(true);
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    link.target = "_blank";
    expect(fireEvent.click(link)).toBe(true);
    link.removeAttribute("target");
    link.setAttribute("download", "");
    expect(fireEvent.click(link)).toBe(true);
    expect(router.state.location.pathname).toBe("/dashboard");
  });

  it("leaves a click that a component already handled", async () => {
    const router = await mount();
    link.href = "/guardrail";
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(router.state.location.pathname).toBe("/dashboard");
  });
});
