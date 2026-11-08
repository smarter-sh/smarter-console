/**
 * Messages that are data rather than prose, displayed as a person would want to read them.
 *
 * - JSON: a message that is only a JSON object or array, or a JSON string that holds one (which tools
 *   often return), is pretty printed, in a json code block. See prettyJson.
 * - A Smarter manifest: a message that is only a YAML document with top-level ``apiVersion`` and
 *   ``kind`` keys is a yaml code block, with a download button that saves it as ``<name>.yaml``. See
 *   manifestFilename.
 * - CSV and TSV: a message that is only rows of comma or tab separated values, with a header row, is
 *   a table. See csvRows.
 *
 * Each detector is strict, so that prose is never mistaken for data: anything else around the data,
 * e.g. "Here it is:", leaves the message as markdown.
 */
import { codeBlockHtml } from "./code";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

/** A JSON object or array, parsed, or undefined if the text is anything else. */
function parseJsonContainer(text: string): object | undefined {
  if (!/^[[{]/.test(text)) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * A text that is only a JSON object or array, pretty printed, or null for any other text. A JSON
 * string that holds one, e.g. ``"{\"a\": 1}"``, is unwrapped, once. A JSON string, number or literal
 * is not: "42" is a number to a person, not JSON.
 */
export function prettyJson(text: string): string | null {
  const trimmed = text.trim();
  let value = parseJsonContainer(trimmed);
  if (value === undefined && trimmed.startsWith('"')) {
    try {
      const inner: unknown = JSON.parse(trimmed);
      if (typeof inner === "string") value = parseJsonContainer(inner.trim());
    } catch {
      // not a JSON string.
    }
  }
  return value === undefined ? null : JSON.stringify(value, null, 2);
}

// a top-level line of a YAML mapping: a key, a comment, or a document marker.
const YAML_TOP_LEVEL_LINE = /^(?:#.*|---\s*|\.\.\.\s*|["']?[\w.-]+["']?:(?:\s.*)?)$/;
const MANIFEST_KEYS = [/^apiVersion:[ \t]*\S/m, /^kind:[ \t]*\S/m];

/**
 * Whether a text is only a Smarter manifest, or another Kubernetes-style YAML document: top-level
 * ``apiVersion`` and ``kind`` keys, and nothing but YAML around them.
 */
export function isManifest(text: string): boolean {
  const trimmed = text.trim();
  if (!MANIFEST_KEYS.every((key) => key.test(trimmed))) return false;
  return trimmed.split("\n").every((line) => !line.trim() || /^\s/.test(line) || YAML_TOP_LEVEL_LINE.test(line));
}

/** The value of a YAML scalar, without its quotes or a trailing comment. */
function scalar(value: string): string {
  return value
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
}

/**
 * The file name that a manifest is saved as: its ``metadata.name``, or else its ``kind``, as
 * ``<name>.yaml``, without characters that file names can't have.
 */
export function manifestFilename(text: string): string {
  const name = /^metadata:[ \t]*\n(?:[ \t]+.*\n)*?[ \t]+name:[ \t]*(.+)$/m.exec(text)?.[1];
  const kind = /^kind:[ \t]*(.+)$/m.exec(text)?.[1];
  const base = scalar(name ?? kind ?? "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/^[._]+/, "");
  return `${base || "manifest"}.yaml`;
}

/** Html for a manifest: a yaml code block, with a download button. */
export function manifestHtml(text: string): string {
  return codeBlockHtml(text.trim(), "yaml", { filename: manifestFilename(text) });
}

/** The fields of a line of delimited values, in which a quoted field may contain the delimiter. */
function splitRow(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.trim() === "") {
      quoted = true;
      field = "";
    } else if (character === delimiter) {
      fields.push(field.trim());
      field = "";
    } else {
      field += character;
    }
  }
  fields.push(field.trim());
  return fields;
}

// the longest that a header cell, or a cell on average, may be. Longer ones are sentences.
const MAX_HEADER_LENGTH = 40;
const MAX_AVERAGE_CELL_LENGTH = 40;

/**
 * A text's rows, if it is only CSV or TSV: a header row of distinct, short, non-empty names, and at
 * least two rows of data, all with the same number (two or more) of fields. CSV with two fields
 * needs a column of numbers, since prose may have commas. No line may end with punctuation, as prose
 * does. Otherwise null. Tabs are the
 * delimiter if the header has one, and otherwise commas.
 */
export function csvRows(text: string): string[][] | null {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim());
  if (lines.length < 3) return null;
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const rows = lines.map((line) => splitRow(line, delimiter));
  const [header] = rows;
  if (header.length < 2 || rows.some((row) => row.length !== header.length)) return null;
  if (header.some((name) => !name || name.length > MAX_HEADER_LENGTH)) return null;
  if (new Set(header).size !== header.length) return null;
  const cells = rows.flat();
  const average = cells.reduce((total, cell) => total + cell.length, 0) / cells.length;
  if (average > MAX_AVERAGE_CELL_LENGTH) return null;
  // lines of prose, e.g. a poem's, end with punctuation, and rarely have numbers in one column.
  if (rows.some((row) => /[.!?;:]$/.test(row[row.length - 1]))) return null;
  const numericColumn = header.some((_, column) =>
    rows.slice(1).every((row) => /^-?[$€£]?\d[\d,]*(?:\.\d+)?%?$/.test(row[column])),
  );
  // prose has no tabs, but may have commas.
  return delimiter === "\t" || header.length >= 3 || numericColumn ? rows : null;
}

/** Html for rows of CSV or TSV: a table, with the first row as its header. */
export function csvHtml(rows: string[][]): string {
  const [header, ...body] = rows;
  const cells = (row: string[], tag: string) => row.map((cell) => `<${tag}>${escape(cell)}</${tag}>`).join("");
  return (
    `<table class="smarter-chat-csv"><thead><tr>${cells(header, "th")}</tr></thead>` +
    `<tbody>${body.map((row) => `<tr>${cells(row, "td")}</tr>`).join("")}</tbody></table>`
  );
}

/**
 * Html for a message that is only data, or null for any other message: pretty printed JSON, a
 * manifest, or a table of CSV or TSV. The html is not yet sanitized.
 */
export function dataHtml(text: string): string | null {
  const json = prettyJson(text);
  if (json !== null) return codeBlockHtml(json, "json");
  if (isManifest(text)) return manifestHtml(text);
  const rows = csvRows(text);
  return rows ? csvHtml(rows) : null;
}
