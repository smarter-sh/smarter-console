import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import Actions from "@/components/Actions/Component";

function renderActions(props: Partial<Parameters<typeof Actions>[0]> = {}) {
  const all = { kinds: ["LLMClient", "Secret"], isBusy: false, onFile: vi.fn(), onExample: vi.fn(), ...props };
  render(<Actions {...all} />);
  return all;
}

describe("Actions", () => {
  it("opens the file dialog, and passes on the chosen file", async () => {
    const click = vi.spyOn(HTMLInputElement.prototype, "click").mockImplementation(() => {});
    const { onFile } = renderActions();
    await userEvent.click(screen.getByRole("button", { name: "File Open" }));
    expect(click).toHaveBeenCalled();

    const file = new File(["kind: Secret"], "a.yaml");
    await userEvent.upload(screen.getByLabelText("Manifest file"), file);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("does nothing without a file", () => {
    const { onFile } = renderActions();
    fireEvent.change(screen.getByLabelText("Manifest file"), { target: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });

  it("passes on the chosen example's kind, and is ready for another", async () => {
    const { onExample } = renderActions();
    const select = screen.getByLabelText<HTMLSelectElement>("Start from an example");
    await userEvent.selectOptions(select, "Secret");
    expect(select.value).toBe("");
    fireEvent.change(select, { target: { value: "" } });
    expect(onExample).toHaveBeenCalledExactlyOnceWith("Secret");
  });

  it("shows that an example is loading", () => {
    renderActions({ isBusy: true });
    expect(screen.getByLabelText("Start from an example")).toBeDisabled();
    expect(screen.getByRole("option", { name: "Loading the example…" })).toBeInTheDocument();
  });

  it("has no examples without kinds", () => {
    renderActions({ kinds: [] });
    expect(screen.queryByLabelText("Start from an example")).not.toBeInTheDocument();
  });
});
