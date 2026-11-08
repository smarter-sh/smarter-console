import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  audioHtml,
  downloadMedia,
  filenameOf,
  isAudioUrl,
  isSvgCodeBlock,
  isVideoUrl,
  mediaHtml,
  providerRequestFilename,
  sanitizedSvgDocument,
  saveJson,
  svgDataUrl,
  svgHtml,
  svgExtension,
  toggleSvgCode,
  videoHtml,
} from "./media";
import { codeBlockHtml } from "./code";
import { replaceBrokenImage } from "./messages";

function toElement(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  document.body.append(element);
  return element;
}

describe("sanitizedSvgDocument", () => {
  it("adds the svg namespace, and keeps one that is there", () => {
    expect(sanitizedSvgDocument('<svg viewBox="0 0 1 1"></svg>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
    );
    expect(sanitizedSvgDocument('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
  });

  it("removes scripts, event handlers and foreign html", () => {
    const svg = sanitizedSvgDocument(
      '<svg><script>alert(1)</script><rect onload="alert(2)"/><foreignObject><img src=x onerror=alert(3)></foreignObject></svg>',
    )!;
    expect(svg).toContain("<rect");
    expect(svg).not.toMatch(/script|onload|onerror|foreignObject/i);
  });

  it("returns null for text that is not an svg", () => {
    expect(sanitizedSvgDocument("<div></div>")).toBeNull();
    expect(sanitizedSvgDocument("text <svg></svg>")).toBeNull();
  });

  it("returns null when the sanitized svg is not a single svg element", () => {
    expect(sanitizedSvgDocument("<svg></svg> <b>x</b> </svg>")).toBeNull();
  });
});

describe("svgHtml", () => {
  it("displays an svg as an image of a data url, with a download button", () => {
    const element = toElement(svgHtml('<svg viewBox="0 0 1 1"></svg>')!);
    const image = element.querySelector("img")!;
    expect(image).toHaveAttribute(
      "src",
      svgDataUrl('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'),
    );
    expect(element.querySelector("button.smarter-chat-download")).toHaveAttribute("data-filename", "image.svg");
    expect(element.querySelector(".smarter-chat-code-language")).toHaveTextContent("svg");
    expect(element.querySelector("pre")).toHaveAttribute("hidden");
    element.remove();
  });

  it("has a button that shows its code instead of its image, and back", () => {
    const element = toElement(svgHtml('<svg viewBox="0 0 1 1"><rect/></svg>')!);
    const toggle = element.querySelector<HTMLButtonElement>("button.smarter-chat-svg-toggle")!;
    const image = element.querySelector<HTMLElement>(".smarter-chat-svg-image")!;
    const pre = element.querySelector("pre")!;
    expect(toggle).toHaveTextContent("Code");
    expect(toggle).toHaveAttribute("aria-label", "Show the image's code");

    expect(toggleSvgCode(toggle)).toBe(true);
    expect(pre.hidden).toBe(false);
    expect(image.hidden).toBe(true);
    expect(toggle).toHaveTextContent("Image");
    expect(toggle).toHaveAttribute("aria-label", "Show the image");

    toggleSvgCode(toggle);
    expect(pre.hidden).toBe(true);
    expect(image.hidden).toBe(false);
    expect(toggle).toHaveTextContent("Code");
    element.remove();
  });

  it("ignores clicks on anything else", () => {
    const element = toElement(svgHtml("<svg></svg>")!);
    expect(toggleSvgCode(element.querySelector("img"))).toBe(false);
    expect(toggleSvgCode(null)).toBe(false);
    element.remove();
  });

  it("returns null for text that is not an svg", () => {
    expect(svgHtml("<p>no</p>")).toBeNull();
  });
});

describe("isSvgCodeBlock", () => {
  it("accepts svg, xml, html and unlabeled blocks that are only an svg", () => {
    for (const language of ["svg", "xml", "html", ""]) expect(isSvgCodeBlock("<svg></svg>", language)).toBe(true);
    expect(isSvgCodeBlock("<svg></svg>", "js")).toBe(false);
    expect(isSvgCodeBlock("<svg></svg>\n<p></p>", "html")).toBe(false);
  });
});

describe("svgExtension", () => {
  it("finds an svg at the start of a line", () => {
    const start = svgExtension.start as (source: string) => number | undefined;
    expect(start("text\n<svg></svg>")).toBe(5);
    expect(start("text only")).toBeUndefined();
  });

  it("displays text that is not an svg, once it is sanitized, as text", () => {
    const text = "<svg></svg> <b>x</b> </svg>";
    expect(svgExtension.renderer.call({} as never, { type: "svg", raw: text, text })).toBe(
      "<p>&lt;svg&gt;&lt;/svg&gt; &lt;b&gt;x&lt;/b&gt; &lt;/svg&gt;</p>",
    );
  });
});

describe("isAudioUrl", () => {
  it("accepts audio files and audio data urls", () => {
    expect(isAudioUrl("https://example.com/a.mp3")).toBe(true);
    expect(isAudioUrl("/media/a.WAV?v=1")).toBe(true);
    expect(isAudioUrl("data:audio/mpeg;base64,SUQz")).toBe(true);
  });

  it("refuses other urls", () => {
    expect(isAudioUrl("https://example.com/a.png")).toBe(false);
    expect(isAudioUrl("javascript:alert(1)//.mp3")).toBe(false);
    expect(isAudioUrl("data:text/html;base64,PGI+")).toBe(false);
  });
});

describe("audioHtml", () => {
  it("has no label without a title, and escapes the url", () => {
    const html = audioHtml("https://example.com/a.mp3?x=1&y=2", "");
    expect(html).not.toContain('aria-label=""');
    expect(html).toContain('src="https://example.com/a.mp3?x=1&amp;y=2"');
  });
});

describe("isVideoUrl", () => {
  it("accepts video files and video data urls", () => {
    expect(isVideoUrl("https://example.com/a.mp4")).toBe(true);
    expect(isVideoUrl("/media/a.WEBM?v=1")).toBe(true);
    expect(isVideoUrl("https://example.com/a.mov#t=10")).toBe(true);
    expect(isVideoUrl("data:video/mp4;base64,AAAA")).toBe(true);
  });

  it("refuses other urls", () => {
    expect(isVideoUrl("https://example.com/a.mp3")).toBe(false);
    expect(isVideoUrl("javascript:alert(1)//.mp4")).toBe(false);
    expect(isVideoUrl("data:text/html;base64,PGI+")).toBe(false);
  });
});

describe("videoHtml", () => {
  it("is a video player with a download button, labeled by its title, and escapes the url", () => {
    const html = videoHtml("https://example.com/intro.mp4?x=1&y=2", "The intro");
    expect(html).toContain('<video class="smarter-chat-video" controls preload="metadata"');
    expect(html).toContain('src="https://example.com/intro.mp4?x=1&amp;y=2"');
    expect(html).toContain('aria-label="The intro"');
    expect(html).toContain('data-filename="intro.mp4"');
    expect(videoHtml("data:video/webm;base64,AAAA", "")).not.toContain('aria-label=""');
    expect(videoHtml("data:video/webm;base64,AAAA", "")).toContain('data-filename="video.webm"');
  });
});

describe("filenameOf", () => {
  it("names a file by its url's path, or by its type", () => {
    expect(filenameOf("https://example.com/images/fog%20bank.jpg?w=1", "image")).toBe("fog bank.jpg");
    expect(filenameOf("data:image/png;base64,AAAA", "image")).toBe("image.png");
    expect(filenameOf("data:application/x-unknown;base64,AAAA", "file")).toBe("file.bin");
    expect(filenameOf("https://example.com/", "image")).toBe("image");
    expect(filenameOf("https://example.com/%E0%A4%A", "image")).toBe("image");
  });
});

describe("providerRequestFilename", () => {
  it("names the file after the LLMClient, without characters that file names can't have", () => {
    expect(providerRequestFilename("stackademy_sql")).toBe("stackademy_sql-request.json");
    expect(providerRequestFilename("../a b/c")).toBe("a_b_c-request.json");
    expect(providerRequestFilename("")).toBe("smarter-chat-request.json");
    expect(providerRequestFilename(undefined)).toBe("smarter-chat-request.json");
  });
});

describe("saveJson", () => {
  afterEach(() => vi.restoreAllMocks());

  it("saves indented JSON as a file", async () => {
    const clicked: { href: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    let blob: Blob | undefined;
    URL.createObjectURL = vi.fn((value: Blob) => {
      blob = value;
      return "blob:https://example.com/2";
    }) as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn();
    saveJson({ model: "gpt-4o-mini" }, "a-request.json");
    expect(clicked).toEqual([{ href: "blob:https://example.com/2", download: "a-request.json" }]);
    expect(blob?.type).toBe("application/json");
    expect(await blob?.text()).toBe('{\n  "model": "gpt-4o-mini"\n}\n');
    expect(document.querySelector("a")).toBeNull();
    await vi.waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:https://example.com/2"));
  });
});

describe("downloadMedia", () => {
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
    URL.createObjectURL = vi.fn(() => "blob:https://example.com/1");
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const button = (element: HTMLElement) => element.querySelector<HTMLButtonElement>("button.smarter-chat-download")!;

  it("ignores clicks on anything else", () => {
    const element = toElement("<p>text</p>");
    expect(downloadMedia(element.querySelector("p"))).toBe(false);
    expect(downloadMedia(null)).toBe(false);
  });

  it("saves a data url image as its file", () => {
    const element = toElement(svgHtml("<svg></svg>")!);
    expect(downloadMedia(button(element))).toBe(true);
    expect(clicked).toEqual([{ href: expect.stringMatching(/^data:image\/svg\+xml/), download: "image.svg" }]);
  });

  it("saves another site's image, which its server allows, as a file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Blob(["png"]), { status: 200 })),
    );
    const element = toElement(mediaHtml('<img src="https://example.com/a.png">', "a.png"));
    expect(downloadMedia(button(element))).toBe(true);
    await vi.waitFor(() => expect(clicked).toEqual([{ href: "blob:https://example.com/1", download: "a.png" }]));
  });

  it("opens another site's image in a new tab, when its server doesn't allow it to be saved", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 403 })),
    );
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const element = toElement(mediaHtml('<audio src="https://example.com/a.mp3"></audio>', ""));
    downloadMedia(button(element));
    await vi.waitFor(() =>
      expect(open).toHaveBeenCalledWith("https://example.com/a.mp3", "_blank", "noopener,noreferrer"),
    );
    expect(clicked).toEqual([]);
  });

  it("saves a mermaid diagram as an svg file", () => {
    const element = toElement(
      '<div class="smarter-chat-code smarter-chat-mermaid"><div class="smarter-chat-code-header">' +
        mediaHtml("", "diagram.svg").replace(/^<span[^>]*>|<\/span>$/g, "") +
        '</div><div class="smarter-chat-mermaid-diagram"><svg><rect/></svg></div></div>',
    );
    expect(downloadMedia(button(element))).toBe(true);
    expect(clicked).toEqual([{ href: "blob:https://example.com/1", download: "diagram.svg" }]);
  });

  it("saves a video as its file", () => {
    const element = toElement(videoHtml("data:video/mp4;base64,AAAA", ""));
    expect(downloadMedia(button(element))).toBe(true);
    expect(clicked).toEqual([{ href: "data:video/mp4;base64,AAAA", download: "video.mp4" }]);
  });

  it("saves a code block's code as its file", () => {
    let saved: Blob | undefined;
    URL.createObjectURL = vi.fn((blob: Blob) => {
      saved = blob;
      return "blob:https://example.com/2";
    });
    const element = toElement(codeBlockHtml("kind: Plugin\n", "yaml", { filename: "plugin.yaml" }));
    expect(downloadMedia(button(element))).toBe(true);
    expect(clicked).toEqual([{ href: "blob:https://example.com/2", download: "plugin.yaml" }]);
    expect(saved?.type).toBe("text/plain");
  });

  it("ignores a button without media", () => {
    const element = toElement(mediaHtml("<span>nothing</span>", "x"));
    expect(downloadMedia(button(element))).toBe(false);
  });
});

describe("replaceBrokenImage, with a download button", () => {
  it("removes the download button of an image that failed to load", () => {
    const element = toElement(mediaHtml('<img class="smarter-chat-image" src="/x.png" alt="x">', "x.png"));
    expect(replaceBrokenImage(element.querySelector("img"))).toBe(true);
    expect(element.querySelector("button")).toBeNull();
    element.remove();
  });
});
