/** The skeleton of the page that a navigation opens, by its path. */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { pageSkeletonFor, type PageSkeletonKind } from "@/lib/pageSkeleton";
import { PageSkeleton } from "@/routes/PageSkeleton";

describe("pageSkeletonFor()", () => {
  it.each([
    ["/dashboard", "dashboard"],
    ["/dashboard/dropzone", "page"],
    ["/dashboard/passthrough", "page"],
    ["/dashboard/terminal", "page"],
    ["/guardrail", "list"],
    ["/workbench", "list"],
    ["/guardrail/guardrails/rMTAwx", "manifest"],
    ["/workbench/llm-clients/abc/prompt", "workbench"],
    ["/extensions", "list"],
    ["/extensions/weather", "page"],
    ["/docs/manifests", "docs"],
    ["/docs/manifest/Guardrail", "docs"],
  ])("is the shape of %s: %s", (path, kind) => {
    expect(pageSkeletonFor(path)).toBe(kind);
  });

  it("is none for a path that isn't one of the console's pages", () => {
    expect(pageSkeletonFor("/nowhere")).toBeNull();
    expect(pageSkeletonFor("/login")).toBeNull();
  });
});

describe("PageSkeleton", () => {
  it.each<PageSkeletonKind>(["dashboard", "list", "manifest", "workbench", "docs", "page"])(
    "draws the %s page's skeleton, which screen readers hear as loading",
    (kind) => {
      render(<PageSkeleton kind={kind} />);
      expect(screen.getByRole("status", { name: "Loading" })).toHaveAttribute("aria-busy", "true");
    },
  );

  it("draws a list's table, with its skeleton rows", () => {
    render(<PageSkeleton kind="list" />);
    // the header, and eight rows.
    expect(screen.getAllByRole("row")).toHaveLength(1 + 8);
  });
});
