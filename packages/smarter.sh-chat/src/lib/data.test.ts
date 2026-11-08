import { describe, expect, it } from "vitest";

import { CODE_BLOCK_CLASS, DOWNLOAD_BUTTON_CLASS } from "./code";
import { csvHtml, csvRows, dataHtml, isManifest, manifestFilename, manifestHtml, prettyJson } from "./data";

const MANIFEST = `apiVersion: smarter.sh/v1
kind: LLMClient
metadata:
  name: stackademy_sql
  description: "Stackademy's course catalogue." # a comment
  version: 1.0.0
spec:
  config:
    defaultSystemRole: |
      You are a helpful assistant.

      DO NOT GUESS.
    tools:
      - stackademy_sql
`;

function parse(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

describe("prettyJson", () => {
  it("pretty prints a JSON object or array", () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson(" [1,2] ")).toBe("[\n  1,\n  2\n]");
  });

  it("unwraps a JSON string that holds a JSON object or array, once", () => {
    expect(prettyJson(JSON.stringify('{"course_code": "CS210"}'))).toBe('{\n  "course_code": "CS210"\n}');
    expect(prettyJson(JSON.stringify(JSON.stringify("[1]")))).toBeNull();
  });

  it.each([
    "42",
    '"text"',
    '"[not json"',
    '"unterminated',
    "null",
    "true",
    "{not json}",
    "[a link](https://example.com)",
    "hello {}",
    "",
  ])("leaves %j alone", (text) => {
    expect(prettyJson(text)).toBeNull();
  });
});

describe("isManifest", () => {
  it("accepts a YAML document with top-level apiVersion and kind keys", () => {
    expect(isManifest(MANIFEST)).toBe(true);
    expect(isManifest(`---\n# a plugin\n${MANIFEST}...\n`)).toBe(true);
  });

  it.each([
    ["prose around it", `Here is the manifest:\n${MANIFEST}`],
    ["no kind", "apiVersion: smarter.sh/v1\nmetadata:\n  name: x\n"],
    ["an indented apiVersion", "spec:\n  apiVersion: v1\n  kind: Pod\n"],
    ["a fenced block", "```yaml\napiVersion: v1\nkind: Pod\n```"],
  ])("rejects %s", (_, text) => {
    expect(isManifest(text)).toBe(false);
  });
});

describe("manifestFilename", () => {
  it("is the manifest's metadata.name, or else its kind", () => {
    expect(manifestFilename(MANIFEST)).toBe("stackademy_sql.yaml");
    expect(manifestFilename("apiVersion: v1\nkind: Plugin\nmetadata:\n  name: 'my plugin/v2'\n")).toBe(
      "my_plugin_v2.yaml",
    );
    expect(manifestFilename("apiVersion: v1\nkind: Secret\n")).toBe("Secret.yaml");
    expect(manifestFilename("apiVersion: v1\nkind: ..\n")).toBe("manifest.yaml");
  });
});

describe("manifestHtml", () => {
  it("is a yaml code block, with a download button that saves it by its name", () => {
    const html = parse(manifestHtml(MANIFEST));
    expect(html.querySelector(`.${CODE_BLOCK_CLASS} code.language-yaml`)?.textContent).toBe(MANIFEST);
    expect(html.querySelector<HTMLElement>(`button.${DOWNLOAD_BUTTON_CLASS}`)?.dataset.filename).toBe(
      "stackademy_sql.yaml",
    );
  });
});

describe("csvRows", () => {
  it("reads CSV, with quoted fields", () => {
    expect(csvRows('code,name,price\nCS210,"Artificial Intelligence, Applied",700\nCS110,Python,"1,200"')).toEqual([
      ["code", "name", "price"],
      ["CS210", "Artificial Intelligence, Applied", "700"],
      ["CS110", "Python", "1,200"],
    ]);
    expect(csvRows('a,b,c\n"say ""hi""",2,3\nx,y,z')?.[1][0]).toBe('say "hi"');
  });

  it("reads TSV", () => {
    expect(csvRows("code\tname\nCS210\tAI, applied\nCS110\tPython\n")).toEqual([
      ["code", "name"],
      ["CS210", "AI, applied"],
      ["CS110", "Python"],
    ]);
  });

  it("reads two columns, if one is numbers", () => {
    expect(csvRows("course,price\nCS210,$700.00\nCS110,1200")).not.toBeNull();
  });

  it.each([
    ["a header and one row", "a,b,c\n1,2,3"],
    ["rows of different lengths", "a,b,c\n1,2,3\n1,2"],
    ["one column", "a\nb\nc"],
    ["a poem", "Roses are red, violets are blue\nSugar is sweet, and so are you\nThe end, my friend"],
    ["prose that ends with punctuation", "one, two, three\nfour, five, six.\nseven, eight, nine"],
    ["two columns of words", "Yes, I can\nSure, ok\nFine, thanks"],
    ["a duplicated header", "a,a,b\n1,2,3\n4,5,6"],
    ["an empty header", "a,,b\n1,2,3\n4,5,6"],
    ["a long header", `${"x".repeat(41)},b,c\n1,2,3\n4,5,6`],
    ["long cells", `a,b,c\n${"word ".repeat(60)},2,3\n${"word ".repeat(60)},5,6`],
  ])("rejects %s", (_, text) => {
    expect(csvRows(text)).toBeNull();
  });
});

describe("csvHtml", () => {
  it("is a table, with the first row as its header, escaped", () => {
    const html = csvHtml([
      ["a", "<b>"],
      ["1", "<script>"],
    ]);
    expect(html).toBe(
      '<table class="smarter-chat-csv"><thead><tr><th>a</th><th>&lt;b&gt;</th></tr></thead>' +
        "<tbody><tr><td>1</td><td>&lt;script&gt;</td></tr></tbody></table>",
    );
  });
});

describe("dataHtml", () => {
  it("displays JSON, a manifest, or CSV, as data", () => {
    expect(parse(dataHtml('{"a": 1}')!).querySelector("code.language-json")).not.toBeNull();
    expect(parse(dataHtml(MANIFEST)!).querySelector("code.language-yaml")).not.toBeNull();
    expect(parse(dataHtml("a,b,c\n1,2,3\n4,5,6")!).querySelectorAll("tbody tr")).toHaveLength(2);
  });

  it("leaves anything else alone", () => {
    expect(dataHtml("Hello, world.")).toBeNull();
  });
});
