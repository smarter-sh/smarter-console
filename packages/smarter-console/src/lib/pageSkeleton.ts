/**
 * The skeleton of the page that a navigation opens, while its code loads.
 *
 * Each page's code is a chunk of its own (router.tsx), which loads the first time the page opens. Until it has, the
 * router keeps the previous page, so that on a slow network a click seems to do nothing. The console's frames show
 * the new page's skeleton instead (routes/PageSkeleton.tsx), in the shape of what it will show: a list, the
 * dashboard, a manifest's editor, the workbench, a docs page, or another page. A page whose code has loaded opens at
 * once, and shows none: the skeleton waits SKELETON_DELAY_MS before it shows.
 */
import { useEffect, useState } from "react";
import { matchPath, useNavigation } from "react-router";

import { DASHBOARD_PATH, EXTENSIONS_PATH } from "@/lib/const";
import { DOCS_PATH } from "@/lib/docs";
import { LIST_PAGES } from "@/lib/lists";
import { MANIFEST_PAGES } from "@/lib/manifestPages";
import { DROPZONE_PATH, PASSTHROUGH_PATH, TERMINAL_PATH } from "@/lib/tools";
import { WORKBENCH_PATH } from "@/lib/workbench";

/** The shapes of the console's pages. */
export type PageSkeletonKind = "dashboard" | "list" | "manifest" | "workbench" | "docs" | "page";

/** How long a navigation loads before its page's skeleton shows, in milliseconds: a page that is ready shows none. */
export const SKELETON_DELAY_MS = 150;

/** The console's pages, by path, and their shapes. The first that matches a path is its page's. */
const PAGES: { path: string; kind: PageSkeletonKind }[] = [
  { path: DASHBOARD_PATH, kind: "dashboard" },
  { path: DROPZONE_PATH, kind: "page" },
  { path: PASSTHROUGH_PATH, kind: "page" },
  { path: TERMINAL_PATH, kind: "page" },
  { path: WORKBENCH_PATH, kind: "workbench" },
  ...LIST_PAGES.map((page) => ({ path: page.path, kind: "list" as const })),
  ...MANIFEST_PAGES.map((page) => ({ path: page.path, kind: "manifest" as const })),
  { path: EXTENSIONS_PATH, kind: "list" },
  { path: `${EXTENSIONS_PATH}/:slug`, kind: "page" },
  { path: `${DOCS_PATH}/*`, kind: "docs" },
];

/**
 * The shape of the page at a path.
 *
 * @param pathname - The path, e.g. /guardrail.
 * @returns The page's shape, or null for a path that isn't one of the console's pages.
 */
export function pageSkeletonFor(pathname: string): PageSkeletonKind | null {
  for (const page of PAGES) {
    if (matchPath({ path: page.path, end: true }, pathname)) return page.kind;
  }
  return null;
}

/**
 * The skeleton to show in place of the page: that of the page that a navigation is loading, once it has loaded for
 * SKELETON_DELAY_MS, or null.
 *
 * @returns The page's shape, or null.
 */
export function useNavigationSkeleton(): PageSkeletonKind | null {
  const navigation = useNavigation();
  const pending = navigation.state === "loading" && navigation.location ? navigation.location.pathname : null;
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => setShown(pending), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pending]);

  // the skeleton of the navigation that is still loading, and not of one that has finished.
  if (!pending || shown !== pending) return null;
  return pageSkeletonFor(pending);
}
