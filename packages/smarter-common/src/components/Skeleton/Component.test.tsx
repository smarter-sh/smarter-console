/** Skeletons: gray shapes that stand in for content while it loads. */
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Skeleton, SkeletonCode, SkeletonRegion, SkeletonRows, SkeletonText } from "./Component";

describe("Skeleton", () => {
  it("is a bar by default, sized in rem or any CSS length, and hidden from screen readers", () => {
    const { container } = render(
      <>
        <Skeleton width={4} />
        <Skeleton shape="circle" width="76px" height="76px" still />
      </>,
    );
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- shapes have no role.
    const [bar, circle] = Array.from(container.querySelectorAll<HTMLElement>(".smarter-skeleton"));
    expect(bar).toHaveClass("smarter-skeleton-bar");
    // the inline style: jsdom computes rem as pixels.
    expect([bar.style.width, bar.style.height]).toEqual(["4rem", "0.75rem"]);
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(circle).toHaveClass("smarter-skeleton-circle", "smarter-skeleton-still");
    expect(circle).toHaveStyle({ width: "76px", height: "76px" });
  });

  it("writes lines of text, the last one shorter", () => {
    const { container } = render(<SkeletonText lines={3} lastWidth="40%" />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- shapes have no role.
    const lines = Array.from(container.querySelectorAll<HTMLElement>(".smarter-skeleton"));
    expect(lines).toHaveLength(3);
    expect(lines[2]).toHaveStyle({ width: "40%" });
  });

  it("writes lines of code, indented, which screen readers skip", () => {
    const { container } = render(<SkeletonCode lines={4} />);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- shapes have no role.
    const lines = Array.from(container.querySelectorAll<HTMLElement>(".smarter-skeleton"));
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.style.marginLeft)).toEqual(["0rem", "0rem", "1.25rem", "1.25rem"]);
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- shapes have no role.
    expect(container.querySelector(".smarter-skeleton-code")).toHaveAttribute("aria-hidden", "true");
  });

  it("announces a region once, as loading", () => {
    render(
      <SkeletonRegion label="Loading My Resources">
        <Skeleton />
      </SkeletonRegion>,
    );
    expect(screen.getByRole("status", { name: "Loading My Resources" })).toHaveAttribute("aria-busy", "true");
  });
});

describe("SkeletonRows", () => {
  function renderRows(columns: Parameters<typeof SkeletonRows>[0]["columns"], count = 3) {
    return render(
      <table>
        <tbody>
          <SkeletonRows count={count} columns={columns} />
        </tbody>
      </table>,
    );
  }

  it("draws a ghost row per count, a cell per column, with its class names", () => {
    renderRows(["p-1 m-0", "d-none d-lg-table-cell", "text-end"]);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);
    for (const row of rows) expect(row).toHaveClass("ghost");
    const cells = within(rows[0]).getAllByRole("cell");
    expect(cells.map((cell) => cell.className)).toEqual(["p-1 m-0", "d-none d-lg-table-cell", "text-end"]);
  });

  it("shapes the name, the text and the actions, and says Loading... once", () => {
    renderRows(["", "", "text-end"], 2);
    const [first, second] = screen.getAllByRole("row");
    expect(within(first).getByText("Loading...")).toHaveClass("visually-hidden");
    expect(within(second).queryByText("Loading...")).not.toBeInTheDocument();
    const [name, text, actions] = within(second).getAllByRole("cell");
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(name.querySelector<HTMLElement>(".smarter-skeleton")?.style.width).toBe("8rem");
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(text.querySelectorAll(".smarter-skeleton")).toHaveLength(1);
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(actions.querySelectorAll(".smarter-skeleton-block")).toHaveLength(4);
  });

  it("shapes a right-aligned column as text, unless it is the last, the actions", () => {
    renderRows(["", "text-end", "text-end"], 1);
    const [, count, actions] = within(screen.getByRole("row")).getAllByRole("cell");
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(count.querySelectorAll(".smarter-skeleton-block")).toHaveLength(0);
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(actions.querySelectorAll(".smarter-skeleton-block")).toHaveLength(4);
  });

  it("takes a column's own shape: a name with a button, a paragraph, or nothing", () => {
    renderRows([{ className: "p-1", shape: "nameWithButton" }, { shape: "empty" }, { shape: "paragraph" }], 1);
    const [name, empty, paragraph] = within(screen.getByRole("row")).getAllByRole("cell");
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(paragraph.querySelectorAll(".smarter-skeleton")).toHaveLength(3);
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(name.querySelectorAll(".smarter-skeleton")).toHaveLength(2);
    expect(name).toHaveClass("p-1");
    // eslint-disable-next-line testing-library/no-node-access -- shapes have no role.
    expect(empty.querySelector(".smarter-skeleton")).toBeNull();
  });
});
