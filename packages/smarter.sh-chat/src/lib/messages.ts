/**
 * The chat thread: building it from the LLMClient's configuration and history, adding messages to
 * it, and turning it back into the api's messages.
 *
 * Messages are displayed as html (by @chatscope/chat-ui-kit-react). Their text, which comes from the
 * user and from the LLM, is escaped. The user's messages are displayed as they were typed, except
 * for their markdown images and links. The other messages, e.g. the LLM's responses, are markdown.
 */
import DOMPurify from "dompurify";
import { Marked, type Tokens } from "marked";

import type { ApiMessage, ChatMessage } from "../types";
import { codeBlockHtml, codeLanguage } from "./code";
import { dataHtml, isManifest, manifestHtml, prettyJson } from "./data";
import { MessageDirectionEnum, SenderRoleEnum, ValidMessageRolesEnum, type MessageDirection } from "./enums";
import { gettext, interpolate } from "./i18n";
import { mathExtension } from "./math";
import {
  audioHtml,
  filenameOf,
  isAudioUrl,
  isSvgCodeBlock,
  isVideoUrl,
  MEDIA_CLASS,
  mediaHtml,
  svgExtension,
  svgHtml,
  videoHtml,
} from "./media";

/** An assistant's call of a tool. */
type ToolCall = NonNullable<ApiMessage["tool_calls"]>[number];

export const TOOL_CALL_CLASS = "smarter-chat-tool-call";

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

// the urls that messages may link to, and display images from: http(s), and relative to the page.
const URL_PATTERN = String.raw`(?:https?:\/\/|\/)[^\s)"]+`;
// images may also be inline, e.g. from a tool that generates them. Raster formats only: no svg.
const IMAGE_URL_PATTERN = String.raw`(?:${URL_PATTERN}|data:image\/(?:png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+)`;
const IMAGE_PATTERN = String.raw`!\[([^\]]*)\]\((${IMAGE_URL_PATTERN})\)`;

const urlRegex = new RegExp(String.raw`^${URL_PATTERN}$`);
const imageUrlRegex = new RegExp(String.raw`^${IMAGE_URL_PATTERN}$`);
const linkedImageRegex = new RegExp(String.raw`\[${IMAGE_PATTERN}\]\((${URL_PATTERN})\)`, "g");
const imageRegex = new RegExp(IMAGE_PATTERN, "g");
const linkRegex = new RegExp(String.raw`\[([^\]]+)\]\((${URL_PATTERN})\)`, "g");

function anchor(href: string, content: string): string {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>`;
}

const IMAGE_CLASS = "smarter-chat-image";

/**
 * An image, sized to fit its chat bubble by the "smarter-chat-image" css class. See styles.css.
 *
 * It is requested without a Referer: many image hosts refuse, or answer with a blank placeholder, an
 * image that another site's page requests. See replaceBrokenImage() for an image that fails anyway.
 */
function image(src: string, alt: string): string {
  return `<img class="${IMAGE_CLASS}" src="${src}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`;
}

/**
 * Replace a message's image that failed to load with its description, so that the message shows
 * neither a broken image nor an empty gap. A linked image's link, to the image, is kept.
 *
 * Messages are html strings, so SmarterChat calls this from its error listener. See Component.tsx.
 *
 * @param target The element that failed to load.
 * @returns Whether it was a message's image, and was replaced.
 */
export function replaceBrokenImage(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLImageElement) || !target.classList.contains(IMAGE_CLASS)) return false;
  const description = document.createElement("span");
  description.className = "smarter-chat-image-unavailable";
  description.textContent = target.alt.trim() || gettext("Image");
  // the download button of an image that isn't there.
  target.closest(`.${MEDIA_CLASS}`)?.querySelector(":scope > button")?.remove();
  target.replaceWith(description);
  return true;
}

/**
 * Html for a message's text: escaped, with markdown images and links as html.
 *
 * - ``![alt](url)`` is an image, which opens at full size in a new tab, unless it's a data url,
 *   which browsers don't open.
 * - ``[![alt](url)](href)`` is an image that links to href.
 * - ``[text](href)`` is a link, which opens in a new tab.
 *
 * Urls are http(s) or relative to the page. Images may also be base64 png, jpeg, gif or webp data
 * urls. Anything else, e.g. a javascript: url, stays as text.
 */
export function convertMarkdownLinksToHTML(text: string): string {
  return escapeHtml(text)
    .replace(linkedImageRegex, (_match, alt: string, src: string, href: string) => anchor(href, image(src, alt)))
    .replace(imageRegex, (_match, alt: string, src: string) => linkedImage(src, alt))
    .replace(linkRegex, (_match, label: string, href: string) => anchor(href, label));
}

/** An image, which opens at full size in a new tab, unless it's a data url. */
function linkedImage(src: string, alt: string): string {
  return src.startsWith("data:") ? image(src, alt) : anchor(src, image(src, alt));
}

/** An image of a markdown message, with its download button. See media.ts. */
function downloadableImage(src: string, html: string): string {
  return mediaHtml(html, filenameOf(src, "image"));
}

// the languages of code blocks that may be a Smarter manifest.
const MANIFEST_LANGUAGES = ["yaml", "yml", ""];

// GitHub flavored markdown, in which a line break is a line break, as it is in a chat.
// Math, in LaTeX, is typeset. See math.ts. An svg is displayed as its graphic. See media.ts.
const markdown = new Marked({ gfm: true, breaks: true, async: false });
markdown.use(mathExtension);
markdown.use({ extensions: [svgExtension] });
markdown.use({
  // a list item that is only a JSON object or array is pretty printed, as a json code block in the
  // list item, e.g. an LLMClient's example prompts for a JSON api. See prettyJson().
  walkTokens(token) {
    if (token.type !== "list_item") return;
    const item = token as Tokens.ListItem;
    const json = prettyJson(item.text);
    if (json !== null) item.tokens = [{ type: "code", raw: item.text, text: json, lang: "json" } as Tokens.Code];
  },
});
markdown.use({
  renderer: {
    // raw html is displayed as text.
    html({ text }: Tokens.HTML | Tokens.Tag): string {
      return escapeHtml(text);
    },
    link({ href, tokens }: Tokens.Link): string {
      const [only] = tokens;
      if (tokens.length === 1 && only.type === "image") {
        // a linked image: the image, without the link that it would otherwise have.
        const { href: src, text: alt } = only as Tokens.Image;
        if (urlRegex.test(href) && imageUrlRegex.test(src))
          return downloadableImage(src, anchor(escapeHtml(href), image(escapeHtml(src), alt)));
      }
      const content = this.parser.parseInline(tokens);
      return urlRegex.test(href) ? anchor(escapeHtml(href), content) : content;
    },
    // an image, or an audio or video player for an audio or video file. See media.ts.
    image({ href, text }: Tokens.Image): string {
      if (isAudioUrl(href)) return audioHtml(href, text);
      if (isVideoUrl(href)) return videoHtml(href, text);
      return imageUrlRegex.test(href) ? downloadableImage(href, linkedImage(escapeHtml(href), text)) : text;
    },
    // highlighted, with a header of its language and a copy button. See code.ts. A code block that
    // is only an svg is displayed as its graphic. See media.ts. A yaml block that is a Smarter
    // manifest has a download button. See data.ts.
    code({ text, lang }: Tokens.Code): string {
      const language = codeLanguage(lang);
      const svg = isSvgCodeBlock(text, language) ? svgHtml(text) : null;
      if (svg) return svg;
      if (MANIFEST_LANGUAGES.includes(language) && isManifest(text)) return manifestHtml(text);
      return codeBlockHtml(text, lang);
    },
  },
});

/**
 * The markdown renderer's html, without anything that could run a script. Math's MathML, which
 * screen readers read, keeps its LaTeX source in a text-only annotation. See math.ts.
 * (annotation-xml, which may contain html, is still removed.)
 */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["semantics", "annotation"],
    ADD_ATTR: ["target", "encoding", "referrerpolicy", "controls", "preload"],
  });
}

/**
 * Html for a markdown message, e.g. an LLM's response: GitHub flavored markdown, i.e. headings,
 * emphasis, lists, tables, block quotes, code, links and images, and math. Line breaks are kept. Code
 * blocks are syntax highlighted, as GitHub's are. See code.ts. Math, in LaTeX, is typeset by KaTeX.
 * See math.ts.
 *
 * Raw html is displayed as text, except an svg, which is displayed as its graphic. Links and images
 * follow the rules of convertMarkdownLinksToHTML, and images have a download button. An image whose
 * url is an audio or video file's is a player, with a download button. See media.ts. A list item
 * that is only JSON is pretty printed. See data.ts. A message that is a single paragraph is not
 * wrapped in one, so that its chat bubble stays as compact as the text.
 */
export function convertMarkdownToHTML(text: string): string {
  const html = (markdown.parse(text) as string).trim();
  const paragraph = /^<p>([\s\S]*)<\/p>$/.exec(html);
  const unwrapped = paragraph && !paragraph[1].includes("<p>") ? paragraph[1] : html;
  return sanitize(unwrapped);
}

/** The direction of a message from the given sender. */
export function directionOf(sender: string): MessageDirection {
  return sender === SenderRoleEnum.USER ? MessageDirectionEnum.OUTGOING : MessageDirectionEnum.INCOMING;
}

/**
 * Html for a message's text: the user's as they typed it, and the others as markdown. A message
 * that is only data, from anyone, is displayed as data: JSON pretty printed, a Smarter manifest with
 * a download button, CSV or TSV as a table. See data.ts.
 */
export function messageHtml(content: string, sender: string): string {
  const data = dataHtml(content);
  if (data !== null) return sanitize(data);
  return sender === SenderRoleEnum.USER ? convertMarkdownLinksToHTML(content) : convertMarkdownToHTML(content);
}

/**
 * Html for an assistant's tool calls, e.g. "Called stackademy_sql", each of which shows its
 * arguments, pretty printed, when it is opened.
 */
export function toolCallsHtml(toolCalls: ToolCall[]): string {
  const calls = toolCalls.map(({ function: call }) => {
    // Translators: an assistant called a tool, e.g. "Called stackademy_sql".
    const summary = interpolate(escapeHtml(gettext("Called %(tool)s")), {
      tool: `<code>${escapeHtml(call.name)}</code>`,
    });
    const args = call.arguments ?? "";
    const json = prettyJson(args);
    const code = json === null ? codeBlockHtml(args) : codeBlockHtml(json, "json");
    return `<details class="${TOOL_CALL_CLASS}"><summary>${summary}</summary>${code}</details>`;
  });
  return sanitize(calls.join(""));
}

/**
 * A new chat message. Messages without text stay in the thread, so that they are sent back to the
 * api, but are not displayed, except an assistant's tool calls, which are metadata: displayed, as
 * the backend's own messages are, only in sandbox mode. See toggleMetadataMessages.
 */
export function messageFactory(
  content: ApiMessage["content"],
  sender: string,
  originalMessage?: ApiMessage,
  direction: MessageDirection = directionOf(sender),
): ChatMessage {
  const hasText = typeof content === "string" && content !== "";
  const toolCalls = !hasText && originalMessage?.tool_calls?.length ? originalMessage.tool_calls : null;
  return {
    message: hasText ? messageHtml(content, sender) : toolCalls ? toolCallsHtml(toolCalls) : "",
    content: content ?? null,
    direction,
    sender,
    sentTime: new Date().toLocaleString(),
    display: hasText || !!toolCalls,
    originalMessage,
    ...(toolCalls ? { metadata: true } : {}),
  };
}

/** Whether a message is metadata, displayed only in sandbox mode: the backend's, or an assistant's tool calls. */
export function isMetadataMessage(message: ChatMessage, metadataRoles: readonly string[]): boolean {
  return !!message.metadata || metadataRoles.includes(message.sender);
}

/** The thread of a chat session, from the messages that the backend saved. */
export function chatRestoreFromBackend(chatHistory: ApiMessage[] | null | undefined): ChatMessage[] {
  return (chatHistory ?? [])
    .filter((message) => message && typeof message === "object" && typeof message.role === "string")
    .map((message) => messageFactory(message.content, message.role, message));
}

/** Example prompts, which help the user to get started, as a markdown list. */
export function examplePrompts(prompts: string[] | null | undefined): string {
  if (!prompts || prompts.length === 0) {
    return "";
  }
  return (
    gettext("Some example prompts to get you started:") + "\n\n" + prompts.map((prompt) => `- ${prompt}\n`).join("")
  );
}

/** The thread of a new chat session: the system role, the welcome message, and example prompts. */
export function chatIntro(welcomeMessage: string, systemRole: string, prompts: string[] | null | undefined) {
  const messages = [
    messageFactory(systemRole, SenderRoleEnum.SYSTEM),
    messageFactory(welcomeMessage, SenderRoleEnum.ASSISTANT),
  ];
  const examples = examplePrompts(prompts);
  if (examples) {
    messages.push(messageFactory(examples, SenderRoleEnum.ASSISTANT));
  }
  return messages;
}

/** The thread of a chat session: its saved history, or the introduction to a new one. */
export function chatInit(
  welcomeMessage: string,
  systemRole: string,
  prompts: string[] | null | undefined,
  chatHistory: ApiMessage[] | null | undefined,
): ChatMessage[] {
  const messages = chatRestoreFromBackend(chatHistory);
  return messages.length > 0 ? messages : chatIntro(welcomeMessage, systemRole, prompts);
}

/**
 * The thread as the api's messages: those the LLM accepts, without Smarter's own. The api's
 * original messages keep their other fields, e.g. an assistant's tool_calls.
 */
export function chatMessages2RequestMessages(messages: ChatMessage[]): ApiMessage[] {
  return messages
    .filter((message) => (ValidMessageRolesEnum as string[]).includes(message.sender))
    .map((message) => ({ ...message.originalMessage, role: message.sender, content: message.content }));
}

/** Shows or hides the backend's messages (smarter, system and tool), and always shows the rest. */
export function toggleMetadataMessages(messages: ChatMessage[], show: boolean, metadataRoles: string[]): ChatMessage[] {
  return messages.map((message) => {
    if (!message.message) {
      return { ...message, display: false };
    }
    return { ...message, display: isMetadataMessage(message, metadataRoles) ? show : true };
  });
}

/** Removes html tags, which pasting text into the message input tends to add. */
export function sanitizeInput(text: string): string {
  return text.replace(/<[^>]+>/g, "");
}
