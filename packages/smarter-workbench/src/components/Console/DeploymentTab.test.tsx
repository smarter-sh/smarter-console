import { render, screen, waitFor } from "@testing-library/react";
import { http } from "msw";
import { describe, expect, it } from "vitest";

import DeploymentTab from "@/components/Console/DeploymentTab";
import { workbench } from "@/mocks/fixtures";
import { tabErrorHandlers, tabHandlers } from "@/mocks/handlers";
import { server } from "@test/server";

describe("DeploymentTab", () => {
  it("shows the page's shape while it loads", () => {
    // the requests never answer, as on a very slow network.
    server.use(http.all("*", () => new Promise<Response>(() => {})));
    render(<DeploymentTab workbench={workbench} />);
    expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
  });

  it("fetches the deployment page, and shows it in its workbench mode", async () => {
    server.use(...tabHandlers);
    render(<DeploymentTab workbench={workbench} />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { level: 1, name: "Deployed" })).toBeInTheDocument();
    // the workbench's own sections: the owner, and the api keys, which it manages with its session.
    expect(screen.getByRole("rowheader", { name: "Owner" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Choose its api key" })).toBeInTheDocument();
  });

  it("says why the page couldn't load", async () => {
    server.use(...tabErrorHandlers);
    render(<DeploymentTab workbench={workbench} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("The request failed: 404 Not Found");
  });

  it("requests the page's own url, without one of its own", async () => {
    const requested: string[] = [];
    server.use(
      http.get("*", ({ request }) => {
        requested.push(request.url);
        return new Promise<Response>(() => {});
      }),
    );
    render(<DeploymentTab workbench={{ ...workbench, deploymentUrl: null }} />);
    await waitFor(() => expect(requested).toEqual([window.location.href]));
  });
});
