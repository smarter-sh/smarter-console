/** The toolbar of every resource list: Edit, and Clone, Rename and Delete through the list api's actions. */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import { API_URL, exampleToolbarMessages, sessionContext } from "../../mocks/example";
import ResourceToolbar from "./Component";

const ACTIONS = API_URL.replace(/listview\/$/, "");

const messages = exampleToolbarMessages;

const example = { id: 7, name: "first_example", manifestUrl: "/example/abc/", canDelete: true };

function setup(props: Partial<Parameters<typeof ResourceToolbar>[0]> = {}) {
  const onRequery = vi.fn();
  render(
    <ResourceToolbar
      sessionContext={sessionContext}
      resource={example}
      messages={messages}
      onRequery={onRequery}
      {...props}
    />,
  );
  return { onRequery, user: userEvent.setup() };
}

describe("ResourceToolbar", () => {
  it("links to the manifest page, after the list's own links", () => {
    setup({ links: <a href="/elsewhere/">Elsewhere</a> });
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/elsewhere/", "/example/abc/"]);
    expect(links[1]).toHaveAttribute("title", messages.editTitle);
  });

  it("clones to a new name, shows the clone, and queries the list again when the result is closed", async () => {
    let url = "";
    server.use(
      http.post(`${ACTIONS}clone/7/:name/`, ({ request }) => {
        url = new URL(request.url).pathname;
        return HttpResponse.json({ ...example, id: 8, name: "the_clone" });
      }),
    );
    const { onRequery, user } = setup();
    await user.click(screen.getByTitle(messages.cloneTitle));
    const dialog = screen.getByRole("dialog", { name: "Clone Example" });
    expect(dialog).toHaveTextContent("Clone example first_example to a new resource owned by you.");
    const input = within(dialog).getByPlaceholderText("Enter new example name");
    expect(input).toHaveValue("");
    await user.type(input, "the_clone");
    await user.click(within(dialog).getByRole("button", { name: "OK" }));

    const success = await screen.findByRole("dialog", { name: /Success/ });
    expect(success).toHaveTextContent("Successfully cloned example the_clone.");
    expect(url).toBe(`${ACTIONS}clone/7/the_clone/`);
    expect(onRequery).not.toHaveBeenCalled();
    await user.click(within(success).getAllByRole("button", { name: "Close" })[0]);
    expect(onRequery).toHaveBeenCalledOnce();
  });

  it("renames, from the current name", async () => {
    server.use(
      http.post(`${ACTIONS}rename/7/:name/`, ({ params }) => HttpResponse.json({ ...example, name: params.name })),
    );
    const { user } = setup();
    await user.click(screen.getByTitle(messages.renameTitle));
    const dialog = screen.getByRole("dialog", { name: "Rename Example" });
    const input = within(dialog).getByPlaceholderText("Enter new example name");
    expect(input).toHaveValue("first_example");
    await user.clear(input);
    await user.type(input, "renamed");
    await user.click(within(dialog).getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("dialog", { name: /Success/ })).toHaveTextContent(
      "Successfully renamed example renamed.",
    );
  });

  it("deletes, after confirming, with the default warning or the list's own", async () => {
    server.use(http.post(`${ACTIONS}delete/7/`, () => HttpResponse.json({ message: "deleted" })));
    const { user } = setup();
    await user.click(screen.getByTitle(messages.deleteTitle));
    const dialog = screen.getByRole("dialog", { name: "Delete Example" });
    expect(dialog).toHaveTextContent("Are you sure you want to delete example first_example?");
    expect(dialog).toHaveTextContent("Data is not recoverable.");
    await user.click(within(dialog).getByRole("button", { name: "OK" }));
    // delete answers with a message: the result names the deleted resource.
    expect(await screen.findByRole("dialog", { name: /Success/ })).toHaveTextContent(
      "Successfully deleted example first_example.",
    );
  });

  it("says what a deletion destroys, when the list says more", async () => {
    const { user } = setup({ messages: { ...messages, deleteWarning: "Its documents are destroyed." } });
    await user.click(screen.getByTitle(messages.deleteTitle));
    expect(screen.getByRole("dialog", { name: "Delete Example" })).toHaveTextContent("Its documents are destroyed.");
  });

  it("does nothing when a dialog is cancelled", async () => {
    const { onRequery, user } = setup();
    await user.click(screen.getByTitle(messages.deleteTitle));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByTitle(messages.cloneTitle));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onRequery).not.toHaveBeenCalled();
  });

  it("explains why a resource that may not be deleted can't be", () => {
    setup({ resource: { ...example, canDelete: false } });
    const button = screen.getByTitle(messages.deleteForbiddenTitle);
    expect(button).toBeDisabled();
  });

  it("shows the server's error message, and doesn't query the list again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ACTIONS}delete/7/`, () => HttpResponse.json({ error: "In use" }, { status: 409 })));
    const { onRequery, user } = setup();
    await user.click(screen.getByTitle(messages.deleteTitle));
    await user.click(screen.getByRole("button", { name: "OK" }));
    const error = await screen.findByRole("dialog", { name: /Error/ });
    expect(error).toHaveTextContent("An error occurred while performing the operation on example first_example.");
    expect(error).toHaveTextContent("Failed to delete example (409): In use");
    await user.click(within(error).getAllByRole("button", { name: "Close" })[0]);
    expect(onRequery).not.toHaveBeenCalled();
  });

  it("names the status of an error without a message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    server.use(http.post(`${ACTIONS}rename/7/:name/`, () => new HttpResponse("oops", { status: 502 })));
    const { user } = setup();
    await user.click(screen.getByTitle(messages.renameTitle));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("dialog", { name: /Error/ })).toHaveTextContent(/Failed to rename example \(502\)/);
  });

  it("disables its actions while one runs", async () => {
    server.use(
      http.post(`${ACTIONS}delete/7/`, async () => {
        await delay(200);
        return HttpResponse.json({ message: "deleted" });
      }),
    );
    const { user } = setup();
    await user.click(screen.getByTitle(messages.deleteTitle));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByTitle(messages.cloneTitle)).toBeDisabled();
    expect(screen.getByTitle(messages.renameTitle)).toBeDisabled();
    expect(screen.getByTitle(messages.deleteTitle)).toBeDisabled();
    await screen.findByRole("dialog", { name: /Success/ });
    expect(screen.getByTitle(messages.cloneTitle)).toBeEnabled();
  });
});
