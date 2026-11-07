/**
 * Skeletons: gray shapes that stand in for content while it loads, as YouTube, LinkedIn and Netflix show them on a
 * slow network. Each has the size of what it stands in for, so that the content takes its place without moving the
 * page. A light sweeps across them while they load, and they are still when the user prefers reduced motion, or
 * when loading failed (still).
 *
 * - Skeleton: one shape, a bar, a block or a circle.
 * - SkeletonText: lines of a paragraph, of slightly different widths.
 * - SkeletonRegion: a region of skeletons, which screen readers announce once, as loading, and whose shapes they
 *   skip.
 * - SkeletonRows: a list's table rows, one shape per column (see SkeletonRows' columns).
 * - SkeletonChart: a chart, with the control that chooses what it shows, e.g. a period.
 * - SkeletonCode: lines of code, e.g. a manifest's YAML, indented as code is.
 */
import type { CSSProperties, ReactNode } from "react";

import { gettext } from "../../lib/i18n";

import "./styles.css";

/** A length: a number of rem, or a CSS length, e.g. "60%". */
type Length = number | string;

function css(length: Length | undefined): string | undefined {
  if (length === undefined) return undefined;
  return typeof length === "number" ? `${length}rem` : length;
}

export interface SkeletonProps {
  /** A bar, of text; a block, e.g. a button or a chart; or a circle, e.g. an avatar or a ring. */
  shape?: "bar" | "block" | "circle";
  width?: Length;
  height?: Length;
  /** Still, without the light: e.g. when loading failed, and the shape only keeps the layout. */
  still?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** One gray shape, the size of what it stands in for. Screen readers skip it. */
export function Skeleton({
  shape = "bar",
  width = "100%",
  height,
  still = false,
  className = "",
  style,
}: SkeletonProps) {
  const defaultHeight = shape === "bar" ? 0.75 : undefined;
  return (
    <span
      aria-hidden="true"
      className={`smarter-skeleton smarter-skeleton-${shape}${still ? " smarter-skeleton-still" : ""} ${className}`.trim()}
      style={{ width: css(width), height: css(height ?? defaultHeight), ...style }}
    />
  );
}

/** The widths of a paragraph's lines, which repeat: a paragraph's lines are not all as long. */
const LINE_WIDTHS = ["100%", "94%", "97%", "88%"];

/** Lines of text: the last one shorter, as a paragraph's is. */
export function SkeletonText({ lines = 3, lastWidth = "60%" }: { lines?: number; lastWidth?: Length }) {
  return (
    <span className="smarter-skeleton-text" aria-hidden="true">
      {Array.from({ length: lines }, (_, line) => (
        <Skeleton key={line} width={line === lines - 1 ? lastWidth : LINE_WIDTHS[line % LINE_WIDTHS.length]} />
      ))}
    </span>
  );
}

/**
 * A region of skeletons, which screen readers announce once, e.g. "Loading" or "Loading My Resources", rather than
 * each shape.
 */
export function SkeletonRegion({
  label,
  className = "",
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label ?? gettext("Loading")} className={className}>
      {children}
    </div>
  );
}

/**
 * A chart while it loads: the control above it, e.g. a period's select, when it has one, and a block of the
 * chart's height. Screen readers hear Loading… once.
 *
 * @param height - The chart's height, in pixels.
 * @param controls - Whether the chart has a control above it.
 */
export function SkeletonChart({ height, controls = false }: { height: number; controls?: boolean }) {
  return (
    <SkeletonRegion label={gettext("Loading…")}>
      {controls && <Skeleton shape="block" width={8} height={2.1} className="d-block mb-4" />}
      <Skeleton shape="block" height={`${height}px`} className="d-block" />
    </SkeletonRegion>
  );
}

/** The lines of SkeletonCode: each one's indent, in steps, and width, in rem, as a manifest's YAML is. */
const CODE_LINES: [number, number][] = [
  [0, 9],
  [0, 6],
  [1, 11],
  [1, 14],
  [1, 8],
  [0, 5],
  [1, 12],
  [2, 15],
  [2, 10],
  [3, 13],
  [3, 9],
  [1, 7],
  [2, 12],
  [2, 8],
];

/**
 * Lines of code while they load, e.g. a manifest's YAML in its editor, indented as code is. Screen readers skip
 * them: put them in a SkeletonRegion, or a page's skeleton, which says Loading.
 *
 * @param lines - How many lines; the pattern repeats.
 */
export function SkeletonCode({ lines = CODE_LINES.length }: { lines?: number }) {
  return (
    <span className="smarter-skeleton-code" aria-hidden="true">
      {Array.from({ length: lines }, (_, line) => {
        const [indent, width] = CODE_LINES[line % CODE_LINES.length];
        return <Skeleton key={line} width={width} height={0.8} style={{ marginLeft: `${indent * 1.25}rem` }} />;
      })}
    </span>
  );
}

/**
 * A column of a list's table, for SkeletonRows: the class names of its cells, which say at which widths it shows,
 * e.g. "d-none d-lg-table-cell", and, optionally, what it holds.
 */
export type SkeletonColumn =
  | string
  | {
      className?: string;
      /**
       * The name; the name with a button below it, e.g. the LLMClient list's Workbench; text; a paragraph, e.g. a
       * description, which wraps onto lines of its own; the row's actions, the Toolbar's icon buttons; or nothing.
       */
      shape: "name" | "nameWithButton" | "text" | "paragraph" | "actions" | "empty";
    };

/**
 * The widths of the text columns' bars, in rem, by column: each column's bars have one width, so they read as
 * columns. Fixed widths, rather than a share of the cell: an empty table's cells are narrow.
 */
const COLUMN_WIDTHS = [5.5, 4, 6.5, 3.5, 5, 4.5];

/** How many icon buttons the actions column shows: Edit, Clone, Rename and Delete. */
const ACTIONS = 4;

function shapeOf(column: SkeletonColumn, index: number, last: boolean): { className: string; shape: string } {
  if (typeof column !== "string") return { className: column.className ?? "", shape: column.shape };
  if (index === 0) return { className: column, shape: "name" };
  // the last column, right-aligned, holds the row's actions; another right-aligned one, e.g. a count, is text.
  if (last && column.split(/\s+/).includes("text-end")) return { className: column, shape: "actions" };
  return { className: column, shape: "text" };
}

/** A cell's shape. */
function Cell({ shape, index }: { shape: string; index: number }) {
  if (shape === "empty") return null;
  if (shape === "name") return <Skeleton width={8} height={0.85} />;
  if (shape === "nameWithButton") {
    return (
      <span className="smarter-skeleton-stack">
        <Skeleton width={8} height={0.85} />
        <Skeleton shape="block" width={6.5} height={2.1} />
      </span>
    );
  }
  if (shape === "paragraph") {
    return (
      <span className="smarter-skeleton-paragraph">
        <SkeletonText lines={3} />
      </span>
    );
  }
  if (shape === "actions") {
    return (
      <span className="smarter-skeleton-actions">
        {Array.from({ length: ACTIONS }, (_, action) => (
          <Skeleton key={action} shape="block" width={2.25} height={2.25} />
        ))}
      </span>
    );
  }
  return <Skeleton width={COLUMN_WIDTHS[index % COLUMN_WIDTHS.length]} />;
}

/**
 * A list's table rows while it loads, `<tr className="ghost">` (see TabbedListView, which tells them from the rows
 * of objects), each with one shape per column, the cells having the columns' class names, so that a column hidden
 * at a width is hidden in the skeleton too. Screen readers skip the shapes, and hear Loading... once, in the first
 * row.
 *
 * By default, the first column is the name, the last one holds the row's actions when its class names include
 * text-end, and the others hold text; a column may say what it holds instead.
 *
 * @param count - How many rows.
 * @param columns - The table's columns.
 */
export function SkeletonRows({ count, columns }: { count: number; columns: SkeletonColumn[] }) {
  return (
    <>
      {Array.from({ length: count }, (_, row) => (
        <tr key={row} className="ghost smarter-skeleton-row">
          {columns.map((column, index) => {
            const { className, shape } = shapeOf(column, index, index === columns.length - 1);
            return (
              <td key={index} className={className || undefined}>
                <Cell shape={shape} index={index} />
                {/* the rows are the table's while it loads, which a screen reader announces once. */}
                {row === 0 && index === 0 && <span className="visually-hidden">{gettext("Loading...")}</span>}
              </td>
            );
          })}
        </tr>
      ))}
    </>
  );
}
