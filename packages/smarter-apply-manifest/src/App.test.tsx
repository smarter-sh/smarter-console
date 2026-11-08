import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { APPLY_API_URL, SECRET_MANIFEST, appProps } from "@/mocks/fixtures";
import { applyErrorHandlers, applyHandlers } from "@/mocks/handlers";
import { server } from "@test/server";

import App from "@/App";

vi.mock("@monaco-editor/react", async () => await import("@smarter/manifest-editor/mocks/monaco"));

const CHECKED = { timeout: 3000 };

const manifestFile = (content = SECRET_MANIFEST, name = "secret.yaml") =>
  new File([content], name, { type: "application/yaml" });

const editorText = () => screen.getByLabelText<HTMLTextAreaElement>("Manifest YAML").value;

function type(yaml: string) {
  fireEvent.change(screen.getByLabelText("Manifest YAML"), { target: { value: yaml } });
}

/** Drag a file into the window, as the browser does: dragenter, then dragover. */
function dragFileIn() {
  fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"] } });
}

describe("App", () => {
  beforeEach(() => {
    server.use(...applyHandlers);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("is an empty editor that says how to start, with no drop zone", async () => {
    render(<App {...appProps} />);
    expect(screen.getByRole("heading", { name: "Apply Smarter YAML Manifest" })).toBeInTheDocument();
    expect(await screen.findByText(/Paste or type a manifest, open a file, drag one here/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply/ })).toBeDisabled();
    expect(screen.queryByRole("region", { name: "Drop Zone" })).not.toBeInTheDocument();
  });

  it("applies a pasted manifest", async () => {
    let applied: unknown;
    server.use(
      http.post(APPLY_API_URL, async ({ request }) => {
        applied = await request.json();
        return HttpResponse.json({ message: "Secret example_secret applied successfully" });
      }),
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    type(SECRET_MANIFEST);
    await screen.findByText("No problems", {}, CHECKED);
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    expect(await screen.findByRole("dialog", { name: "Applied" })).toHaveTextContent(
      "Secret example_secret applied successfully",
    );
    expect(applied).toMatchObject({ kind: "Secret", metadata: { name: "example_secret" } });
  });

  it("shows the api's rejection", async () => {
    server.use(...applyErrorHandlers);
    const user = userEvent.setup();
    render(<App {...appProps} />);
    type(SECRET_MANIFEST);
    await screen.findByText("No problems", {}, CHECKED);
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    expect(await screen.findByRole("dialog", { name: "Apply Failed" })).toHaveTextContent("Invalid manifest");
  });

  it("opens a chosen file in the editor", async () => {
    render(<App {...appProps} />);
    await userEvent.upload(screen.getByLabelText("Manifest file"), manifestFile());
    expect(await screen.findByDisplayValue(/example_secret/)).toBeInTheDocument();
    expect(editorText()).toBe(SECRET_MANIFEST);
  });

  it("shows the drop zone only while a file is dragged over the page, and opens a dropped file", async () => {
    render(<App {...appProps} />);
    expect(screen.queryByRole("region", { name: "Drop Zone" })).not.toBeInTheDocument();

    act(dragFileIn);
    const zone = screen.getByRole("region", { name: "Drop Zone" });
    expect(zone).toHaveTextContent("Drop Zone");

    fireEvent.drop(zone, { dataTransfer: { types: ["Files"], files: [manifestFile()] } });
    expect(await screen.findByDisplayValue(/example_secret/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Drop Zone" })).not.toBeInTheDocument();
  });

  it("asks before a file replaces the user's text, and keeps it when the user cancels", async () => {
    const user = userEvent.setup();
    render(<App {...appProps} />);
    type("kind: Secret\n# my work\n");

    await userEvent.upload(screen.getByLabelText("Manifest file"), manifestFile());
    const dialog = await screen.findByRole("dialog", { name: "Replace the manifest?" });
    expect(dialog).toHaveTextContent("Replace the manifest in the editor with secret.yaml?");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(editorText()).toBe("kind: Secret\n# my work\n");

    await userEvent.upload(screen.getByLabelText("Manifest file"), manifestFile());
    await user.click(await screen.findByRole("button", { name: "OK" }));
    expect(editorText()).toBe(SECRET_MANIFEST);
  });

  it("doesn't ask to replace the text with the same text", async () => {
    render(<App {...appProps} />);
    type(SECRET_MANIFEST);
    await userEvent.upload(screen.getByLabelText("Manifest file"), manifestFile());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts from a kind's example", async () => {
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.selectOptions(screen.getByLabelText("Start from an example"), "Secret");
    expect(await screen.findByDisplayValue(/kind: Secret/)).toBeInTheDocument();
    expect(editorText()).toContain("apiVersion: smarter.sh/v1");
    expect(editorText()).toContain("  name: example_secret");
    await screen.findByText("No problems", {}, CHECKED);
  });

  it("reports an example that can't be loaded, until it is dismissed", async () => {
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.selectOptions(screen.getByLabelText("Start from an example"), "LLMClient");
    expect(await screen.findByRole("alert")).toHaveTextContent("The example LLMClient manifest could not be loaded.");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("reports a file that is too large to be a manifest", async () => {
    render(<App {...appProps} />);
    const file = manifestFile("x", "huge.yaml");
    Object.defineProperty(file, "size", { value: 2 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText("Manifest file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("huge.yaml is too large to be a manifest.");
  });

  it("reports an error that isn't an Error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<App {...appProps} />);
    const file = manifestFile();
    file.text = () => Promise.reject("unreadable");
    await userEvent.upload(screen.getByLabelText("Manifest file"), file);
    expect(await screen.findByRole("alert")).toHaveTextContent("secret.yaml could not be read.");
  });
});
