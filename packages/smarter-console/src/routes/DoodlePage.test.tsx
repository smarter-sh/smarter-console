/** The page of one doodle, which the dashboard's Newest Doodles link to, driven through the console's router. */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { createMemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { dashboardHandlers } from "@smarter/dashboard/mocks";

import { server } from "@test/server";

import App from "@/App";
import { visitorSession } from "@/mocks/fixtures";
import {
  doodleByDayHandler,
  drawnDoodle,
  sessionHandler,
  userSessionHandler,
  visitorSessionHandler,
} from "@/mocks/handlers";
import { routes } from "@/router";

const DOODLE_PATH = "/doodles/2026-11-19/mx/";

// a signed-in user's dashboard calls the dashboard api.
beforeEach(() => {
  server.use(...dashboardHandlers);
});

function mountAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<App router={router} />);
  return router;
}

/** Count the requests for each doodle url, and answer them as doodleByDayHandler does. */
function countDoodleRequests() {
  const requested: string[] = [];
  server.use(
    http.get("/api/v1/doodles/:date/:region/", ({ request }) => {
      requested.push(new URL(request.url).pathname);
      return undefined;
    }),
    doodleByDayHandler,
  );
  return requested;
}

describe("the doodle page", () => {
  it("looks like the sign-in page: its title and form, as an inert mockup", async () => {
    server.use(visitorSessionHandler, doodleByDayHandler);
    mountAt(DOODLE_PATH);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign In" })).toBeInTheDocument();
    const preview = screen.getByTestId("sign-in-preview");
    expect(preview).toHaveAttribute("inert");
    expect(preview).toHaveAttribute("aria-hidden", "true");
    expect(within(preview).getByLabelText("Email")).toHaveValue("");
    expect(within(preview).getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(within(preview).getByRole("button", { name: "Sign In", hidden: true })).toBeInTheDocument();
    // nothing else is written where the sign-in form is.
    expect(screen.queryByText("Back to the dashboard")).not.toBeInTheDocument();
    expect(screen.queryByText("Nov 19, 2026")).not.toBeInTheDocument();
  });

  it("shows that doodle in the sign-in page's doodle panel, even while the doodle switch is off", async () => {
    server.use(visitorSessionHandler);
    const requested = countDoodleRequests();
    mountAt(DOODLE_PATH);
    expect(await screen.findByRole("img", { name: drawnDoodle.altText })).toBeInTheDocument();
    expect(screen.getByTestId("smarter-doodle-figure")).toHaveAttribute("data-theme", drawnDoodle.theme);
    expect(screen.getByTestId("smarter-doodle-ai-credit")).toHaveTextContent("Drawn by a Smarter AI application.");
    // the panel asks for this doodle, never the doodle of the day.
    await waitFor(() => expect(requested).toHaveLength(1));
    expect(requested).toEqual(["/api/v1/doodles/2026-11-19/mx/"]);
  });

  it("shows a signed-in user the same mockup", async () => {
    server.use(userSessionHandler, doodleByDayHandler);
    mountAt(DOODLE_PATH);
    expect(await screen.findByRole("heading", { level: 1, name: "Sign In" })).toBeInTheDocument();
    expect(screen.getByTestId("sign-in-preview")).toHaveAttribute("inert");
  });

  it("shows the base scene for a doodle that the api doesn't find", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(sessionHandler({ ...visitorSession, signIn: { ...visitorSession.signIn, doodle: true } }));
    server.use(doodleByDayHandler);
    mountAt("/doodles/2026-11-20/mx/");
    expect(await screen.findByRole("heading", { level: 1, name: "Sign In" })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByTestId("smarter-doodle-image")).toHaveAttribute("src", "/static/doodle/base.svg"),
    );
    expect(screen.getByTestId("smarter-doodle-figure")).toHaveAttribute("data-theme", "default");
  });

  it("is opened in place from the dashboard's Newest Doodles", async () => {
    server.use(userSessionHandler, doodleByDayHandler);
    const router = mountAt("/dashboard");
    const doodles = await screen.findByRole("region", { name: "Newest Doodles" });
    await userEvent.setup().click(within(doodles).getByRole("link", { name: "Revolution Day" }));
    await waitFor(() => expect(router.state.location.pathname).toBe(DOODLE_PATH));
    expect(await screen.findByTestId("sign-in-preview")).toBeInTheDocument();
  });
});
