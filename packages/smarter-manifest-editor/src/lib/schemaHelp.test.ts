import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SECRET_SCHEMA, sessionContext } from "@/mocks/fixtures";
import { schemaHandler } from "@/mocks/handlers";
import { server } from "@test/server";

import { clearSchemas, fieldHelp, helpMarkdown, loadSchema } from "./schemaHelp";

const SECRET_URL = "/api/v1/cli/json-schema/secret/";

describe("fieldHelp", () => {
  it("describes a top-level field", () => {
    expect(fieldHelp(SECRET_SCHEMA, ["kind"])).toEqual({
      path: "kind",
      type: "string",
      required: true,
      description: "The kind of resource.",
      values: [],
    });
  });

  it("follows $refs, and names an object's type by its title", () => {
    expect(fieldHelp(SECRET_SCHEMA, ["spec", "config"])).toEqual(
      expect.objectContaining({
        type: "SAMSecretSpecConfig",
        required: true,
        description: "The configuration for the Secret.",
      }),
    );
    expect(fieldHelp(SECRET_SCHEMA, ["spec", "config", "value"])).toEqual(
      expect.objectContaining({ path: "spec.config.value", type: "string", required: true }),
    );
  });

  it("describes an optional field of a union with null", () => {
    expect(fieldHelp(SECRET_SCHEMA, ["metadata", "description"])).toEqual(
      expect.objectContaining({
        type: "string | null",
        required: false,
        description: "The description for this resource.",
      }),
    );
    expect(fieldHelp(SECRET_SCHEMA, ["metadata", "tags"])?.type).toBe("string[] | null");
  });

  it("describes a sequence's item, and a map's value", () => {
    expect(fieldHelp(SECRET_SCHEMA, ["metadata", "tags", "0"])).toEqual(
      expect.objectContaining({ path: "metadata.tags.0", type: "string", required: false }),
    );
    expect(fieldHelp(SECRET_SCHEMA, ["metadata", "annotations", "acme.com/id"])?.type).toBe("string");
  });

  it("lists an enum's values", () => {
    expect(fieldHelp(SECRET_SCHEMA, ["spec", "config", "stage"])).toEqual(
      expect.objectContaining({ type: "enum", values: ["dev", "prod"], description: "" }),
    );
  });

  it("takes a description from a field's $ref when the field has none", () => {
    const schema = {
      $defs: { Thing: { description: "A thing.", type: "object" } },
      properties: { a: { $ref: "#/$defs/Thing" } },
    };
    expect(fieldHelp(schema, ["a"])).toEqual(expect.objectContaining({ description: "A thing.", type: "object" }));
  });

  it("names a field of several types", () => {
    expect(fieldHelp({ properties: { a: { type: ["string", "integer"] } } }, ["a"])?.type).toBe("string | integer");
  });

  it("knows nothing of a field that the schema doesn't have", () => {
    expect(fieldHelp(SECRET_SCHEMA, [])).toBeNull();
    expect(fieldHelp(SECRET_SCHEMA, ["status"])).toBeNull();
    expect(fieldHelp(SECRET_SCHEMA, ["kind", "more"])).toBeNull();
    expect(fieldHelp({ properties: { a: { $ref: "#/$defs/Missing" } } }, ["a", "b"])).toBeNull();
  });
});

describe("helpMarkdown", () => {
  it("shows the path, type, whether it is required, the description and the values", () => {
    expect(helpMarkdown(fieldHelp(SECRET_SCHEMA, ["spec", "config", "value"])!)).toBe(
      "**spec.config.value** · `string` · required\n\nThe secret's value.",
    );
    expect(helpMarkdown(fieldHelp(SECRET_SCHEMA, ["spec", "config", "stage"])!)).toBe(
      "**spec.config.stage** · `enum`\n\nOne of: `dev`, `prod`",
    );
  });
});

describe("loadSchema", () => {
  beforeEach(() => {
    clearSchemas();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("loads a kind's schema once", async () => {
    let requests = 0;
    server.use(
      http.post(SECRET_URL, () => {
        requests += 1;
        return HttpResponse.json({ data: SECRET_SCHEMA });
      }),
    );
    expect(await loadSchema(sessionContext, SECRET_URL)).toEqual(SECRET_SCHEMA);
    expect(await loadSchema(sessionContext, SECRET_URL)).toEqual(SECRET_SCHEMA);
    expect(requests).toBe(1);
  });

  it("has no schema for a kind that the api doesn't know, and asks again later", async () => {
    server.use(schemaHandler);
    expect(await loadSchema(sessionContext, "/api/v1/cli/json-schema/nothing/")).toBeNull();
    server.use(http.post("/api/v1/cli/json-schema/nothing/", () => HttpResponse.json({ data: SECRET_SCHEMA })));
    expect(await loadSchema(sessionContext, "/api/v1/cli/json-schema/nothing/")).toEqual(SECRET_SCHEMA);
  });

  it("has no schema when the request fails", async () => {
    server.use(http.post(SECRET_URL, () => HttpResponse.error()));
    expect(await loadSchema(sessionContext, SECRET_URL)).toBeNull();
  });

  it("has no schema when the response isn't json", async () => {
    server.use(http.post(SECRET_URL, () => new HttpResponse("oops")));
    expect(await loadSchema(sessionContext, SECRET_URL)).toBeNull();
  });
});
