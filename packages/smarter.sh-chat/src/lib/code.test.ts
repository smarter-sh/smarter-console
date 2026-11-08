import { afterEach, describe, expect, it, vi } from "vitest";

import {
  codeBlockHtml,
  codeLanguage,
  COLLAPSE_LINES,
  COLLAPSED_CLASS,
  copyCodeBlock,
  DOWNLOAD_BUTTON_CLASS,
  highlightCode,
  stripTrailingFence,
  toggleCodeBlock,
} from "./code";

describe("codeLanguage", () => {
  it("is the first word of the fence's info string, in lower case", () => {
    expect(codeLanguage("Python")).toBe("python");
    expect(codeLanguage("  ts title=app.ts")).toBe("ts");
    expect(codeLanguage("")).toBe("");
    expect(codeLanguage(undefined)).toBe("");
  });
});

describe("stripTrailingFence", () => {
  it("removes a closing fence at the end of the last line", () => {
    expect(stripTrailingFence("    }\n)```")).toBe("    }\n)");
    expect(stripTrailingFence("x = 1 ````  ")).toBe("x = 1");
  });

  it("keeps everything else", () => {
    expect(stripTrailingFence("x = 1\n")).toBe("x = 1\n");
    expect(stripTrailingFence('fence = "```"')).toBe('fence = "```"');
    expect(stripTrailingFence("```")).toBe("```");
  });
});

describe("codeBlockHtml, for mermaid", () => {
  it("marks a mermaid block, so that it can be displayed as a diagram", () => {
    expect(codeBlockHtml("graph TD", "mermaid")).toMatch(/^<div class="smarter-chat-code smarter-chat-mermaid">/);
    expect(codeBlockHtml("x = 1", "python")).toMatch(/^<div class="smarter-chat-code">/);
  });
});

describe("highlightCode", () => {
  it("highlights the languages that highlight.js knows, by name or alias", () => {
    expect(highlightCode("import os", "python")).toBe('<span class="hljs-keyword">import</span> os');
    expect(highlightCode("import os", "py")).toBe('<span class="hljs-keyword">import</span> os');
    expect(highlightCode("FROM python:3.12", "dockerfile")).toContain('<span class="hljs-keyword">FROM</span>');
    expect(highlightCode("server { listen 80; }", "nginx")).toContain("hljs-");
    expect(highlightCode("Get-ChildItem", "powershell")).toContain('<span class="hljs-built_in">Get-ChildItem</span>');
  });

  it("escapes, without highlighting, code in other languages or none", () => {
    expect(highlightCode("<b>&'\"</b>", "")).toBe("&lt;b&gt;&amp;&#39;&quot;&lt;/b&gt;");
    expect(highlightCode("if x < 1", "no-such-language")).toBe("if x &lt; 1");
  });
});

describe("codeBlockHtml", () => {
  it("is a header with the language and a copy button, and the highlighted code", () => {
    expect(codeBlockHtml("x = 1\n", "python")).toBe(
      '<div class="smarter-chat-code"><div class="smarter-chat-code-header">' +
        '<span class="smarter-chat-code-language">python</span>' +
        '<button type="button" class="smarter-chat-code-copy" aria-label="Copy code">Copy</button></div>' +
        '<pre><code class="hljs language-python">x = <span class="hljs-number">1</span>\n</code></pre></div>',
    );
  });

  it("has no language class for code without a known language, and escapes the language", () => {
    const html = codeBlockHtml("<x>", '"><script>');
    expect(html).toContain('<span class="smarter-chat-code-language">&quot;&gt;&lt;script&gt;</span>');
    expect(html).toContain('<pre><code class="hljs">&lt;x&gt;\n</code></pre>');
  });

  it("does not display a closing fence at the end of the last line", () => {
    expect(codeBlockHtml("    }\n)```", "python")).toContain("    }\n)\n</code></pre>");
  });
});

describe("copyCodeBlock", () => {
  const writeText = vi.fn();

  function render(html: string) {
    document.body.innerHTML = html;
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  }

  afterEach(() => {
    document.body.innerHTML = "";
    writeText.mockReset();
    vi.useRealTimers();
  });

  it("copies the code block's code, and says so on the button for a moment", async () => {
    vi.useFakeTimers();
    writeText.mockResolvedValue(undefined);
    render(codeBlockHtml("import os\nprint(os.name)\n", "python"));
    const button = document.querySelector("button")!;

    expect(copyCodeBlock(button)).toBe(true);
    expect(writeText).toHaveBeenCalledWith("import os\nprint(os.name)");
    await vi.waitFor(() => expect(button).toHaveTextContent("Copied!"));
    vi.advanceTimersByTime(2000);
    expect(button).toHaveTextContent("Copy");
  });

  it("ignores a failure to copy", async () => {
    writeText.mockRejectedValue(new Error("denied"));
    render(codeBlockHtml("x", ""));
    const button = document.querySelector("button")!;
    expect(copyCodeBlock(button)).toBe(true);
    await Promise.resolve();
    expect(button).toHaveTextContent("Copy");
  });

  it("ignores clicks on anything else", () => {
    render(`${codeBlockHtml("x", "")}<button>other</button>`);
    expect(copyCodeBlock(document.querySelectorAll("button")[1])).toBe(false);
    expect(copyCodeBlock(document.querySelector("pre"))).toBe(false);
    expect(copyCodeBlock(null)).toBe(false);
    expect(writeText).not.toHaveBeenCalled();
  });
});

describe("codeBlockHtml, with a file name", () => {
  it("has a download button that saves the code as the file", () => {
    document.body.innerHTML = codeBlockHtml("a: 1", "yaml", { filename: "a.yaml" });
    expect(document.querySelector<HTMLElement>(`button.${DOWNLOAD_BUTTON_CLASS}`)?.dataset.filename).toBe("a.yaml");
    document.body.innerHTML = codeBlockHtml("a: 1", "yaml");
    expect(document.querySelector(`button.${DOWNLOAD_BUTTON_CLASS}`)).toBeNull();
  });
});

describe("toggleCodeBlock", () => {
  const lines = (count: number) => Array.from({ length: count }, (_, index) => `line ${index}`).join("\n");

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("collapses a long code block, and shows all of it, and collapses it again, when its button is clicked", () => {
    document.body.innerHTML = codeBlockHtml(lines(COLLAPSE_LINES + 5), "");
    const block = document.querySelector(".smarter-chat-code")!;
    const button = document.querySelector<HTMLButtonElement>("button.smarter-chat-code-expand")!;
    expect(block).toHaveClass(COLLAPSED_CLASS);
    expect(button).toHaveTextContent(`Show all ${COLLAPSE_LINES + 5} lines`);
    expect(button).toHaveAttribute("aria-expanded", "false");

    expect(toggleCodeBlock(button)).toBe(true);
    expect(block).not.toHaveClass(COLLAPSED_CLASS);
    expect(button).toHaveTextContent("Show fewer lines");
    expect(button).toHaveAttribute("aria-expanded", "true");

    expect(toggleCodeBlock(button)).toBe(true);
    expect(block).toHaveClass(COLLAPSED_CLASS);
    expect(button).toHaveTextContent(`Show all ${COLLAPSE_LINES + 5} lines`);
  });

  it("doesn't collapse a short code block, or a mermaid diagram's", () => {
    expect(codeBlockHtml(lines(COLLAPSE_LINES), "")).not.toContain(COLLAPSED_CLASS);
    expect(codeBlockHtml(lines(COLLAPSE_LINES + 5), "mermaid")).not.toContain(COLLAPSED_CLASS);
  });

  it("ignores clicks on anything else", () => {
    document.body.innerHTML = codeBlockHtml("x", "");
    expect(toggleCodeBlock(document.querySelector("button"))).toBe(false);
    expect(toggleCodeBlock(null)).toBe(false);
  });
});
