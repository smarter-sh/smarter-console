import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import Note from "@/components/Note/Component";

/** A stand-in for the browser's ResizeObserver, which jsdom lacks: a test says when the note resizes. */
class FakeResizeObserver {
  static latest: FakeResizeObserver | null = null;
  callback: () => void;
  disconnect = vi.fn();

  constructor(callback: () => void) {
    this.callback = callback;
    FakeResizeObserver.latest = this;
  }

  observe() {}
}

function stubSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

describe("Note", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("measures itself, centers itself by its size, and measures again when it resizes", () => {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    stubSize(200, 100);
    const { unmount } = render(
      <Note box={null} labelledBy="title">
        <h2 id="title">Hello</h2>
      </Note>,
    );
    const note = screen.getByRole("dialog", { name: "Hello" });
    expect(note).toHaveStyle({ left: `${(window.innerWidth - 200) / 2}px` });

    // the same size again changes nothing.
    act(() => FakeResizeObserver.latest!.callback());
    expect(note).toHaveStyle({ left: `${(window.innerWidth - 200) / 2}px` });

    stubSize(300, 100);
    act(() => FakeResizeObserver.latest!.callback());
    expect(note).toHaveStyle({ left: `${(window.innerWidth - 300) / 2}px` });

    unmount();
    expect(FakeResizeObserver.latest!.disconnect).toHaveBeenCalled();
  });
});
