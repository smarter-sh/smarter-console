import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import DropOverlay from "@/components/DropOverlay/Component";

describe("DropOverlay", () => {
  it("passes on a dropped file", () => {
    const onFile = vi.fn();
    render(<DropOverlay onFile={onFile} />);
    const file = new File(["kind: Secret"], "a.yaml");
    const zone = screen.getByRole("region", { name: "Drop Zone" });
    expect(fireEvent.dragOver(zone)).toBe(false);
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("ignores a drop without a file", () => {
    const onFile = vi.fn();
    render(<DropOverlay onFile={onFile} />);
    fireEvent.drop(screen.getByRole("region", { name: "Drop Zone" }), { dataTransfer: { files: [] } });
    expect(onFile).not.toHaveBeenCalled();
  });
});
