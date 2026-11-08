import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useFileDrag } from "./useFileDrag";

const files = { dataTransfer: { types: ["Files"] } };
const text = { dataTransfer: { types: ["text/plain"] } };

/** Fire a drag event at the window, and return whether its default was prevented. */
function drag(type: string, init: object): boolean {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(event, init);
  act(() => {
    window.dispatchEvent(event);
  });
  return event.defaultPrevented;
}

describe("useFileDrag", () => {
  it("is on while a file is over the page, across the elements that it crosses", () => {
    const { result } = renderHook(() => useFileDrag());
    expect(result.current).toBe(false);

    drag("dragenter", files);
    // into a child element, then out of the first.
    drag("dragenter", files);
    drag("dragleave", files);
    expect(result.current).toBe(true);

    drag("dragleave", files);
    expect(result.current).toBe(false);
    // a stray leave doesn't count below zero.
    drag("dragleave", files);
    drag("dragenter", files);
    expect(result.current).toBe(true);
  });

  it("accepts a dropped file anywhere, so that the browser doesn't open it, and ends", () => {
    const { result } = renderHook(() => useFileDrag());
    drag("dragenter", files);
    expect(drag("dragover", files)).toBe(true);
    expect(drag("drop", files)).toBe(true);
    expect(result.current).toBe(false);
  });

  it("ignores dragged text, e.g. within the editor", () => {
    const { result } = renderHook(() => useFileDrag());
    drag("dragenter", text);
    expect(result.current).toBe(false);
    expect(drag("dragover", text)).toBe(false);
    drag("dragleave", text);
    expect(drag("drop", text)).toBe(false);
    // an event without a dataTransfer.
    drag("dragenter", {});
    expect(result.current).toBe(false);
  });

  it("stops listening when it unmounts", () => {
    const { result, unmount } = renderHook(() => useFileDrag());
    unmount();
    expect(drag("dragover", files)).toBe(false);
    expect(result.current).toBe(false);
  });
});
