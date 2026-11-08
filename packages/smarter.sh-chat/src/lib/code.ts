/**
 * Code blocks in markdown messages, displayed as GitHub displays them: syntax highlighted, with
 * the language's name and a copy button in a header above the code. A long one is collapsed to its
 * first lines, with a button that shows the rest.
 *
 * Highlighting is by highlight.js, which runs synchronously, as the markdown renderer does, and
 * whose html is spans with "hljs-*" css classes. Their colors are GitHub's dark theme. See
 * styles.css. The copy button works by event delegation, because messages are html strings rather
 * than React elements. See copyCodeBlock, and SmarterChat's onClick.
 */
import hljs from "highlight.js/lib/common";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import nginx from "highlight.js/lib/languages/nginx";
import powershell from "highlight.js/lib/languages/powershell";

import { gettext, interpolate, ngettext } from "./i18n";

// the common languages, e.g. python, javascript, typescript, bash, json, yaml, sql, go, rust, java,
// c, c++, c#, html and css, plus a few that LLMs often write and that common leaves out.
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("nginx", nginx);
hljs.registerLanguage("powershell", powershell);

export const CODE_BLOCK_CLASS = "smarter-chat-code";
export const COPY_BUTTON_CLASS = "smarter-chat-code-copy";
export const DOWNLOAD_BUTTON_CLASS = "smarter-chat-download";
// a long code block is collapsed to its first lines, with a button that shows the rest, and back.
export const COLLAPSED_CLASS = "smarter-chat-code-collapsed";
export const EXPAND_BUTTON_CLASS = "smarter-chat-code-expand";
export const COLLAPSE_LINES = 25;
// a mermaid code block, which mermaid.ts displays as a diagram.
export const MERMAID_BLOCK_CLASS = "smarter-chat-mermaid";
const MERMAID_LANGUAGE = "mermaid";
const COPIED_DURATION = 2000;

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

/**
 * The language of a code block, from its fence's info string, e.g. "python" from
 * "```python title=asgi.py", or "" when it has none.
 */
export function codeLanguage(info: string | undefined): string {
  return (info ?? "").trim().split(/\s+/)[0].toLowerCase();
}

/**
 * A code block's text, without a closing fence that is at the end of its last line rather than on
 * a line of its own, e.g. "  )```", which LLMs sometimes write. Markdown does not close the block
 * there, so the block ends with the message, and the fence would otherwise be displayed as code.
 */
export function stripTrailingFence(text: string): string {
  return text.replace(/(\S)[ \t]*`{3,}[ \t]*$/, "$1");
}

/**
 * Html for a code block's code: highlighted if its language is one that highlight.js knows, by
 * name or alias (e.g. "py", "js", "sh", "yml"), and otherwise escaped, as GitHub does.
 */
export function highlightCode(text: string, language: string): string {
  if (language && hljs.getLanguage(language)) {
    return hljs.highlight(text, { language, ignoreIllegals: true }).value;
  }
  return escape(text);
}

/** A download button, which saves the media or the code beside it as filename. See media.ts. */
export function downloadButton(filename: string): string {
  return (
    `<button type="button" class="${DOWNLOAD_BUTTON_CLASS}" data-filename="${escape(filename)}" ` +
    `aria-label="${escape(gettext("Download"))}" title="${escape(gettext("Download"))}">` +
    `${escape(gettext("Download"))}</button>`
  );
}

/** The text of the button that shows all of a collapsed code block's lines. */
function expandLabel(lines: number): string {
  return interpolate(ngettext("Show all %(lines)s line", "Show all %(lines)s lines", lines), { lines });
}

/** The options of a code block. */
export interface CodeBlockOptions {
  /** The file name that its download button saves its code as. Without it, it has no download button. */
  filename?: string;
}

/**
 * Html for a fenced or indented code block: a header with its language and a copy button, and its
 * highlighted code. A mermaid block is also marked, so that it can be displayed as a diagram. See
 * mermaid.ts. A block of more than COLLAPSE_LINES lines, other than a diagram's, is collapsed to its
 * first lines, with a button that shows the rest. See toggleCodeBlock. With a filename, its header
 * also has a download button, which saves its code. See media.ts.
 */
export function codeBlockHtml(text: string, info?: string, options: CodeBlockOptions = {}): string {
  const language = codeLanguage(info);
  const code = stripTrailingFence(text).replace(/\n$/, "");
  const known = !!language && !!hljs.getLanguage(language);
  const codeClass = known ? `hljs language-${escape(language)}` : "hljs";
  const mermaid = language === MERMAID_LANGUAGE;
  const lines = code.split("\n").length;
  const collapsed = !mermaid && lines > COLLAPSE_LINES;
  const blockClass = [CODE_BLOCK_CLASS, mermaid && MERMAID_BLOCK_CLASS, collapsed && COLLAPSED_CLASS]
    .filter(Boolean)
    .join(" ");
  const expand = collapsed
    ? `<button type="button" class="${EXPAND_BUTTON_CLASS}" aria-expanded="false" data-lines="${lines}">` +
      `${escape(expandLabel(lines))}</button>`
    : "";
  return (
    `<div class="${blockClass}">` +
    `<div class="${CODE_BLOCK_CLASS}-header">` +
    `<span class="${CODE_BLOCK_CLASS}-language">${escape(language)}</span>` +
    `<button type="button" class="${COPY_BUTTON_CLASS}" aria-label="${escape(gettext("Copy code"))}">` +
    `${escape(gettext("Copy"))}</button>` +
    (options.filename ? downloadButton(options.filename) : "") +
    `</div>` +
    `<pre><code class="${codeClass}">${highlightCode(code, language)}\n</code></pre>` +
    expand +
    `</div>`
  );
}

/**
 * Shows all of a collapsed code block's lines when its button is clicked, or collapses it again.
 * Clicks on anything else are ignored.
 *
 * :returns: whether the click was on a code block's expand button.
 */
export function toggleCodeBlock(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(`button.${EXPAND_BUTTON_CLASS}`);
  const block = button?.closest(`.${CODE_BLOCK_CLASS}`);
  if (!button || !block) return false;
  const collapsed = block.classList.toggle(COLLAPSED_CLASS);
  button.setAttribute("aria-expanded", String(!collapsed));
  button.textContent = collapsed ? expandLabel(Number(button.dataset.lines)) : gettext("Show fewer lines");
  return true;
}

/**
 * Copies a code block's code to the clipboard when its copy button is clicked, and shows that it
 * did on the button for a moment. Clicks on anything else are ignored.
 *
 * :returns: whether the click was on a copy button.
 */
export function copyCodeBlock(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(`button.${COPY_BUTTON_CLASS}`);
  const code = button?.closest(`.${CODE_BLOCK_CLASS}`)?.querySelector("pre code");
  if (!button || !code) return false;
  const text = (code.textContent ?? "").replace(/\n$/, "");
  navigator.clipboard
    ?.writeText(text)
    .then(() => {
      button.textContent = gettext("Copied!");
      setTimeout(() => {
        button.textContent = gettext("Copy");
      }, COPIED_DURATION);
    })
    .catch(() => undefined);
  return true;
}
