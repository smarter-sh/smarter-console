import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CopyButton from "./Component";

describe("CopyButton", () => {
  it("copies its text, and says Copied in a live region", async () => {
    const user = userEvent.setup();
    render(<CopyButton text="smarter apply -f manifest.yaml" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    const button = await screen.findByRole("button", { name: "Copied" });
    expect(await navigator.clipboard.readText()).toBe("smarter apply -f manifest.yaml");
    // eslint-disable-next-line testing-library/no-node-access -- the live region and the icon are inside the button.
    expect(button.querySelector("[aria-live='polite']")).toHaveTextContent("Copied");
    // eslint-disable-next-line testing-library/no-node-access -- the live region and the icon are inside the button.
    expect(button.querySelector("i")).toHaveClass("ki-check", "fs-5");
  });

  it("keeps its label as its name, and its own classes", async () => {
    const user = userEvent.setup();
    render(
      <CopyButton text="kind: Guardrail" label="Copy the manifest" className="btn btn-sm" iconClassName="fs-7 me-1" />,
    );
    const button = screen.getByRole("button", { name: "Copy the manifest" });
    expect(button).toHaveClass("btn", "btn-sm");
    expect(button).not.toHaveClass("btn-light");
    // eslint-disable-next-line testing-library/no-node-access -- the live region and the icon are inside the button.
    expect(button.querySelector("i")).toHaveClass("ki-copy", "fs-7", "me-1");
    await user.click(button);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the manifest" })).toBeInTheDocument();
  });

  it("has no icon when its icon class is null", () => {
    render(<CopyButton text="kind: Guardrail" iconClassName={null} />);
    const button = screen.getByRole("button", { name: "Copy" });
    // eslint-disable-next-line testing-library/no-node-access -- the live region and the icon are inside the button.
    expect(button.querySelector("i")).toBeNull();
  });

  it("still says Copy when the clipboard refuses", async () => {
    const user = userEvent.setup();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<CopyButton text="kind: Guardrail" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled(), { timeout: 5000 });
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  });
});
