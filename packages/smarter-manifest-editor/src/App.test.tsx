import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearSchemas } from "@/lib/schemaHelp";
import {
  APPLY_API_URL,
  KINDS,
  SCHEMA_API_URL,
  SECRET_IN_USE_YAML,
  SECRET_YAML,
  VALIDATE_API_URL,
  appProps,
} from "@/mocks/fixtures";
import { cliHandlers, invalidHandler, validHandler } from "@/mocks/handlers";
import { server } from "@test/server";

import App from "@/App";

vi.mock("@monaco-editor/react", async () => await import("@/mocks/MonacoEditor"));

const VALIDATION = { timeout: 3000 };

function edit(yaml: string) {
  fireEvent.change(screen.getByLabelText("Manifest YAML"), { target: { value: yaml } });
}

describe("App", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("validates the manifest, and lists its problems", async () => {
    server.use(invalidHandler);
    render(<App {...appProps} />);
    expect(await screen.findByText("1 problem", {}, VALIDATION)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /spec.config.value: value must be at least 32 characters/ }),
    ).toBeInTheDocument();
  });

  it("finds a syntax error without asking the api", async () => {
    server.use(validHandler);
    render(<App {...appProps} />);
    await screen.findByText("No problems", {}, VALIDATION);
    edit("kind: [unclosed");
    expect(await screen.findByText("1 problem", {}, VALIDATION)).toBeInTheDocument();
  });

  it("saves the edited manifest, without its status", async () => {
    let applied: Record<string, unknown> | undefined;
    server.use(
      http.post(APPLY_API_URL, async ({ request }) => {
        applied = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ message: "Secret example_secret applied" });
      }),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    const save = screen.getByRole("button", { name: /^Save:/ });
    expect(save).toBeDisabled();

    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: "Save: Apply your changes to this manifest" }));

    expect(await screen.findByRole("dialog", { name: "Saved" })).toHaveTextContent("Secret example_secret applied");
    expect(applied).toMatchObject({ kind: "Secret", metadata: { description: "An edited secret." } });
    expect(applied).not.toHaveProperty("status");
  });

  it("clones the resource with a new name", async () => {
    let cloned: { metadata?: { name?: string } } | undefined;
    server.use(
      http.post(APPLY_API_URL, async ({ request }) => {
        cloned = (await request.json()) as typeof cloned;
        return HttpResponse.json({});
      }),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);

    await user.click(screen.getByRole("button", { name: /^Clone:/ }));
    await user.type(screen.getByRole("textbox", { name: "New Secret name" }), "secret_copy");
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(await screen.findByRole("dialog", { name: "Cloned" })).toHaveTextContent("Secret secret_copy created");
    expect(cloned?.metadata?.name).toBe("secret_copy");
  });

  it("deletes the resource, by kind and name", async () => {
    let deleted = "";
    server.use(
      http.post("/api/v1/cli/delete/:kind/", ({ params, request }) => {
        deleted = `${params.kind} ${new URL(request.url).searchParams.get("name")}`;
        return HttpResponse.json({});
      }),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);

    await user.click(screen.getByRole("button", { name: "Delete: Delete this Secret" }));
    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(await screen.findByRole("dialog", { name: "Deleted" })).toBeInTheDocument();
    expect(deleted).toBe("Secret example_secret");
  });

  it("does not delete a resource that others depend on", async () => {
    server.use(...cliHandlers);
    render(<App {...appProps} initialManifest={SECRET_IN_USE_YAML} />);
    expect(screen.getByRole("button", { name: /LLMClient example_llmclient/ })).toBeDisabled();
  });
});

describe("App, when things go wrong", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("lets the user save when the api can't validate", async () => {
    server.use(
      http.post(VALIDATE_API_URL, () => HttpResponse.error()),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    edit(`${SECRET_YAML}# edited\n`);
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: /^Save:/ }));
    expect(await screen.findByRole("dialog", { name: "Saved" })).toBeInTheDocument();
  });

  it("reports what's wrong with a manifest that is saved before it is checked", async () => {
    server.use(...cliHandlers);
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await screen.findByText("No problems", {}, VALIDATION);
    // save at once, before the edit is checked.
    edit("just: a mapping\n");
    await user.click(screen.getByRole("button", { name: /^Save:/ }));
    expect(await screen.findByRole("dialog", { name: "Save Failed" })).toHaveTextContent("apiVersion is missing");
  });

  it.each([
    ["problems", () => HttpResponse.json({ data: { valid: false, errors: [{ loc: [], message: "stale problem" }] } })],
    ["failure", () => HttpResponse.error()],
  ])("ignores the %s of a manifest that has since changed", async (_, earlier) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let requests = 0;
    server.use(
      http.post(VALIDATE_API_URL, async () => {
        requests += 1;
        if (requests === 1) {
          await gate;
          return earlier();
        }
        return HttpResponse.json({ data: { valid: true, errors: [] } });
      }),
    );
    render(<App {...appProps} />);
    // the first validation is under way when the user edits the manifest.
    await vi.waitFor(() => expect(requests).toBe(1), VALIDATION);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    expect(await screen.findByText("No problems", {}, VALIDATION)).toBeInTheDocument();
    release();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.getByText("No problems")).toBeInTheDocument();
    expect(screen.queryByText(/stale problem/)).not.toBeInTheDocument();
  });

  it("finds YAML that isn't a mapping without asking the api", async () => {
    // a validate request would be answered by the default handler; none is made.
    let requests = 0;
    server.use(
      http.post(VALIDATE_API_URL, () => {
        requests += 1;
        return HttpResponse.json({ data: { valid: true, errors: [] } });
      }),
    );
    render(<App {...appProps} />);
    await screen.findByText("No problems", {}, VALIDATION);
    requests = 0;
    edit("just a string\n");
    expect(await screen.findByText("1 problem", {}, VALIDATION)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /A manifest is a YAML mapping/ })).toBeInTheDocument();
    expect(requests).toBe(0);
  });

  it("reports the api's error when a save fails", async () => {
    server.use(
      http.post(APPLY_API_URL, () => HttpResponse.json({ error: "Secret is invalid" }, { status: 400 })),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: /^Save:/ }));
    const dialog = await screen.findByRole("dialog", { name: "Save Failed" });
    expect(dialog).toHaveTextContent("Secret is invalid");
    await user.click(within(dialog).getAllByRole("button")[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // the changes are still unsaved.
    expect(screen.getByRole("button", { name: /^Revert:/ })).toBeEnabled();
  });

  it("reports a network error as a failure", async () => {
    server.use(
      http.post(APPLY_API_URL, () => HttpResponse.error()),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: /^Save:/ }));
    expect(await screen.findByRole("dialog", { name: "Save Failed" })).toBeInTheDocument();
  });

  it("reverts the user's changes", async () => {
    server.use(...cliHandlers);
    const user = userEvent.setup();
    render(<App {...appProps} />);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await user.click(screen.getByRole("button", { name: /^Revert:/ }));
    expect(screen.getByLabelText("Manifest YAML")).toHaveValue(appProps.initialManifest);
    expect(screen.getByRole("button", { name: /^Revert:/ })).toBeDisabled();
  });

  it("doesn't clone without a new name, or when the user cancels", async () => {
    let calls = 0;
    server.use(
      http.post(APPLY_API_URL, () => {
        calls += 1;
        return HttpResponse.json({});
      }),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.click(screen.getByRole("button", { name: /^Clone:/ }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    await user.click(screen.getByRole("button", { name: /^Clone:/ }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls).toBe(0);
  });

  it("reports a clone that fails", async () => {
    server.use(
      http.post(APPLY_API_URL, () => HttpResponse.json({ error: { description: "name taken" } }, { status: 409 })),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.click(screen.getByRole("button", { name: /^Clone:/ }));
    await user.type(screen.getByRole("textbox", { name: "New Secret name" }), "taken");
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("dialog", { name: "Clone Failed" })).toHaveTextContent("name taken");
  });

  it("warns that a delete loses unsaved changes, and deletes nothing when the user cancels", async () => {
    server.use(...cliHandlers);
    const user = userEvent.setup();
    render(<App {...appProps} />);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await user.click(screen.getByRole("button", { name: "Delete: Delete this Secret" }));
    expect(screen.getByRole("dialog", { name: "Delete Secret" })).toHaveTextContent(
      "Your unsaved changes will be lost.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reports a delete that fails", async () => {
    server.use(
      http.post("/api/v1/cli/delete/:kind/", () => HttpResponse.json({ error: "in use" }, { status: 400 })),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.click(screen.getByRole("button", { name: "Delete: Delete this Secret" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(await screen.findByRole("dialog", { name: "Delete Failed" })).toHaveTextContent("in use");
  });

  it.each([
    ["the page the user came from", "http://localhost:9357/secrets/", "http://localhost:9357/secrets/"],
    ["the dashboard, without a referrer", "", "/dashboard/"],
    ["the dashboard, from another site", "https://example.com/", "/dashboard/"],
  ])("leaves a deleted resource's page for %s", async (_, referrer, destination) => {
    const assign = vi.fn();
    vi.spyOn(document, "referrer", "get").mockReturnValue(referrer);
    server.use(...cliHandlers);
    const user = userEvent.setup();
    render(<App {...appProps} />);
    await user.click(screen.getByRole("button", { name: "Delete: Delete this Secret" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    const dialog = await screen.findByRole("dialog", { name: "Deleted" });
    // jsdom can't navigate. Stub it only now: test/setup.ts resolves fetch()'s urls with location.
    vi.stubGlobal("location", { origin: window.location.origin, pathname: "/manifest/", assign });
    try {
      await user.click(within(dialog).getAllByRole("button")[0]);
      expect(assign).toHaveBeenCalledWith(destination);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tells the page that hosts it when it saves, and when it deletes, in place of leaving", async () => {
    const onSaved = vi.fn();
    const onDeleted = vi.fn();
    server.use(
      http.post(APPLY_API_URL, () => HttpResponse.json({ message: "Secret example_secret applied" })),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...appProps} onSaved={onSaved} onDeleted={onDeleted} />);
    edit(appProps.initialManifest.replace("An example secret.", "An edited secret."));
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: "Save: Apply your changes to this manifest" }));
    const saved = await screen.findByRole("dialog", { name: "Saved" });
    expect(onSaved).toHaveBeenCalledWith({ kind: "Secret", name: "example_secret" });
    await user.click(within(saved).getAllByRole("button")[0]);

    await user.click(screen.getByRole("button", { name: "Delete: Delete this Secret" }));
    await user.click(screen.getByRole("button", { name: "OK" }));
    const deleted = await screen.findByRole("dialog", { name: "Deleted" });
    expect(onDeleted).not.toHaveBeenCalled();
    await user.click(within(deleted).getAllByRole("button")[0]);
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it("can't clone or delete a manifest that it can't parse", () => {
    server.use(...cliHandlers);
    render(<App {...appProps} initialManifest={"kind: [unclosed"} />);
    expect(screen.getByRole("button", { name: "Delete: Delete this resource" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Download: Save this manifest as manifest.yaml/ })).toBeInTheDocument();
  });
});

describe("App, for a new manifest", () => {
  const newProps = {
    ...appProps,
    initialManifest: "",
    isNew: true,
    kinds: KINDS,
    schemaApiUrl: SCHEMA_API_URL,
    emptyMessage: "Paste a manifest.",
  };

  beforeEach(() => {
    clearSchemas();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("says what to do while it is empty, and can't apply nothing", async () => {
    server.use(...cliHandlers);
    render(<App {...newProps} />);
    expect(await screen.findByText("Paste a manifest.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply/ })).toBeDisabled();
    expect(screen.queryByRole("group", { name: "Resource" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Move the cursor/)).not.toBeInTheDocument();
  });

  it("checks a pasted manifest's header, then applies it, and tells its page", async () => {
    let applied: unknown;
    const onChange = vi.fn();
    const onSaved = vi.fn();
    server.use(
      http.post(APPLY_API_URL, async ({ request }) => {
        applied = await request.json();
        return HttpResponse.json({});
      }),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...newProps} onChange={onChange} onSaved={onSaved} />);

    edit("apiVersion: smarter.sh/v1\nkind: Secrett\nmetadata:\n  name: x\n");
    expect(await screen.findByText(/Secrett is not a kind of Smarter resource/, {}, VALIDATION)).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith(expect.stringContaining("Secrett"));

    edit(SECRET_YAML);
    await screen.findByText("No problems", {}, VALIDATION);
    // the field help, once the kind's schema loads.
    expect(await screen.findByText(/Move the cursor to a field/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    const dialog = await screen.findByRole("dialog", { name: "Applied" });
    expect(dialog).toHaveTextContent("Secret example_secret applied");
    expect(applied).toMatchObject({ kind: "Secret", metadata: { name: "example_secret" } });
    expect(applied).not.toHaveProperty("status");
    expect(onSaved).toHaveBeenCalledWith({ kind: "Secret", name: "example_secret" });

    // it can apply the same manifest again.
    await user.click(within(dialog).getAllByRole("button")[0]);
    expect(screen.getByRole("button", { name: /Apply/ })).toBeEnabled();
  });

  it("reports an apply that fails", async () => {
    server.use(
      http.post(APPLY_API_URL, () => HttpResponse.json({ error: "Secret is invalid" }, { status: 400 })),
      ...cliHandlers,
    );
    const user = userEvent.setup();
    render(<App {...newProps} initialManifest={SECRET_YAML} />);
    await screen.findByText("No problems", {}, VALIDATION);
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    expect(await screen.findByRole("dialog", { name: "Apply Failed" })).toHaveTextContent("Secret is invalid");
  });

  it("reports a manifest that is applied before it is checked", async () => {
    server.use(...cliHandlers);
    const user = userEvent.setup();
    render(<App {...newProps} initialManifest={SECRET_YAML} />);
    await screen.findByText("No problems", {}, VALIDATION);
    edit("just: a mapping\n");
    await user.click(screen.getByRole("button", { name: /Apply/ }));
    expect(await screen.findByRole("dialog", { name: "Apply Failed" })).toHaveTextContent("apiVersion is missing");
  });

  it("doesn't lock the manifest's header", async () => {
    server.use(...cliHandlers);
    render(<App {...newProps} initialManifest={SECRET_YAML} />);
    await screen.findByText("No problems", {}, VALIDATION);
    edit(SECRET_YAML.replace("example_secret", "another_secret"));
    expect(screen.getByLabelText("Manifest YAML")).toHaveValue(SECRET_YAML.replace("example_secret", "another_secret"));
  });
});
