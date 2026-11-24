import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { COPIED_MILLISECONDS, useCopyToClipboard } from "./clipboard";

/** A button that copies text, and shows copied and what copy() resolved to. */
function Copier({ text }: { text: string }) {
  const { copy, copied } = useCopyToClipboard();
  return (
    <>
      <button
        type="button"
        onClick={() => {
          void copy(text).then((result) => {
            document.title = String(result);
          });
        }}
      >
        Copy
      </button>
      <output>{copied ? "copied" : "not copied"}</output>
    </>
  );
}

describe("useCopyToClipboard", () => {
  const clipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  afterEach(() => {
    vi.useRealTimers();
    document.title = "";
    if (clipboard) Object.defineProperty(navigator, "clipboard", clipboard);
    else Reflect.deleteProperty(navigator, "clipboard");
  });

  it("copies the text, and says so for a moment", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Copier text="kind: Guardrail" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("copied")).toBeInTheDocument();
    expect(await navigator.clipboard.readText()).toBe("kind: Guardrail");
    await waitFor(() => expect(document.title).toBe("true"));

    act(() => {
      vi.advanceTimersByTime(COPIED_MILLISECONDS - 100);
    });
    expect(screen.getByText("copied")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByText("not copied")).toBeInTheDocument();
  });

  it("starts the moment again when it copies again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Copier text="kind: Guardrail" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("copied")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(COPIED_MILLISECONDS - 100);
    });
    await user.click(screen.getByRole("button", { name: "Copy" }));
    act(() => {
      vi.advanceTimersByTime(COPIED_MILLISECONDS - 100);
    });
    expect(screen.getByText("copied")).toBeInTheDocument();
  });

  it("copies nothing when the text is empty", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    render(<Copier text="" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(document.title).toBe("false"));
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByText("not copied")).toBeInTheDocument();
  });

  it("doesn't say copied when the clipboard refuses", async () => {
    const user = userEvent.setup();
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    render(<Copier text="secret value" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(document.title).toBe("false"));
    expect(screen.getByText("not copied")).toBeInTheDocument();
    expect(error).toHaveBeenCalledWith(expect.any(String), "Could not copy to the clipboard:", expect.any(Error));
    // the text is never logged.
    expect(JSON.stringify(error.mock.calls)).not.toContain("secret value");
  });

  it("doesn't say copied where the page has no clipboard", async () => {
    const user = userEvent.setup();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // after userEvent.setup(), which installs its own clipboard.
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    render(<Copier text="kind: Guardrail" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(document.title).toBe("false"));
    expect(screen.getByText("not copied")).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
  });

  it("forgets its timer when it unmounts", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<Copier text="kind: Guardrail" />);
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await screen.findByText("copied")).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
