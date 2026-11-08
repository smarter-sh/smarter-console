import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fileSizer,
  formatReport,
  initialFiles,
  kilobytes,
  largestFiles,
  lazyChunks,
  main,
  type FileSize,
  type Manifest,
} from "./report";

/**
 * A build: the entry, with a shared chunk and its stylesheet; a page loaded lazily, which imports a library that
 * the first load doesn't have; and a library's own lazy chunk.
 */
const manifest: Manifest = {
  "index.html": {
    file: "assets/index.js",
    isEntry: true,
    imports: ["_shared.js"],
    dynamicImports: ["src/routes/Page.tsx"],
    css: ["assets/index.css"],
  },
  "_shared.js": { file: "assets/shared.js", imports: ["_shared.js"] },
  "src/routes/Page.tsx": {
    file: "assets/Page.js",
    isDynamicEntry: true,
    imports: ["_shared.js", "_library.js"],
    css: ["assets/Page.css"],
  },
  "_library.js": { file: "assets/library.js", dynamicImports: ["../node_modules/lib/diagram.mjs"] },
  "../node_modules/lib/diagram.mjs": { file: "assets/diagram.js", isDynamicEntry: true },
};

const SIZES: Record<string, number> = {
  "assets/index.js": 100_000,
  "assets/index.css": 3_000,
  "assets/shared.js": 20_000,
  "assets/Page.js": 50_000,
  "assets/Page.css": 1_000,
  "assets/library.js": 300_000,
  "assets/diagram.js": 40_000,
};

/** Sizes, gzipped to a tenth. */
const sizeOf = (file: string): FileSize => ({ bytes: SIZES[file], gzipBytes: SIZES[file] / 10 });

describe("the build's size report", () => {
  it("finds the first load: the entry, what it imports statically, and their stylesheets", () => {
    expect(initialFiles(manifest)).toEqual(["assets/index.css", "assets/index.js", "assets/shared.js"]);
  });

  it("skips an import that the manifest doesn't have", () => {
    const entry = { file: "assets/index.js", isEntry: true, imports: ["_missing.js"] };
    expect(initialFiles({ "index.html": entry })).toEqual(["assets/index.js"]);
  });

  it("counts what a lazy page adds to the first load, and leaves out a library's own lazy chunks", () => {
    const chunks = lazyChunks(manifest, sizeOf);
    expect(chunks).toEqual([
      {
        key: "src/routes/Page.tsx",
        files: ["assets/Page.css", "assets/Page.js", "assets/library.js"],
        size: { bytes: 351_000, gzipBytes: 35_100 },
      },
    ]);
  });

  it("lists the build's largest files once each, largest first", () => {
    expect(largestFiles(manifest, sizeOf, 3)).toEqual(["assets/library.js", "assets/index.js", "assets/Page.js"]);
  });

  it("reports the first load, the lazy pages and the largest files", () => {
    const report = formatReport(manifest, sizeOf, 2);
    expect(report).toContain("First load: 12.3 kB gzipped (123.0 kB), 3 files");
    expect(report).toContain("Loaded later, when a page needs them: 1 chunks, the 1 largest:");
    expect(report).toMatch(/35\.1 kB {2}src\/routes\/Page\.tsx/);
    expect(report).toMatch(/10\.0 kB {2}assets\/index\.js {2}\(first load\)/);
  });

  it("writes kilobytes", () => {
    expect(kilobytes(1234)).toBe("1.2 kB");
  });
});

describe("a build on disk", () => {
  let dir = "";

  afterEach(() => {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /** A build folder with this manifest's files, of their sizes. */
  function writeBuild(): string {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "bundle-report-"));
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
    for (const [file, bytes] of Object.entries(SIZES)) {
      fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
      fs.writeFileSync(path.join(dir, file), "x".repeat(bytes));
    }
    return dir;
  }

  it("measures each file as stored and gzipped", () => {
    const size = fileSizer(writeBuild())("assets/index.js");
    expect(size.bytes).toBe(100_000);
    expect(size.gzipBytes).toBeGreaterThan(0);
    expect(size.gzipBytes).toBeLessThan(size.bytes);
  });

  it("passes a first load within its budget", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(main([writeBuild(), "--max-initial-kb", "100"])).toBe(0);
    expect(log).toHaveBeenLastCalledWith(expect.stringContaining("within its budget of 100 kB"));
  });

  it("fails a first load over its budget, and says what to do", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(main(["--max-initial-kb", "0.01", writeBuild()])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("is over its budget of 0.01 kB"));
  });

  it("reports without a budget, and fails without a build", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(main([writeBuild()])).toBe(0);
    expect(main([path.join(dir, "missing")])).toBe(1);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("No build at"));
  });
});
