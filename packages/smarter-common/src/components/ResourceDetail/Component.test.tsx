import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import type { DetailViewBaseProps, SessionContext } from "../../lib/Types";
import { exampleDetailUrl, ownedExamples, sessionContext } from "../../mocks/example";
import { detailHandler, exampleDetail } from "../../mocks/handlers";
import ResourceDetail, { type ResourceDetailProps } from "./Component";

/** A Details tab with a dialog of its own, e.g. a Toolbar's Rename. */
function DetailView(_: DetailViewBaseProps<unknown, SessionContext>) {
  return (
    <div role="dialog" aria-label="Rename">
      <input aria-label="New name" />
    </div>
  );
}

/** The detail api of the LLMClients that use the examples: see guardrailDependents. */
const llmclientDetailHandler = () =>
  http.post("/api/web/dashboard/resource/LLMClient/:locator/", () =>
    HttpResponse.json({ ...exampleDetail(22, "stackademy_sql", []), kind: "LLMClient" }),
  );

function renderDetail(props: Partial<ResourceDetailProps> = {}) {
  const onClose = vi.fn();
  const all: ResourceDetailProps = {
    sessionContext,
    object: ownedExamples[0],
    objectTypeName: "example",
    DetailView,
    onRequery: () => {},
    onClose,
    ...props,
  };
  const view = render(<ResourceDetail {...all} />);
  return { ...view, onClose, props: all };
}

describe("ResourceDetail", () => {
  it("calls an object without a name or a detail by its kind, with the Details tab only", () => {
    renderDetail({ object: null });
    expect(screen.getByRole("dialog", { name: "Example" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Details"]);
  });

  it("calls an object without a name by its slug", async () => {
    server.use(detailHandler());
    renderDetail({ object: { slug: "the_slug", detailUrl: exampleDetailUrl(1) } });
    expect(await screen.findByRole("dialog", { name: "the_slug" })).toBeInTheDocument();
    expect(await screen.findByText("Guardrail")).toBeInTheDocument();
  });

  it("calls an object that has only a detail by the detail's name, and goes back to it", async () => {
    server.use(detailHandler(), llmclientDetailHandler());
    const user = userEvent.setup();
    renderDetail({ object: { detailUrl: exampleDetailUrl(1) } });
    const dialog = within(await screen.findByRole("dialog", { name: "first_example" }));
    await user.click(dialog.getByRole("tab", { name: /Dependencies/ }));
    await user.click(await dialog.findByRole("button", { name: "stackademy_sql" }));
    // the object has no name of its own to go back to.
    const back = await screen.findByRole("button", { name: "Back to" });
    expect(back).toHaveAttribute("title", "Back to ");
    await user.click(back);
    expect(await screen.findByRole("dialog", { name: "first_example" })).toBeInTheDocument();
  });

  it("closes on Escape, unless another dialog has the key, and ignores other keys", async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    const { onClose } = renderDetail({ object: null, onPrevious });
    // a key of the Details tab's own dialog.
    await user.type(screen.getByRole("textbox", { name: "New name" }), "{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    // a key that isn't one of the dialog's.
    fireEvent.keyDown(window, { key: "a" });
    // a tab's key that isn't an arrow.
    fireEvent.keyDown(screen.getByRole("tab", { name: "Details" }), { key: "Enter" });
    expect(onClose).not.toHaveBeenCalled();
    expect(onPrevious).not.toHaveBeenCalled();
    // a key whose target isn't an element.
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click outside the dialog, but not inside it", async () => {
    const user = userEvent.setup();
    const { onClose } = renderDetail({ object: null });
    const dialog = screen.getByRole("dialog", { name: "Example" });
    await user.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    // eslint-disable-next-line testing-library/no-node-access -- the backdrop has no role.
    await user.click(dialog.parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a resource opened from a card on its Manifest tab, when its object is shown again on Details", async () => {
    server.use(detailHandler(), llmclientDetailHandler());
    const user = userEvent.setup();
    const { rerender, props } = renderDetail();
    let dialog = within(await screen.findByRole("dialog", { name: "first_example" }));
    await user.click(dialog.getByRole("tab", { name: /Dependencies/ }));
    await user.click(await dialog.findByRole("button", { name: "stackademy_sql" }));
    expect(await screen.findByRole("dialog", { name: "stackademy_sql" })).toBeInTheDocument();

    // another object, on its Details tab.
    rerender(<ResourceDetail {...props} object={ownedExamples[1]} />);
    dialog = within(await screen.findByRole("dialog", { name: "second_example" }));
    await user.click(dialog.getByRole("tab", { name: "Details" }));

    // the first again, with the resource that was opened from it, which has no Details tab.
    rerender(<ResourceDetail {...props} />);
    dialog = within(await screen.findByRole("dialog", { name: "stackademy_sql" }));
    expect(dialog.getByRole("tab", { name: /Manifest/ })).toHaveAttribute("aria-selected", "true");
  });

  it("reports a detail api's failure without a message by its status", async () => {
    server.use(
      http.post(
        "/api/web/dashboard/resource/Example/:locator/",
        () => new HttpResponse("Bad gateway", { status: 502 }),
      ),
    );
    const user = userEvent.setup();
    renderDetail();
    await user.click(screen.getByRole("tab", { name: /Manifest/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The detail of first_example could not be loaded: 502 Bad Gateway",
    );
  });

  it("opens from an element that isn't HTML, e.g. an SVG chart's, and closes", () => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("tabindex", "0");
    document.body.append(svg);
    svg.focus();
    expect(svg).toHaveFocus();
    const { unmount } = renderDetail({ object: null });
    expect(screen.getByRole("dialog", { name: "Example" })).toHaveFocus();
    unmount();
    expect(document.body).not.toHaveClass("modal-open");
    svg.remove();
  });
});
