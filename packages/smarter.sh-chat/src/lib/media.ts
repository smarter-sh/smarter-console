/**
 * Media in markdown messages: images, svg graphics and audio, each with a download button.
 *
 * - An svg that the LLM writes as raw markup, e.g. ``<svg viewBox="0 0 520 340">...</svg>`` on lines
 *   of its own, or in a code block whose language is svg (or xml, or html, if the block is only an
 *   svg), is displayed as a code block (see code.ts) that shows the graphic, with a button in its
 *   header that shows its code instead, and back, as a mermaid diagram's does. The graphic is
 *   sanitized, then displayed by an ``img`` with a data url, in which browsers never run scripts.
 *   Any other raw html is still displayed as text. See messages.ts.
 * - ``![alt](url)`` whose url is an audio file (mp3, wav, ogg, oga, m4a, flac, opus), or a base64
 *   audio data url, is an audio player, and one whose url is a video file (mp4, webm, mov, m4v,
 *   ogv), or a base64 video data url, is a video player.
 * - Images, svg graphics, audio, video and mermaid diagrams have a download button, as does a code
 *   block that has a file name, e.g. a Smarter manifest's. See code.ts. The buttons work by
 *   event delegation, as the code blocks' copy button does, because messages are html strings
 *   rather than React elements. See downloadMedia, toggleSvgCode, and SmarterChat's onClick.
 */
import DOMPurify from "dompurify";
import type { RendererExtension, TokenizerExtension, Tokens } from "marked";

import {
  CODE_BLOCK_CLASS,
  COPY_BUTTON_CLASS,
  DOWNLOAD_BUTTON_CLASS,
  downloadButton,
  highlightCode,
  MERMAID_BLOCK_CLASS,
} from "./code";
import { gettext, pgettext } from "./i18n";

export { DOWNLOAD_BUTTON_CLASS, downloadButton };

export const MEDIA_CLASS = "smarter-chat-media";
export const SVG_CLASS = "smarter-chat-svg";
// the code block of an svg, its graphic, and the button that shows its code, or the graphic.
export const SVG_BLOCK_CLASS = "smarter-chat-svg-block";
export const SVG_IMAGE_CLASS = "smarter-chat-svg-image";
export const SVG_TOGGLE_BUTTON_CLASS = "smarter-chat-svg-toggle";
export const AUDIO_CLASS = "smarter-chat-audio";
export const VIDEO_CLASS = "smarter-chat-video";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
// an svg document: an optional xml declaration, then one svg element.
const SVG_DOCUMENT = /^\s*(?:<\?xml[^>]*\?>\s*)?(<svg\b[\s\S]*<\/svg>)\s*$/i;
// the languages of code blocks that are displayed as their svg, if they are only an svg.
const SVG_LANGUAGES = ["svg", "xml", "html", ""];

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

/** An svg's markup, without anything that could run a script, but with its own styles. */
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ["style"] });
}

/**
 * An svg document's sanitized markup, with its namespace, which a standalone svg file needs, or
 * null if the text is not an svg, or nothing is left of it once it is sanitized.
 */
export function sanitizedSvgDocument(text: string): string | null {
  const match = SVG_DOCUMENT.exec(text);
  if (!match) return null;
  const svg = sanitizeSvg(match[1]).trim();
  // e.g. "<svg></svg> text </svg>", whose text would make the document invalid.
  if (!/^<svg\b[\s\S]*<\/svg>$/i.test(svg)) return null;
  return /^<svg\b[^>]*\sxmlns=/i.test(svg) ? svg : svg.replace(/^<svg\b/i, `<svg xmlns="${SVG_NAMESPACE}"`);
}

/** A data url of an svg document, which an ``img`` displays. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Media (html of an image, an svg or an audio player) with its download button. */
export function mediaHtml(html: string, filename: string): string {
  return `<span class="${MEDIA_CLASS}">${html}${downloadButton(filename)}</span>`;
}

interface ToggleLabels {
  label: string;
  name: string;
}

/** The text and the accessible name of the button that shows an svg's code. */
function showCodeLabels(): ToggleLabels {
  // Translators: a button that shows the code of an svg image, instead of the image.
  return { label: pgettext("button", "Code"), name: gettext("Show the image's code") };
}

/** The text and the accessible name of the button that shows an svg's image again, instead of its code. */
function showImageLabels(): ToggleLabels {
  // Translators: a button that shows an svg image, instead of its code.
  return { label: pgettext("button", "Image"), name: gettext("Show the image") };
}

/**
 * Html for an svg document, or null if it isn't an svg: a code block whose header has the language,
 * a button that shows its code instead of its graphic, and back, a copy button and a download
 * button. The graphic is displayed first, and the code, which is the LLM's, is hidden.
 */
export function svgHtml(text: string): string | null {
  const svg = sanitizedSvgDocument(text);
  if (!svg) return null;
  const alt = escape(gettext("SVG image"));
  const toggle = showCodeLabels();
  return (
    `<div class="${CODE_BLOCK_CLASS} ${SVG_BLOCK_CLASS}">` +
    `<div class="${CODE_BLOCK_CLASS}-header">` +
    `<span class="${CODE_BLOCK_CLASS}-language">svg</span>` +
    `<button type="button" class="${SVG_TOGGLE_BUTTON_CLASS}" aria-label="${escape(toggle.name)}">` +
    `${escape(toggle.label)}</button>` +
    `<button type="button" class="${COPY_BUTTON_CLASS}" aria-label="${escape(gettext("Copy code"))}">` +
    `${escape(gettext("Copy"))}</button>` +
    downloadButton("image.svg") +
    `</div>` +
    `<div class="${SVG_IMAGE_CLASS}">` +
    `<img class="smarter-chat-image ${SVG_CLASS}" src="${svgDataUrl(svg)}" alt="${alt}">` +
    `</div>` +
    `<pre hidden><code class="hljs language-xml">${highlightCode(text.trim(), "xml")}\n</code></pre>` +
    `</div>`
  );
}

/**
 * Shows an svg's code instead of its graphic, or the graphic again, when its button is clicked.
 * Clicks on anything else are ignored.
 *
 * :returns: whether the click was on an svg's button.
 */
export function toggleSvgCode(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(`button.${SVG_TOGGLE_BUTTON_CLASS}`);
  const block = button?.closest(`.${SVG_BLOCK_CLASS}`);
  const image = block?.querySelector<HTMLElement>(`.${SVG_IMAGE_CLASS}`);
  const pre = block?.querySelector("pre");
  if (!button || !image || !pre) return false;
  const showCode = pre.hidden;
  pre.hidden = !showCode;
  image.hidden = showCode;
  const next = showCode ? showImageLabels() : showCodeLabels();
  button.textContent = next.label;
  button.setAttribute("aria-label", next.name);
  return true;
}

/** Whether a code block of this language and text is an svg, which is displayed as its graphic. */
export function isSvgCodeBlock(text: string, language: string): boolean {
  return SVG_LANGUAGES.includes(language) && SVG_DOCUMENT.test(text);
}

const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "oga", "m4a", "flac", "opus"];
const audioUrlRegex = new RegExp(
  String.raw`^(?:(?:https?:\/\/|\/)[^\s)"?#]+\.(?:${AUDIO_EXTENSIONS.join("|")})(?:[?#][^\s)"]*)?` +
    String.raw`|data:audio\/(?:mpeg|mp3|wav|x-wav|ogg|mp4|aac|flac|webm);base64,[A-Za-z0-9+/=]+)$`,
  "i",
);

/** Whether a url is an audio file's, or an audio data url. */
export function isAudioUrl(url: string): boolean {
  return audioUrlRegex.test(url);
}

/** Html for an audio player, with its download button. The url must be one that isAudioUrl accepts. */
export function audioHtml(src: string, title: string): string {
  const label = title ? ` aria-label="${escape(title)}" title="${escape(title)}"` : "";
  return mediaHtml(
    `<audio class="${AUDIO_CLASS}" controls preload="metadata" src="${escape(src)}"${label}></audio>`,
    filenameOf(src, "audio"),
  );
}

const VIDEO_EXTENSIONS = ["mp4", "webm", "mov", "m4v", "ogv"];
const videoUrlRegex = new RegExp(
  String.raw`^(?:(?:https?:\/\/|\/)[^\s)"?#]+\.(?:${VIDEO_EXTENSIONS.join("|")})(?:[?#][^\s)"]*)?` +
    String.raw`|data:video\/(?:mp4|webm|ogg|quicktime);base64,[A-Za-z0-9+/=]+)$`,
  "i",
);

/** Whether a url is a video file's, or a video data url. */
export function isVideoUrl(url: string): boolean {
  return videoUrlRegex.test(url);
}

/** Html for a video player, with its download button. The url must be one that isVideoUrl accepts. */
export function videoHtml(src: string, title: string): string {
  const label = title ? ` aria-label="${escape(title)}" title="${escape(title)}"` : "";
  return mediaHtml(
    `<video class="${VIDEO_CLASS}" controls preload="metadata" src="${escape(src)}"${label}></video>`,
    filenameOf(src, "video"),
  );
}

const EXTENSIONS_BY_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/flac": "flac",
  "audio/webm": "webm",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/ogg": "ogv",
  "video/quicktime": "mov",
};

/**
 * The file name to save a url's media as: the last segment of its path, or, for a data url or a path
 * without one, the fallback name with the extension of its type.
 */
export function filenameOf(url: string, fallback: string): string {
  const dataUrl = /^data:([^;,]+)/i.exec(url);
  if (dataUrl) return `${fallback}.${EXTENSIONS_BY_TYPE[dataUrl[1].toLowerCase()] ?? "bin"}`;
  try {
    const name = decodeURIComponent(new URL(url, "https://example.com").pathname.split("/").pop() ?? "");
    return name.replace(/[\\/:*?"<>|]/g, "_") || fallback;
  } catch {
    return fallback;
  }
}

// a raw svg on lines of its own, which may have blank lines within it.
const svgBlockRegex = /^ {0,3}(?:<\?xml[^>\n]*\?>\s*)?<svg\b[\s\S]*?<\/svg>[ \t]*(?:\n+|$)/i;

/**
 * A marked extension that displays a raw svg, which starts a line, as its graphic. Text that is
 * not an svg, once it is sanitized, is displayed as text, as other raw html is.
 */
export const svgExtension: TokenizerExtension & RendererExtension = {
  name: "svg",
  level: "block",
  start(source: string) {
    const index = source.search(/^ {0,3}(?:<\?xml[^>\n]*\?>\s*)?<svg\b/im);
    return index < 0 ? undefined : index;
  },
  tokenizer(source: string) {
    const match = svgBlockRegex.exec(source);
    return match ? { type: "svg", raw: match[0], text: match[0].trim() } : undefined;
  },
  renderer(token: Tokens.Generic) {
    return svgHtml(token.text as string) ?? `<p>${escape(token.text as string)}</p>`;
  },
};

/** A temporary url of a file's text. */
function textUrl(text: string, type: string): { url: string; revoke: boolean } {
  return { url: URL.createObjectURL(new Blob([text], { type })), revoke: true };
}

/**
 * The url of the media beside a download button: an image, an audio or video player, an svg, a
 * mermaid diagram, or a code block's code.
 */
function mediaUrl(media: Element): { url: string; revoke: boolean } | null {
  const src = media
    .querySelector(`:scope > img, :scope > a > img, :scope > audio, :scope > video, :scope > .${SVG_IMAGE_CLASS} > img`)
    ?.getAttribute("src");
  if (src) return { url: src, revoke: false };
  const svg = media.querySelector(".smarter-chat-mermaid-diagram > svg");
  if (svg) return textUrl(new XMLSerializer().serializeToString(svg), "image/svg+xml");
  const code = media.matches(`.${CODE_BLOCK_CLASS}`) ? media.querySelector(":scope > pre code") : null;
  return code ? textUrl(code.textContent ?? "", "text/plain") : null;
}

/** Saves a url as filename, with a temporary link. */
function save(url: string, filename: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
}

/** The file name of the downloaded provider request: the LLMClient's name, without characters that file names can't have. */
export function providerRequestFilename(name: string | null | undefined): string {
  const safeName = (name ?? "").replace(/[^\w.-]+/g, "_").replace(/^[._]+/, "");
  return `${safeName || "smarter-chat"}-request.json`;
}

/** Saves a JSON value as a file named filename, indented as a person would write it. */
export function saveJson(value: unknown, filename: string): void {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  save(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Saves another site's media. Its server must allow it (CORS) for the browser to save it as a
 * file. Otherwise, it opens in a new tab, from which the user can save it.
 */
async function saveRemote(url: string, filename: string): Promise<void> {
  try {
    const response = await fetch(url, { referrerPolicy: "no-referrer" });
    if (!response.ok) throw new Error(`${response.status}`);
    const blobUrl = URL.createObjectURL(await response.blob());
    save(blobUrl, filename);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Saves the media beside a download button when it is clicked: an image, an svg graphic, an audio
 * or video clip, a mermaid diagram, or a code block's code. Clicks on anything else are ignored.
 *
 * :returns: whether the click was on a download button.
 */
export function downloadMedia(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const button = target.closest<HTMLButtonElement>(`button.${DOWNLOAD_BUTTON_CLASS}`);
  const media = button?.closest(`.${MEDIA_CLASS}, .${MERMAID_BLOCK_CLASS}, .${SVG_BLOCK_CLASS}, .${CODE_BLOCK_CLASS}`);
  const source = media ? mediaUrl(media) : null;
  if (!button || !source) return false;
  const filename = button.dataset.filename || "download";
  if (source.url.startsWith("data:") || source.url.startsWith("blob:")) {
    save(source.url, filename);
    if (source.revoke) setTimeout(() => URL.revokeObjectURL(source.url), 0);
  } else {
    void saveRemote(source.url, filename);
  }
  return true;
}
