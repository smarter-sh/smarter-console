/**
 * The console build's size: what a browser loads first, and the largest chunks that it loads later, when a page
 * that needs them opens. make bundle-report builds the console, then runs it:
 *
 *     node bundle/report.ts [--max-initial-kb <kB>] [<build folder>]
 *
 * It reads the build's manifest.json, which Vite writes (packages/smarter-console/vite.config.ts, build.manifest).
 * The first load is the entry, index.html's script, with every chunk that it imports statically, and their
 * stylesheets. Every other chunk is loaded lazily: a route's page (router.tsx), or a library that only some pages
 * use, e.g. the manifest editor's Monaco or Smarter Chat's Mermaid. Sizes are of the files, and gzipped, as a
 * browser downloads them.
 *
 * With --max-initial-kb, it exits 1 when the first load, gzipped, is larger: a heavy library imported statically,
 * rather than with import(), lands in the first load of every page.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

/** The console's build, which make build and make bundle-report write. */
export const BUILD_DIR = path.resolve(import.meta.dirname, "..", "dist", "react", "@smarter", "console");

/** A chunk of Vite's manifest.json. */
export interface ManifestChunk {
  file: string;
  src?: string;
  name?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
}

export type Manifest = Record<string, ManifestChunk>;

/** A file's size: as stored, and gzipped. */
export interface FileSize {
  bytes: number;
  gzipBytes: number;
}

/** A chunk that loads lazily: its manifest key, e.g. the page's source, its files, and their total size. */
export interface LazyChunk {
  key: string;
  files: string[];
  size: FileSize;
}

/** The files of a chunk and every chunk that it imports statically, with their stylesheets. */
function staticClosure(manifest: Manifest, keys: string[], seen: Set<string> = new Set()): Set<string> {
  const files = new Set<string>();
  const pending = [...keys];
  while (pending.length > 0) {
    const key = pending.pop() as string;
    if (seen.has(key)) continue;
    seen.add(key);
    const chunk = manifest[key];
    if (!chunk) continue;
    files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
    for (const imported of chunk.imports ?? []) pending.push(imported);
  }
  return files;
}

/**
 * The files of the first load: the entries, and what they import statically.
 *
 * @param manifest - The build's manifest.
 * @returns The files, relative to the build folder.
 */
export function initialFiles(manifest: Manifest): string[] {
  const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
  return [...staticClosure(manifest, entries)].sort();
}

/**
 * The console's chunks that load lazily, its pages and packages, each with the files that it adds to the first
 * load's: its own, and those of the chunks that it imports statically, which the first load doesn't already have.
 * A library's own lazy chunks, e.g. each of Mermaid's diagram types, are left out: they share most of their files,
 * which largestFiles() shows once each.
 *
 * @param manifest - The build's manifest.
 * @param sizeOf - A file's size.
 * @returns The chunks, largest first, gzipped.
 */
export function lazyChunks(manifest: Manifest, sizeOf: (file: string) => FileSize): LazyChunk[] {
  const initial = new Set(initialFiles(manifest));
  const chunks: LazyChunk[] = [];
  for (const [key, chunk] of Object.entries(manifest)) {
    if (!chunk.isDynamicEntry || key.includes("node_modules/")) continue;
    const files = [...staticClosure(manifest, [key])].filter((file) => !initial.has(file)).sort();
    chunks.push({ key, files, size: totalSize(files, sizeOf) });
  }
  return chunks.sort((a, b) => b.size.gzipBytes - a.size.gzipBytes);
}

/**
 * The build's largest files, gzipped: what each lazily loaded chunk shares, e.g. Monaco or Mermaid, counted once.
 *
 * @param manifest - The build's manifest.
 * @param sizeOf - A file's size.
 * @param top - How many.
 * @returns The files, largest first.
 */
export function largestFiles(manifest: Manifest, sizeOf: (file: string) => FileSize, top: number): string[] {
  const files = new Set<string>();
  for (const chunk of Object.values(manifest)) {
    files.add(chunk.file);
    for (const css of chunk.css ?? []) files.add(css);
  }
  return [...files].sort((a, b) => sizeOf(b).gzipBytes - sizeOf(a).gzipBytes).slice(0, top);
}

/** The total size of files. */
export function totalSize(files: string[], sizeOf: (file: string) => FileSize): FileSize {
  let bytes = 0;
  let gzipBytes = 0;
  for (const file of files) {
    const size = sizeOf(file);
    bytes += size.bytes;
    gzipBytes += size.gzipBytes;
  }
  return { bytes, gzipBytes };
}

/** A size in kilobytes, e.g. "312.4 kB". */
export function kilobytes(bytes: number): string {
  return `${(bytes / 1000).toFixed(1)} kB`;
}

/**
 * The report, as text.
 *
 * @param manifest - The build's manifest.
 * @param sizeOf - A file's size.
 * @param top - How many lazy chunks to list.
 * @returns The report.
 */
export function formatReport(manifest: Manifest, sizeOf: (file: string) => FileSize, top = 15): string {
  const initial = initialFiles(manifest);
  const initialSize = totalSize(initial, sizeOf);
  const lazy = lazyChunks(manifest, sizeOf);
  const lines = [
    `First load: ${kilobytes(initialSize.gzipBytes)} gzipped (${kilobytes(initialSize.bytes)}), ${initial.length} files`,
  ];
  const largest = [...initial].sort((a, b) => sizeOf(b).gzipBytes - sizeOf(a).gzipBytes);
  for (const file of largest) {
    lines.push(`  ${kilobytes(sizeOf(file).gzipBytes).padStart(10)}  ${file}`);
  }
  lines.push(
    "",
    `Loaded later, when a page needs them: ${lazy.length} chunks, the ${Math.min(top, lazy.length)} largest:`,
  );
  for (const chunk of lazy.slice(0, top)) {
    lines.push(`  ${kilobytes(chunk.size.gzipBytes).padStart(10)}  ${chunk.key}`);
  }
  lines.push("", `The build's ${top} largest files:`);
  for (const file of largestFiles(manifest, sizeOf, top)) {
    const where = initial.includes(file) ? "  (first load)" : "";
    lines.push(`  ${kilobytes(sizeOf(file).gzipBytes).padStart(10)}  ${file}${where}`);
  }
  return lines.join("\n");
}

/** A file's size in the build folder, as stored and gzipped. */
export function fileSizer(buildDir: string): (file: string) => FileSize {
  const sizes = new Map<string, FileSize>();
  return (file) => {
    let size = sizes.get(file);
    if (!size) {
      const content = fs.readFileSync(path.join(buildDir, file));
      size = { bytes: content.length, gzipBytes: zlib.gzipSync(content, { level: 9 }).length };
      sizes.set(file, size);
    }
    return size;
  };
}

/**
 * Prints the report of a build, and checks the first load's budget.
 *
 * @param args - The command line's arguments: --max-initial-kb <kB>, and the build folder.
 * @returns The exit code: 1 when the first load is over budget, or there is no build.
 */
export function main(args: string[]): number {
  let budgetKb: number | null = null;
  let buildDir = BUILD_DIR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--max-initial-kb") budgetKb = Number(args[++i]);
    else buildDir = path.resolve(args[i]);
  }
  const manifestPath = path.join(buildDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error(`No build at ${buildDir}: run make build, or make bundle-report.`);
    return 1;
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as Manifest;
  const sizeOf = fileSizer(buildDir);
  console.log(formatReport(manifest, sizeOf));
  if (budgetKb === null) return 0;
  const initialKb = totalSize(initialFiles(manifest), sizeOf).gzipBytes / 1000;
  if (initialKb > budgetKb) {
    console.error(
      `\nThe first load, ${initialKb.toFixed(1)} kB gzipped, is over its budget of ${budgetKb} kB. A library that ` +
        "only some pages need belongs in a chunk of its own: import() it, or the page that uses it, lazily.",
    );
    return 1;
  }
  console.log(`\nThe first load is within its budget of ${budgetKb} kB gzipped.`);
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
