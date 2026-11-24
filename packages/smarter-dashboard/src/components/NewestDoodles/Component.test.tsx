import { render, screen, waitFor, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { appContext, newestDoodles, sessionContext } from "@/mocks/fixtures";
import { newestDoodlesHandler } from "@/mocks/handlers";
import { server } from "@test/server";

import NewestDoodles from "@/components/NewestDoodles/Component";

const apiUrl = appContext.newestDoodlesApiUrl;
const [revolutionDay, independenceDay] = newestDoodles.doodles;

function renderNewestDoodles() {
  return render(<NewestDoodles sessionContext={sessionContext} apiUrl={apiUrl} />);
}

describe("NewestDoodles", () => {
  it("renders nothing while the doodles load", () => {
    server.use(http.post(apiUrl, () => new Promise<Response>(() => {})));
    const { container } = renderNewestDoodles();
    expect(container).toBeEmptyDOMElement();
  });

  it("lists the newest doodles, each with its title, caption, region and date", async () => {
    server.use(newestDoodlesHandler);
    renderNewestDoodles();
    const region = await screen.findByRole("region", { name: "Newest Doodles" });
    const items = within(region).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Revolution Day");
    expect(items[0]).toHaveTextContent("Happy Revolution Day!");
    expect(items[0]).toHaveTextContent("Mexico · Nov 19, 2026");
    expect(within(items[0]).getByText("Nov 19, 2026")).toHaveAttribute("datetime", "2026-11-19");
    expect(items[1]).toHaveTextContent("Independence Day");
    expect(items[1]).toHaveTextContent("Poland · Nov 11, 2026");
  });

  it("links each thumbnail and title to the doodle's page, in the same tab", async () => {
    server.use(newestDoodlesHandler);
    renderNewestDoodles();
    const image = await screen.findByRole("img", { name: revolutionDay.altText });
    expect(image).toHaveAttribute("src", revolutionDay.imageUrl);
    for (const name of [revolutionDay.altText, "Revolution Day"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href", "/doodles/2026-11-19/mx/");
      expect(link).not.toHaveAttribute("target");
    }
    expect(screen.getByRole("link", { name: independenceDay.altText })).toHaveAttribute(
      "href",
      "/doodles/2026-11-11/pl/",
    );
    expect(screen.getByRole("link", { name: "Independence Day" })).toHaveAttribute("href", "/doodles/2026-11-11/pl/");
  });

  it("links a caption only when the doodle has a link", async () => {
    server.use(
      http.post(apiUrl, () =>
        HttpResponse.json({
          doodles: [revolutionDay, { ...independenceDay, caption: "Happy Independence Day!" }],
        }),
      ),
    );
    renderNewestDoodles();
    const caption = await screen.findByRole("link", { name: "Happy Revolution Day!" });
    expect(caption).toHaveAttribute("href", revolutionDay.linkUrl);
    expect(caption).toHaveAttribute("target", "_blank");
    expect(caption).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Happy Independence Day!")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Happy Independence Day!" })).not.toBeInTheDocument();
    // two thumbnails and two titles, which link to the doodles' pages, and one caption link.
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("renders nothing on a platform without the artist", async () => {
    let answered = false;
    server.use(
      http.post(apiUrl, () => {
        answered = true;
        return HttpResponse.json({ doodles: [] });
      }),
    );
    const { container } = renderNewestDoodles();
    await waitFor(() => expect(answered).toBe(true));
    // give the response a moment to render, then check that nothing did.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole("region", { name: "Newest Doodles" })).not.toBeInTheDocument();
  });

  it("shows the error of a failed request", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(apiUrl, () => HttpResponse.json({ error: "Service unavailable" }, { status: 503 })));
    renderNewestDoodles();
    const region = await screen.findByRole("region", { name: "Newest Doodles" });
    await waitFor(() => expect(region).toHaveTextContent("Failed to load the newest doodles: Request failed: 503"));
  });
});
