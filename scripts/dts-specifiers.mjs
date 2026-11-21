/**
 * The declaration files of the packages published to npm (@smarter.sh/ui-chat, @smarter.sh/ui-widgets), and
 * Node's ES module resolution.
 *
 * Both packages are `"type": "module"`, so TypeScript reads their .d.ts files as ES modules, in which a relative
 * import needs its file's extension under `moduleResolution: "node16"` or `"nodenext"`. tsc copies the source's
 * specifiers into the declarations as they are: extensionless ("./lib/enums"), directories ("./components/Foo"),
 * and Vite's `@/` alias, which no consumer can resolve. A consumer's exports then become `any`, or fail with
 * TS2834 and TS2307 (smarter-sh/smarter-console#6).
 *
 * - `node ../../scripts/dts-specifiers.mjs <types dir> [<src dir in types dir>]` runs after `tsc -p
 *   tsconfig.lib.json`, in each package's `build:lib`. It rewrites every relative or `@/` specifier to the
 *   declaration file it names, as "./x.js" or "./x/index.js", which every resolution mode accepts, and fails on
 *   one that names no file. It drops stylesheets' side-effect imports, which declare nothing. `<src dir>` is where `src/` lands in the types dir (default: the types dir itself).
 * - `checkDeclarations(entry)`, which each package's scripts/check-dist.mjs calls, type-checks the published entry
 *   as a consumer with `moduleResolution: "nodenext"` would, and returns the errors in the package's own files.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// `from "x"`, `import "x"`, `import("x")`, in import, export and import type statements.
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])([^"']+)\2/g;
// a stylesheet's side-effect import, which tsc keeps in declarations. It declares nothing, and its file isn't
// in dist/types (Vite bundles the css into the package's stylesheet), so TypeScript 6 rejects it (TS2882).
const STYLE_IMPORT = /^import\s+["'][^"']+\.(css|scss|sass|less)["'];?[ \t]*\r?\n/gm;

function declarationFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".d.ts"))
    .map((entry) => path.join(entry.parentPath, entry.name));
}

/** The ".js" specifier, relative to `fromFile`, of the declaration file that `target` (no extension) names. */
function resolveTarget(fromFile, target) {
  const stripped = target.replace(/\.(js|jsx|ts|tsx)$/, "");
  const candidates = [`${stripped}.d.ts`, path.join(stripped, "index.d.ts")];
  const found = candidates.find((file) => fs.existsSync(file));
  if (!found) return null;
  let relative = path.relative(path.dirname(fromFile), found).split(path.sep).join("/");
  if (!relative.startsWith(".")) relative = `./${relative}`;
  return relative.replace(/\.d\.ts$/, ".js");
}

/** Rewrites the specifiers of every .d.ts in `typesDir`. Returns { changed, unresolved }. */
export function fixDeclarationSpecifiers(typesDir, srcDir = typesDir) {
  let changed = 0;
  const unresolved = [];
  for (const file of declarationFiles(typesDir)) {
    const before = fs.readFileSync(file, "utf-8");
    const after = before.replace(STYLE_IMPORT, "").replace(SPECIFIER, (match, keyword, quote, specifier) => {
      let target;
      if (specifier.startsWith("@/")) target = path.join(srcDir, specifier.slice(2));
      else if (specifier.startsWith("./") || specifier.startsWith("../")) {
        target = path.resolve(path.dirname(file), specifier);
      } else return match; // a package, e.g. "react"
      const resolved = resolveTarget(file, target);
      if (!resolved) {
        unresolved.push(`${path.relative(typesDir, file)}: "${specifier}"`);
        return match;
      }
      return `${keyword}${quote}${resolved}${quote}`;
    });
    if (after !== before) {
      fs.writeFileSync(file, after);
      changed += 1;
    }
  }
  return { changed, unresolved };
}

/**
 * Type-checks `entry` (a package's published .d.ts) with `module` and `moduleResolution` "nodenext", and
 * skipLibCheck off, as a strict consumer would. Returns the messages of the errors in the package's own
 * declarations; errors in its dependencies' types are theirs, not ours.
 */
export async function checkDeclarations(entry) {
  const ts = (await import("typescript")).default;
  const typesDir = path.dirname(path.resolve(entry));
  const program = ts.createProgram([entry], {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX,
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    types: [],
  });
  let packageRoot = typesDir;
  while (!fs.existsSync(path.join(packageRoot, "package.json"))) packageRoot = path.dirname(packageRoot);
  return ts
    .getPreEmitDiagnostics(program)
    .filter((d) => d.file && path.resolve(d.file.fileName).startsWith(path.join(packageRoot, "dist")))
    .map((d) => {
      const { line } = d.file.getLineAndCharacterOfPosition(d.start ?? 0);
      const where = `${path.relative(packageRoot, d.file.fileName)}(${line + 1})`;
      return `${where}: TS${d.code} ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`;
    });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [typesDir, srcDir] = process.argv.slice(2).map((dir) => dir && path.resolve(dir));
  if (!typesDir || !fs.existsSync(typesDir)) {
    console.error("usage: node scripts/dts-specifiers.mjs <types dir> [<src dir in types dir>]");
    process.exit(2);
  }
  const { changed, unresolved } = fixDeclarationSpecifiers(typesDir, srcDir);
  if (unresolved.length) {
    console.error(`dts-specifiers: ${unresolved.length} specifier(s) name no declaration file:`);
    for (const line of unresolved) console.error(`  ${line}`);
    process.exit(1);
  }
  console.log(`dts-specifiers: rewrote the specifiers of ${changed} declaration file(s) in ${typesDir}`);
}
