import { describe, expect, it, vi } from "vitest";

import { SECRET_YAML, VALIDATE_API_URL, sessionContext } from "@/mocks/fixtures";
import { invalidHandler } from "@/mocks/handlers";
import { server } from "@test/server";
import { http, HttpResponse } from "msw";

import { headerErrors, keyOffsets, keyPathAt, locOffset, samErrors, syntaxErrors, yamlKeys } from "./validation";

describe("syntaxErrors", () => {
  it("finds none in valid YAML", () => {
    expect(syntaxErrors(SECRET_YAML)).toEqual([]);
  });

  it("locates a syntax error", () => {
    const yaml = "kind: Secret\nmetadata:\n  name: [unclosed\n";
    const [error] = syntaxErrors(yaml);
    expect(error.source).toBe("yaml");
    expect(error.offset).toBeGreaterThan(yaml.indexOf("metadata"));
  });
});

describe("keyOffsets and locOffset", () => {
  it("locate each key, nested ones and list items included", () => {
    const yaml = "kind: Secret\nspec:\n  config:\n    value: x\nitems:\n  - a\n  - b\n";
    const offsets = keyOffsets(yaml);
    expect(offsets.get("kind")).toBe(0);
    expect(offsets.get("spec.config.value")).toBe(yaml.indexOf("value"));
    expect(offsets.get("items.1")).toBe(yaml.indexOf("b"));
  });

  it("fall back to the nearest key that exists", () => {
    const offsets = keyOffsets("spec:\n  config: {}\n");
    expect(locOffset(offsets, ["spec", "config", "missing"])).toBe(offsets.get("spec.config"));
    expect(locOffset(offsets, ["nothing"])).toBe(0);
  });
});

describe("yamlKeys", () => {
  it("records where each scalar value ends, and the first of duplicate keys", () => {
    const yaml = "kind: Secret\nkind: Plugin\n";
    expect(yamlKeys(yaml).get("kind")).toEqual({ start: 0, end: "kind: Secret".length });
  });

  it("records the first of duplicate keys' sequence items", () => {
    const yaml = "tags:\n  - a\ntags:\n  - b\n";
    const first = yaml.indexOf("- a") + 2;
    expect(yamlKeys(yaml).get("tags.0")).toEqual({ start: first, end: first + 1 });
  });

  it("follows aliases", () => {
    const keys = yamlKeys("a: &x 1\nb: *x\nc: 3\n");
    expect(keys.get("b")).toEqual({ start: "a: &x 1\n".length });
    expect(keys.get("c")?.end).toBe("a: &x 1\nb: *x\nc: 3".length);
  });

  it("locates the items of a sequence of mappings", () => {
    const yaml = "items:\n  - name: a\n  - name: b\n";
    const keys = yamlKeys(yaml);
    expect(keys.get("items.1")?.start).toBe(yaml.lastIndexOf("name"));
    expect(keys.get("items.1.name")?.end).toBe(yaml.length - 1);
  });

  it("doesn't fail on a complex key, which manifests don't have", () => {
    expect(() => yamlKeys("? - a\n: b\nc: d\n")).not.toThrow();
  });

  it("finds nothing in YAML that doesn't parse", () => {
    expect(yamlKeys("kind: [unclosed").size).toBe(0);
  });
});

describe("samErrors", () => {
  it("locates the SAM model's errors in the YAML", async () => {
    server.use(invalidHandler);
    const errors = await samErrors(sessionContext, VALIDATE_API_URL, SECRET_YAML, {});
    expect(errors).toEqual([
      {
        source: "sam",
        message: "value must be at least 32 characters",
        loc: ["spec", "config", "value"],
        offset: SECRET_YAML.indexOf("value:"),
      },
    ]);
  });

  it("reports no errors when the api cannot validate", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.post(VALIDATE_API_URL, () => new HttpResponse(null, { status: 500 })));
    expect(await samErrors(sessionContext, VALIDATE_API_URL, SECRET_YAML, {})).toEqual([]);
  });

  it("reports no errors when the api's response has no data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    server.use(http.post(VALIDATE_API_URL, () => HttpResponse.json({})));
    expect(await samErrors(sessionContext, VALIDATE_API_URL, SECRET_YAML, {})).toEqual([]);
  });

  it("reports no errors when the api lists none", async () => {
    server.use(http.post(VALIDATE_API_URL, () => HttpResponse.json({ data: { valid: true } })));
    expect(await samErrors(sessionContext, VALIDATE_API_URL, SECRET_YAML, {})).toEqual([]);
  });

  it("locates an error without a path at the start, with a default message", async () => {
    server.use(http.post(VALIDATE_API_URL, () => HttpResponse.json({ data: { valid: false, errors: [{}] } })));
    expect(await samErrors(sessionContext, VALIDATE_API_URL, SECRET_YAML, {})).toEqual([
      { source: "sam", message: "Invalid value", offset: 0, loc: [] },
    ]);
  });
});

describe("keyPathAt", () => {
  const at = (yaml: string, text: string, delta = 0) => keyPathAt(yaml, yaml.indexOf(text) + delta);

  it("finds the key on the cursor's line, wherever the cursor is on it", () => {
    expect(at(SECRET_YAML, "value:")).toEqual(["spec", "config", "value"]);
    expect(at(SECRET_YAML, "not-a-real-secret", 4)).toEqual(["spec", "config", "value"]);
    // in the line's indentation.
    expect(at(SECRET_YAML, "    value:")).toEqual(["spec", "config", "value"]);
    expect(at(SECRET_YAML, "kind:")).toEqual(["kind"]);
  });

  it("finds a sequence's items, and the keys of its mappings", () => {
    const yaml = "tags:\n  - a\nitems:\n  - name: x\n";
    expect(at(yaml, "a\n")).toEqual(["tags", "0"]);
    expect(at(yaml, "x\n")).toEqual(["items", "0", "name"]);
  });

  it("keeps the dots of a key, e.g. an annotation's", () => {
    const yaml = "metadata:\n  annotations:\n    acme.com/id: A-1\n";
    expect(at(yaml, "A-1")).toEqual(["metadata", "annotations", "acme.com/id"]);
  });

  it("finds nothing on a line without a key, or in YAML that doesn't parse", () => {
    expect(at("text: |\n  more\n", "more")).toBeNull();
    expect(at("kind: [unclosed", "unclosed")).toBeNull();
    expect(keyPathAt("", 0)).toBeNull();
  });
});

describe("headerErrors", () => {
  it("finds none in a manifest with its header", () => {
    expect(headerErrors(SECRET_YAML, ["Secret"])).toEqual([]);
    expect(headerErrors(SECRET_YAML)).toEqual([]);
  });

  it("finds none in YAML that doesn't parse", () => {
    expect(headerErrors("kind: [unclosed")).toEqual([]);
  });

  it.each(["just a string\n", "- a list\n", "null\n"])("rejects YAML that isn't a mapping: %j", (yaml) => {
    expect(headerErrors(yaml)).toEqual([expect.objectContaining({ loc: [], offset: 0 })]);
  });

  it("finds each missing field, at its parent if it has one", () => {
    const yaml = "metadata:\n  description: x\n";
    expect(headerErrors(yaml)).toEqual([
      expect.objectContaining({ loc: ["apiVersion"], message: "Required. Use smarter.sh/v1.", offset: 0 }),
      expect.objectContaining({ loc: ["kind"], offset: 0 }),
      expect.objectContaining({ loc: ["metadata", "name"], offset: 0 }),
    ]);
    expect(headerErrors("apiVersion: smarter.sh/v1\nkind: Secret\nmetadata: 3\n")).toEqual([
      expect.objectContaining({ loc: ["metadata", "name"] }),
    ]);
  });

  it("rejects another apiVersion, at its key", () => {
    const yaml = "kind: Secret\napiVersion: v1\nmetadata:\n  name: x\n";
    expect(headerErrors(yaml)).toEqual([
      expect.objectContaining({
        loc: ["apiVersion"],
        message: "Must be smarter.sh/v1.",
        offset: yaml.indexOf("apiVersion"),
      }),
    ]);
  });

  it("rejects a kind that isn't one of the kinds", () => {
    const yaml = "apiVersion: smarter.sh/v1\nkind: Secrett\nmetadata:\n  name: x\n";
    expect(headerErrors(yaml, ["LLMClient", "Secret"])).toEqual([
      expect.objectContaining({
        loc: ["kind"],
        message: "Secrett is not a kind of Smarter resource. The kinds are: LLMClient, Secret.",
        offset: yaml.indexOf("kind"),
      }),
    ]);
  });
});
