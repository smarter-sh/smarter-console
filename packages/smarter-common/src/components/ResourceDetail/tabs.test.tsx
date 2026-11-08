import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { exampleDetail } from "../../mocks/handlers";
import { leafTree } from "../../mocks/resourceTree";
import type { ResourceDetailData } from "./api";
import { DependenciesTab, HierarchyTab, manifestFileName, ManifestTab } from "./tabs";

const detail = (overrides: Partial<ResourceDetailData> = {}): ResourceDetailData => ({
  ...exampleDetail(1, "first_example"),
  ...overrides,
});

describe("manifestFileName", () => {
  it("names the file by the kind and the name, made safe", () => {
    expect(manifestFileName("Guardrail", "PII Redaction!")).toBe("guardrail-pii-redaction-.yaml");
  });

  it("names a resource without a name's manifest by its kind", () => {
    expect(manifestFileName("Guardrail", null)).toBe("guardrail-manifest.yaml");
  });
});

describe("ManifestTab", () => {
  const createObjectURL = URL.createObjectURL;
  const revokeObjectURL = URL.revokeObjectURL;
  afterEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  it("says why a manifest that couldn't be read is missing", () => {
    render(<ManifestTab detail={detail({ manifest: null, manifestError: "Permission denied." })} />);
    expect(screen.getByText("The manifest could not be read.")).toBeInTheDocument();
    expect(screen.getByText("Permission denied.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy" })).not.toBeInTheDocument();
  });

  it("copies the manifest, and says so", async () => {
    const user = userEvent.setup();
    render(<ManifestTab detail={detail()} />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe(detail().manifest);
  });

  it("downloads the manifest as a YAML file, without an Edit manifest link when it has no page", async () => {
    URL.createObjectURL = vi.fn(() => "blob:manifest");
    URL.revokeObjectURL = vi.fn();
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download} ${this.href}`);
    });
    render(<ManifestTab detail={detail({ name: null, url: null })} />);
    expect(screen.queryByRole("link", { name: "Edit manifest" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Download" }));
    expect(downloads).toEqual(["guardrail-manifest.yaml blob:manifest"]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:manifest");
  });
});

describe("HierarchyTab", () => {
  it("says that a resource uses nothing, by its kind when it has no name", () => {
    render(<HierarchyTab detail={detail({ name: null, tree: leafTree })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Guardrail uses no other resources.");
    expect(screen.queryByRole("button", { name: "Collapse all" })).not.toBeInTheDocument();
  });

  it("collapses and expands one resource's branch", async () => {
    const user = userEvent.setup();
    render(<HierarchyTab detail={detail()} />);
    await user.click(screen.getByRole("button", { name: "Hide what openai uses" }));
    expect(screen.getByRole("button", { name: "Expand all" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Show what openai uses" }));
    expect(screen.getByRole("button", { name: "Expand all" })).toBeDisabled();
  });
});

describe("DependenciesTab", () => {
  it("says that nothing uses a resource, by its kind when it has no name", () => {
    render(<DependenciesTab detail={detail({ name: null, dependents: [] })} />);
    expect(screen.getByText("No other resource uses Guardrail.")).toBeInTheDocument();
    expect(screen.getByText("Nothing depends on it, so deleting it breaks nothing.")).toBeInTheDocument();
  });

  it("lists a resource that uses it, even without a record locator", () => {
    const dependent = { ...leafTree, recordLocator: null } as unknown as ResourceDetailData["tree"];
    render(<DependenciesTab detail={detail({ dependents: [dependent] })} />);
    expect(screen.getByText(/1 resource uses first_example/)).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "What uses first_example" });
    expect(within(list).getByText("hello_world")).toBeInTheDocument();
  });
});
