import { describe, expect, it } from "vitest";

import { chatHistory } from "@/mocks/fixtures";
import type { ApiMessage } from "@/types";

import { CODE_BLOCK_CLASS } from "./code";
import { MetadataRolesEnum } from "./enums";
import {
  chatInit,
  chatIntro,
  chatMessages2RequestMessages,
  convertMarkdownLinksToHTML,
  convertMarkdownToHTML,
  examplePrompts,
  messageFactory,
  messageHtml,
  replaceBrokenImage,
  sanitizeInput,
  toggleMetadataMessages,
  toolCallsHtml,
  TOOL_CALL_CLASS,
} from "./messages";

describe("convertMarkdownLinksToHTML", () => {
  it("converts markdown links to html links, which open in a new tab", () => {
    expect(convertMarkdownLinksToHTML("See [the docs](https://docs.smarter.sh).")).toBe(
      'See <a href="https://docs.smarter.sh" target="_blank" rel="noopener noreferrer">the docs</a>.',
    );
  });

  it("escapes html, so that a message cannot inject markup or scripts", () => {
    expect(convertMarkdownLinksToHTML('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("does not link javascript: urls", () => {
    expect(convertMarkdownLinksToHTML("[click](javascript:alert(1))")).not.toContain("<a");
  });
});

describe("convertMarkdownLinksToHTML, with images", () => {
  const img = (src: string, alt: string) =>
    `<img class="smarter-chat-image" src="${src}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer">`;
  const link = (href: string, content: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>`;

  it("displays a markdown image, which opens at full size in a new tab", () => {
    expect(convertMarkdownLinksToHTML("A chart: ![sales by month](https://example.com/chart.png)")).toBe(
      `A chart: ${link("https://example.com/chart.png", img("https://example.com/chart.png", "sales by month"))}`,
    );
  });

  it("displays an image from a relative url, with an empty alt text", () => {
    expect(convertMarkdownLinksToHTML("![](/static/logo.png)")).toBe(
      link("/static/logo.png", img("/static/logo.png", "")),
    );
  });

  it("displays a linked image, which opens its link", () => {
    expect(convertMarkdownLinksToHTML("[![logo](/static/logo.png)](https://smarter.sh)")).toBe(
      link("https://smarter.sh", img("/static/logo.png", "logo")),
    );
  });

  it("displays a raster data url image without a link, which browsers wouldn't open", () => {
    const src = "data:image/png;base64,iVBORw0KGgo=";
    expect(convertMarkdownLinksToHTML(`![dot](${src})`)).toBe(img(src, "dot"));
  });

  it("does not display svg data urls, or javascript: urls, as images", () => {
    expect(convertMarkdownLinksToHTML("![x](data:image/svg+xml;base64,PHN2Zz4=)")).not.toContain("<img");
    expect(convertMarkdownLinksToHTML("![x](javascript:alert(1))")).not.toContain("<img");
  });

  it("escapes the alt text and the url, so that an image cannot inject markup", () => {
    const html = convertMarkdownLinksToHTML('![<b onmouseover="x">](https://example.com/a.png?x=1&y=2)');
    expect(html).toContain('alt="&lt;b onmouseover=&quot;x&quot;&gt;"');
    expect(html).toContain('src="https://example.com/a.png?x=1&amp;y=2"');
  });

  it("displays images and links in the same message", () => {
    const html = convertMarkdownLinksToHTML("![a](/a.png) and [b](/b)");
    expect(html).toBe(`${link("/a.png", img("/a.png", "a"))} and ${link("/b", "b")}`);
  });
});

describe("convertMarkdownToHTML", () => {
  const link = (href: string, content: string) =>
    `<a href="${href}" target="_blank" rel="noopener noreferrer">${content}</a>`;

  it("renders a single paragraph without wrapping it, and keeps its line breaks", () => {
    expect(convertMarkdownToHTML("**bold**, *italic*, ~~struck~~ and `code`\nnext line")).toBe(
      "<strong>bold</strong>, <em>italic</em>, <del>struck</del> and <code>code</code><br>next line",
    );
  });

  it("renders headings, lists, block quotes, tables and code blocks", () => {
    const html = convertMarkdownToHTML(
      "# Title\n\ntext\n\n- one\n- two\n\n1. first\n\n> quoted\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```py\nx = 1 < 2\n```",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<p>text</p>");
    expect(html).toContain("<ul>\n<li>one</li>\n<li>two</li>\n</ul>");
    expect(html).toContain("<ol>\n<li>first</li>\n</ol>");
    expect(html).toContain("<blockquote>\n<p>quoted</p>\n</blockquote>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>2</td>");
    expect(html).toContain('<div class="smarter-chat-code">');
    expect(html).toContain('<span class="smarter-chat-code-language">py</span>');
    expect(html).toContain('<button type="button" class="smarter-chat-code-copy" aria-label="Copy code">Copy</button>');
    expect(html).toContain(
      '<pre><code class="hljs language-py">x = <span class="hljs-number">1</span> &lt; <span class="hljs-number">2</span>\n</code></pre>',
    );
  });

  it("renders links, bare urls and images as convertMarkdownLinksToHTML does, with a download button", () => {
    const download = (filename: string) =>
      `<button type="button" class="smarter-chat-download" data-filename="${filename}" aria-label="Download" ` +
      `title="Download">Download</button>`;
    const media = (html: string, filename: string) =>
      `<span class="smarter-chat-media">${html}${download(filename)}</span>`;
    expect(convertMarkdownToHTML("See [the docs](https://docs.smarter.sh).")).toBe(
      `See ${link("https://docs.smarter.sh", "the docs")}.`,
    );
    expect(convertMarkdownToHTML("visit https://example.com")).toBe(
      `visit ${link("https://example.com", "https://example.com")}`,
    );
    expect(convertMarkdownToHTML("[![logo](/static/logo.png)](https://smarter.sh)")).toBe(
      media(
        link(
          "https://smarter.sh",
          '<img class="smarter-chat-image" src="/static/logo.png" alt="logo" loading="lazy" referrerpolicy="no-referrer">',
        ),
        "logo.png",
      ),
    );
    expect(convertMarkdownToHTML("![dot](data:image/png;base64,iVBORw0KGgo=)")).toBe(
      media(
        '<img class="smarter-chat-image" src="data:image/png;base64,iVBORw0KGgo=" alt="dot" loading="lazy" referrerpolicy="no-referrer">',
        "image.png",
      ),
    );
  });

  it("displays a raw svg, or a code block that is only an svg, as its graphic, without its scripts", () => {
    const svg =
      '<svg viewBox="0 0 10 10">\n  <circle cx="5" cy="5" r="3" onclick="alert(1)"/>\n\n  <script>alert(2)</script>\n</svg>';
    for (const text of [`Here it is:\n${svg}\nEnjoy!`, "```svg\n" + svg + "\n```", "```xml\n" + svg + "\n```"]) {
      const element = document.createElement("div");
      element.innerHTML = convertMarkdownToHTML(text);
      const image = element.querySelector<HTMLImageElement>("img.smarter-chat-svg")!;
      expect(image).toHaveAttribute("alt", "SVG image");
      const source = decodeURIComponent(image.getAttribute("src")!.replace("data:image/svg+xml;charset=utf-8,", ""));
      expect(source).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(source).toContain("<circle");
      expect(source).not.toMatch(/script|onclick/);
      expect(element.querySelector("button.smarter-chat-download")).toHaveAttribute("data-filename", "image.svg");
      // the code is there, for the image's Code button, but hidden.
      expect(element.querySelector("pre")).not.toBeVisible();
      expect(element.querySelector("pre code")).toHaveTextContent("onclick");
    }
  });

  it("keeps other html, and code blocks that are more than an svg, as text", () => {
    expect(convertMarkdownToHTML("<div>\n<svg></svg>\n</div>")).not.toContain("<img");
    expect(convertMarkdownToHTML("```js\nconst svg = '<svg></svg>';\n```")).toContain("<pre>");
    expect(convertMarkdownToHTML("```xml\n<svg></svg>\n<other/>\n```")).toContain("<pre>");
  });

  it("displays an audio file as an audio player, with a download button", () => {
    const element = document.createElement("div");
    element.innerHTML = convertMarkdownToHTML("![a jingle](https://example.com/sounds/jingle.mp3)");
    const audio = element.querySelector("audio")!;
    expect(audio).toHaveAttribute("src", "https://example.com/sounds/jingle.mp3");
    expect(audio).toHaveAttribute("controls");
    expect(audio).toHaveAttribute("aria-label", "a jingle");
    expect(element.querySelector("button.smarter-chat-download")).toHaveAttribute("data-filename", "jingle.mp3");
  });

  it("displays raw html as text, and does not link or display unsafe urls", () => {
    expect(convertMarkdownToHTML('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(convertMarkdownToHTML("[click](javascript:alert(1))")).toBe("click");
    expect(convertMarkdownToHTML("![x](data:image/svg+xml;base64,PHN2Zz4=)")).toBe("x");
    expect(convertMarkdownToHTML("[![x](javascript:alert(1))](https://smarter.sh)")).not.toContain("<img");
  });

  it("displays an image, and links, whose url has parentheses, e.g. an image CDN's resizing filters", () => {
    // markdown allows balanced parentheses in a url, and an image search often returns such urls.
    const src = "https://example.com/thmb/x=/1500x0/filters:no_upscale():format(webp)/photo.jpg";
    const html = convertMarkdownToHTML(`![A skyline](${src})`);
    expect(html).toContain(`<img class="smarter-chat-image" src="${src}" alt="A skyline"`);
    expect(convertMarkdownToHTML(`[the photo](${src})`)).toContain(`<a href="${src}"`);
    expect(convertMarkdownToHTML(`[![A skyline](${src})](${src})`)).toContain(`src="${src}"`);
  });
});

describe("messageHtml", () => {
  it("displays the user's messages as they were typed, and the others as markdown", () => {
    expect(messageHtml("# not a heading", "user")).toBe("# not a heading");
    expect(messageHtml("# a heading", "assistant")).toBe("<h1>a heading</h1>");
  });

  it.each(["user", "assistant"])("pretty prints a %s message that is only a JSON object", (sender) => {
    const html = messageHtml(' {"name": "Revolution Day", "prefix": "rd"} ', sender);
    expect(html).toContain(`class="${CODE_BLOCK_CLASS}"`);
    expect(html).toContain("language-json");
    const text = new DOMParser().parseFromString(html, "text/html").querySelector("code")?.textContent;
    expect(text).toBe('{\n  "name": "Revolution Day",\n  "prefix": "rd"\n}\n');
  });

  it("escapes the html in a JSON message", () => {
    const html = messageHtml('{"a": "<img src=x onerror=alert(1)>"}', "user");
    expect(html).not.toContain("<img");
  });
});

describe("messageHtml, for data", () => {
  it("pretty prints JSON that a tool returned as a JSON string", () => {
    const html = messageHtml(JSON.stringify('{"course_code":"CS210"}'), "tool");
    expect(new DOMParser().parseFromString(html, "text/html").querySelector("code")?.textContent).toBe(
      '{\n  "course_code": "CS210"\n}\n',
    );
  });

  it("displays a Smarter manifest as yaml, with a download button, from anyone", () => {
    const manifest = "apiVersion: smarter.sh/v1\nkind: Plugin\nmetadata:\n  name: stackademy_sql\n";
    for (const sender of ["user", "assistant"]) {
      const html = messageHtml(manifest, sender);
      expect(html).toContain("language-yaml");
      expect(html).toContain('data-filename="stackademy_sql.yaml"');
    }
  });

  it("displays CSV as a table", () => {
    const html = messageHtml("code,name,price\nCS210,AI,700\nCS110,Python,500", "assistant");
    expect(html).toContain('<table class="smarter-chat-csv">');
    expect(html).toContain("<td>Python</td>");
  });
});

describe("convertMarkdownToHTML, for media and manifests", () => {
  it("displays a markdown image whose url is a video as a video player", () => {
    const html = convertMarkdownToHTML("![The intro](https://example.com/intro.mp4)");
    expect(html).toContain('<video class="smarter-chat-video" controls="" preload="metadata"');
    expect(html).toContain('data-filename="intro.mp4"');
  });

  it("gives a yaml code block that is a manifest a download button, and leaves other yaml alone", () => {
    const manifest = "```yaml\napiVersion: smarter.sh/v1\nkind: Secret\nmetadata:\n  name: openai\n```";
    expect(convertMarkdownToHTML(manifest)).toContain('data-filename="openai.yaml"');
    expect(convertMarkdownToHTML("```yaml\nname: x\n```")).not.toContain("data-filename");
    expect(convertMarkdownToHTML("```python\napiVersion = 1\nkind = 2\n```")).not.toContain("data-filename");
  });

  it("displays a reply that the LLM's max tokens cut off as well as it can", () => {
    // an unclosed code block is code to the end of the message.
    expect(convertMarkdownToHTML("Here:\n\n```python\nprint(1)\nprint(2")).toContain("language-python");
    // unclosed math, emphasis and inline code are their source.
    expect(convertMarkdownToHTML("The answer:\n\n$$\nx^2 + y")).toContain("x^2 + y");
    expect(convertMarkdownToHTML("Some **bold and `code")).toBe("Some **bold and `code");
  });
});

describe("JSON in a markdown list", () => {
  it("pretty prints a list item that is only JSON, in its list item", () => {
    const html = convertMarkdownToHTML(examplePrompts(['{"name": "World Book Day", "prefix": "wb"}', "plain text"]));
    const items = new DOMParser().parseFromString(html, "text/html").querySelectorAll("ul > li");
    expect(items).toHaveLength(2);
    expect(items[0].querySelector(`.${CODE_BLOCK_CLASS} code.language-json`)?.textContent).toBe(
      '{\n  "name": "World Book Day",\n  "prefix": "wb"\n}\n',
    );
    expect(items[1].innerHTML).toBe("plain text");
  });
});

describe("messageFactory", () => {
  it("displays a message with text, as html, and keeps its text for the api", () => {
    const message = messageFactory("a < b", "user");
    expect(message).toMatchObject({ message: "a &lt; b", content: "a < b", direction: "outgoing", display: true });
  });

  it("keeps a message without text in the thread, without displaying it", () => {
    const message = messageFactory(null, "assistant");
    expect(message).toMatchObject({ message: "", content: null, direction: "incoming", display: false });
  });
});

describe("chatInit", () => {
  it("introduces a new chat session with the system role, the welcome message and example prompts", () => {
    const messages = chatInit("Welcome!", "You are helpful.", ["Hi?"], []);
    expect(messages.map((message) => [message.sender, message.content])).toEqual([
      ["system", "You are helpful."],
      ["assistant", "Welcome!"],
      ["assistant", examplePrompts(["Hi?"])],
    ]);
  });

  it("has no example prompts message without example prompts", () => {
    expect(chatIntro("Welcome!", "You are helpful.", [])).toHaveLength(2);
    expect(examplePrompts(null)).toBe("");
  });

  it("restores a chat session from its history", () => {
    const messages = chatInit("Welcome!", "You are helpful.", [], chatHistory);
    expect(messages).toHaveLength(chatHistory.length);
    expect(messages.filter((message) => message.display)).toHaveLength(chatHistory.length);
    // the assistant's tool calls are metadata, displayed only in sandbox mode.
    expect(messages.filter((message) => message.metadata).map((message) => message.sender)).toEqual(["assistant"]);
  });

  it("introduces a new chat session without a history", () => {
    expect(chatInit("Welcome!", "You are helpful.", [], null)).toHaveLength(2);
    expect(chatInit("Welcome!", "You are helpful.", [], undefined)).toHaveLength(2);
  });
});

describe("chatMessages2RequestMessages", () => {
  it("sends the api's messages back with their original fields and text, without Smarter's own", () => {
    const thread = [
      ...chatInit("", "", [], chatHistory),
      messageFactory("Smarter selected a plugin.", "smarter"),
      messageFactory("What about [links](https://example.com)?", "user"),
    ];
    const request = chatMessages2RequestMessages(thread);
    expect(request).toHaveLength(chatHistory.length + 1);
    expect(request[3]).toEqual(chatHistory[3]);
    expect(request[4]).toEqual(chatHistory[4]);
    expect(request[request.length - 1]).toEqual({ role: "user", content: "What about [links](https://example.com)?" });
  });
});

describe("toolCallsHtml", () => {
  const call = (name: string, args: string) => ({
    id: "call_1",
    type: "function" as const,
    function: { name, arguments: args },
  });

  it("names each tool, and shows its arguments, pretty printed, when opened", () => {
    const html = toolCallsHtml([call("stackademy_sql", '{"description":"AI"}'), call("weather", "not json")]);
    const details = new DOMParser().parseFromString(html, "text/html").querySelectorAll(`details.${TOOL_CALL_CLASS}`);
    expect(details).toHaveLength(2);
    expect(details[0].querySelector("summary")?.innerHTML).toBe("Called <code>stackademy_sql</code>");
    expect(details[0].querySelector("code.language-json")?.textContent).toBe('{\n  "description": "AI"\n}\n');
    expect(details[1].querySelector("pre code")?.textContent).toBe("not json\n");
  });

  it("escapes a tool's name", () => {
    expect(toolCallsHtml([call("<img src=x onerror=alert(1)>", "{}")])).not.toContain("<img");
  });
});

describe("toggleMetadataMessages", () => {
  it("shows an assistant's tool calls only in sandbox mode", () => {
    const toolCalls: ApiMessage = { role: "assistant", content: null, tool_calls: chatHistory[3].tool_calls };
    const thread = [messageFactory(null, "assistant", toolCalls)];
    expect(thread[0]).toMatchObject({ display: true, metadata: true });
    expect(toggleMetadataMessages(thread, false, MetadataRolesEnum)[0].display).toBe(false);
    expect(toggleMetadataMessages(thread, true, MetadataRolesEnum)[0].display).toBe(true);
  });

  it("hides and shows the backend's messages, and always shows the rest", () => {
    const thread = [
      messageFactory("system role", "system"),
      messageFactory("hello", "user"),
      messageFactory(null, "assistant"),
    ];
    const hidden = toggleMetadataMessages(thread, false, MetadataRolesEnum);
    expect(hidden.map((message) => message.display)).toEqual([false, true, false]);
    const shown = toggleMetadataMessages(hidden, true, MetadataRolesEnum);
    expect(shown.map((message) => message.display)).toEqual([true, true, false]);
  });
});

describe("sanitizeInput", () => {
  it("removes html tags", () => {
    expect(sanitizeInput("<span>hello</span> world")).toBe("hello world");
  });
});

describe("replaceBrokenImage", () => {
  const toElement = (html: string) => {
    const element = document.createElement("div");
    element.innerHTML = html;
    return element;
  };

  it("replaces a message's image with its description, and keeps its link", () => {
    const message = toElement(convertMarkdownToHTML("![a foggy Golden Gate](https://images.example.com/fog.jpg)"));
    const image = message.querySelector("img")!;
    expect(image).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(replaceBrokenImage(image)).toBe(true);
    expect(message.querySelector("img")).toBeNull();
    const link = message.querySelector("a")!;
    expect(link).toHaveAttribute("href", "https://images.example.com/fog.jpg");
    expect(link).toHaveTextContent("a foggy Golden Gate");
  });

  it("describes an image without alt text as an image", () => {
    const message = toElement(convertMarkdownToHTML("![](https://images.example.com/fog.jpg)"));
    replaceBrokenImage(message.querySelector("img"));
    expect(message.querySelector(".smarter-chat-image-unavailable")).toHaveTextContent("Image");
  });

  it("leaves other images and elements alone", () => {
    const message = toElement('<img class="cs-avatar" src="/avatar.png" alt="avatar"><p>text</p>');
    expect(replaceBrokenImage(message.querySelector("img"))).toBe(false);
    expect(replaceBrokenImage(message.querySelector("p"))).toBe(false);
    expect(replaceBrokenImage(null)).toBe(false);
    expect(message.querySelector("img")).not.toBeNull();
  });
});
