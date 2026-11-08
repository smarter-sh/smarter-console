import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeExtension } from "@/mocks/fixtures";

import { ExtensionStatusBar } from "@/components/ExtensionStatusBar/Component";

describe("ExtensionStatusBar", () => {
  it.each([
    [true, /^Enabled:/],
    [false, /^Disabled:/],
  ])("shows whether it is enabled: %s", (enabled, title) => {
    render(<ExtensionStatusBar extension={makeExtension(1, { enabled })} />);
    expect(screen.getByTitle(title)).toBeInTheDocument();
  });

  it.each([
    ["official", "Official Smarter Extension"],
    ["verified", "Verified Publisher"],
    ["community", "Community"],
    ["unverified", "Unverified"],
  ] as const)("shows its trust badge: %s", (trustBadge, trustBadgeLabel) => {
    render(<ExtensionStatusBar extension={makeExtension(1, { trustBadge, trustBadgeLabel })} />);
    expect(screen.getByTitle(trustBadgeLabel)).toBeInTheDocument();
  });

  it("shows an unknown trust badge with the unverified icon", () => {
    render(
      <ExtensionStatusBar extension={makeExtension(1, { trustBadge: "unverified", trustBadgeLabel: "Unverified" })} />,
    );
    render(
      <ExtensionStatusBar
        extension={makeExtension(2, { trustBadge: "mystery" as never, trustBadgeLabel: "Mystery" })}
      />,
    );
    expect(screen.getByTitle("Mystery").innerHTML).toBe(screen.getByTitle("Unverified").innerHTML);
  });

  it("shows where it was installed from", () => {
    render(<ExtensionStatusBar extension={makeExtension(1, { source: "registry" })} />);
    expect(screen.getByTitle("Installed from the extension registry")).toBeInTheDocument();
  });
});
