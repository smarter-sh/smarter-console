/**
 * The workspace's packages that other packages import from their TypeScript source, rather than from their builds.
 *
 * Their package.json files point at their dist/ builds, which `npm run build:deps` makes, and which a build empties
 * before it writes them again. The tests (vitest.shared.ts) and the console's dev server and build
 * (packages/smarter-console/vite.config.ts) resolve them to their source instead, so that they never use a stale or
 * half-written build, and a change to one shows at once.
 *
 * Smarter Chat (@smarter.sh/ui-chat) is not one of them: the workbench imports its built library, as npm users do.
 */
import path from "node:path";

const WORKSPACE = import.meta.dirname;

/** Each package's name, and the path of its source's entry point: Vite's resolve.alias. */
export const WORKSPACE_SOURCES: Record<string, string> = {
  "@smarter/common": path.join(WORKSPACE, "packages", "smarter-common", "src", "index.tsx"),
  "@smarter/didyouknow": path.join(WORKSPACE, "packages", "smarter-didyouknow", "src", "index.tsx"),
  "@smarter/onboarding": path.join(WORKSPACE, "packages", "smarter-onboarding", "src", "index.tsx"),
  "@smarter.sh/ui-widgets": path.join(WORKSPACE, "packages", "smarter.sh-widgets", "src", "index.tsx"),
};
