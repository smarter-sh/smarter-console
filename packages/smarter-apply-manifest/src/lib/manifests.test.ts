import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { sessionContext } from "@/mocks/fixtures";
import { exampleHandler } from "@/mocks/handlers";
import { server } from "@test/server";

import { loadExample, MAX_FILE_BYTES, readManifestFile } from "./manifests";

describe("readManifestFile", () => {
  it("reads a file's text", async () => {
    expect(await readManifestFile(new File(["kind: Secret\n"], "a.yaml"))).toBe("kind: Secret\n");
  });

  it("refuses a file that is too large", async () => {
    const file = new File(["x"], "big.yaml");
    Object.defineProperty(file, "size", { value: MAX_FILE_BYTES + 1 });
    await expect(readManifestFile(file)).rejects.toThrow("big.yaml is too large to be a manifest.");
  });
});

describe("loadExample", () => {
  beforeEach(() => {
    server.use(exampleHandler);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("returns a kind's example as YAML", async () => {
    const yaml = await loadExample(sessionContext, "/api/v1/cli/example-manifest/secret/", "Secret");
    expect(yaml).toMatch(/^apiVersion: smarter.sh\/v1\nkind: Secret\nmetadata:\n {2}name: example_secret\n/);
  });

  it("fails for a kind without an example", async () => {
    await expect(loadExample(sessionContext, "/api/v1/cli/example-manifest/nothing/", "Nothing")).rejects.toThrow(
      "The example Nothing manifest could not be loaded.",
    );
  });

  it("fails when the response isn't json", async () => {
    server.use(http.post("/api/v1/cli/example-manifest/secret/", () => new HttpResponse("oops")));
    await expect(loadExample(sessionContext, "/api/v1/cli/example-manifest/secret/", "Secret")).rejects.toThrow(
      "could not be loaded",
    );
  });
});
