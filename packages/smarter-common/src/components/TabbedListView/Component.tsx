/**
 * TabbedListView React Component
 *
 * Displays a tabbed interface for viewing objects owned by the current user
 * and objects shared with the user, one page at a time.
 *
 * Tabs:
 * - Your LLMClients
 * - Shared LLMClients
 *
 * The tabs are those of the tabbedListViewContext, whose keys are the slugs of the list api that
 * loads them, e.g. "owned" and "shared". A tab may also have its own ListView, DetailView and object
 * type name, e.g. the read-only Extensions tab of the LLMTool list, whose objects are not LLMTools.
 *
 * Each row of the list opens the resource's detail, ResourceDetail, when it is clicked, or when it has the focus
 * and Enter is pressed. A click on a row's links, buttons or chips does what they do instead. The detail's tabs are
 * the list's DetailView, the resource's manifest, the hierarchy of the resources that it uses, and the resources
 * that use it. Its Previous and Next buttons, and the arrow keys, browse the list from the detail, from one page to
 * the next. The detail closes when the tab, the search, the sort or what narrows the list changes. The page's url
 * names the open detail, ?detail=<record locator>, and a page opened with one, e.g. from a result of the
 * dashboard's search, opens that resource's detail once its tab loads.
 *
 * Features:
 * - Loads owned and shared llmclient lists from the backend using session context.
 * - Paginates each tab: previous and next page buttons, and a page number box. The backend
 *   paginates, so each page is a request to the list api, for ?page=N.
 * - Searches both tabs: the backend searches all of the objects, not only the page shown, so
 *   the search is a request to the list api, for ?search=..., once typing pauses. A new search
 *   returns each tab to its first page.
 * - Sorts both tabs by a column, when the list view's header of the column is clicked (see
 *   SortableHeader): the backend sorts all of the objects, not only the page shown, so a new sort
 *   is a request to the list api, for ?ordering=name or ?ordering=-name, and it returns each tab
 *   to its first page. The list api says which columns it can sort by.
 * - Narrows both tabs by a named filter of the list api, when the page is opened with
 *   ?filter=<name>, e.g. the dashboard's pending deployments link, ?filter=pending. A chip shows the
 *   filter's label, from the tabbedListViewContext's filters, and a button that removes it.
 * - Narrows both tabs by tags and by an annotation selector, ?tag=<name> and
 *   ?annotation=<requirement>, each repeatable: when the page is opened with them, e.g. from the
 *   dashboard's search, when a tag or annotation of an object is clicked (see Filtering), and when a
 *   requirement is typed in the annotation selector box. Each shows as a chip with a button that
 *   removes it, and the page's url follows them, so that it can be bookmarked or shared. The list
 *   api reports an invalid selector, which is shown under the box, and not applied.
 * - Opens searching, when the page is opened with ?search=<text>, which also follows the search.
 * - Shows a page from the console's cache (TanStack Query, see ../../lib/query) at once, when it holds it,
 *   while the page is fetched again, with a small spinner that says it is refreshing. While a new page,
 *   search, sort or narrowing loads, the tab keeps showing the page that it showed.
 * - Shows loading and error states during fetches.
 * - Uses cookie-backed counts (owned/shared) to size loading skeleton rows.
 * - Supports requery with cache invalidation, from the Refresh button at the top of the list, and
 *   from the list and card views after a clone, rename or delete.
 *
 * Props:
 * - sessionContext (SessionContext): Authentication and API context used for requests.
 *
 * State:
 * - pages: Each tab's requested page. Each tab's objects, loading state and pagination are its page's query.
 * - searchInput: The search as typed; search: the search requested, once typing pauses.
 * - ordering: The column that sorts both tabs, e.g. "name", or "-name" in descending order. Empty for the default order.
 * - activeTab: Current tab, the key of one of the tabbedListViewContext's tabs, e.g. "owned".
 * - selection: The row whose detail is open, by its tab and index on the tab's page, or null. While the detail
 *   moves to another page, pending says whether it shows that page's first or last row, once it loads.
 *
 * Internal Helpers:
 * - getCookie: Reads cookie values used for skeleton sizing.
 * - load (from ../../lib/load): The query function that fetches a page of a tab.
 *
 * Page Rendering Performance and Caching behavior:
 * - Each page is a query of TanStack Query, keyed by listQueryKey(api url), the tab, and the page's page number,
 *   search, ordering and narrowing. A page shown within QUERY_STALE_TIME_MS is shown again without a request;
 *   an older one is shown at once, and fetched again (stale-while-revalidate). The list api caches its pages too
 *   (smarter.lib.django.listview), so the fresh fetch is usually quick.
 * - The Refresh button, and a clone, rename or delete, mark every page of the list stale, and fetch each tab's
 *   page again with ?invalidate_cache=true, so that the list api rebuilds its own cache.
 * - The cache lives in memory, in the console's QueryClient, or in one of the list's own outside the console
 *   (see SmarterQueryProvider).
 *
 * Usage:
 * <TabbedListView sessionContext={sessionContext} />
 */
import { keepPreviousData, useQueries, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";

import type {
  DetailObject,
  DetailViewBaseProps,
  Filtering,
  ListQuery,
  ListViewBaseProps,
  Pagination,
  SessionContext,
  Sorting,
  TabbedViewContext,
  TabKey,
} from "../../lib/Types";
import { load } from "../../lib/load";
import { loggerPrefix } from "../../lib/const";
import { listQueryKey, SmarterQueryProvider } from "../../lib/query";

import ResourceDetail from "../ResourceDetail";

import { getCookieForUrl } from "./cookie";
import { PaginationControls } from "./PaginationControls";
import { AnnotationSelectorBox } from "./AnnotationSelectorBox";
import { FilterChip } from "./FilterChip";
import { SearchBox } from "./SearchBox";
import { TabNav } from "./TabNavigation";
import { gettext, interpolate } from "../../lib/i18n";

type TabbedListViewProps<TObject> = {
  sessionContext: SessionContext;
  tabbedListViewContext: TabbedViewContext<TObject>;
};

// a tab's objects are of the list's object type, or of the tab's own (see Tab), so the tabbed
// list view holds them as unknown, and its views say what they are.
type TabList = {
  objects: unknown[];
  isLoading: boolean;
  /** Whether the objects shown are cached ones, or another page's, while the list api is asked for fresh ones. */
  isRefreshing: boolean;
  pagination: Pagination | null;
};

type TabRecord<T> = Record<TabKey, T>;

/** A record with a value for each tab. */
function tabRecord<T>(tabKeys: TabKey[], value: (tab: TabKey) => T): TabRecord<T> {
  return Object.fromEntries(tabKeys.map((tab) => [tab, value(tab)])) as TabRecord<T>;
}

/** The named filter that the page's url asks for, e.g. "pending" for ?filter=pending, or "". */
function filterOfPageUrl(): string {
  return new URLSearchParams(window.location.search).get("filter")?.trim() ?? "";
}

/** The distinct, non-empty values of a repeated parameter of the page's url, e.g. ["a", "b"] for ?tag=a&tag=b. */
function valuesOfPageUrl(name: string): string[] {
  const values = new URLSearchParams(window.location.search).getAll(name).map((value) => value.trim());
  return values.filter((value, index) => value && values.indexOf(value) === index);
}

/** Make a parameter of the page's url these values, or remove it, without a new history entry. */
function setPageUrlValues(name: string, values: string[]): void {
  const url = new URL(window.location.href);
  url.searchParams.delete(name);
  values.forEach((value) => url.searchParams.append(name, value));
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

/** What narrows both tabs, besides the search: the named filter, tags, and an annotation selector. */
type Narrowing = {
  filter: string;
  tags: string[];
  annotations: string[];
};

/** The row whose detail is open: its tab, and its index on the tab's page. See TabbedListView's selection. */
type Selection = {
  tab: TabKey;
  index: number;
  /** After the detail moved to another page: whether it shows that page's first or last row, once it loads. */
  pending?: "first" | "last";
  /** What the list showed when the detail opened: its search, sort and narrowing. See TabbedListView's shown. */
  shown: string;
};

/**
 * What a click on a row does itself, rather than open the row's detail: its links, buttons, form fields, chips,
 * menus, and the dialogs that its Toolbar opens.
 */
const ROW_CONTROLS =
  "a, button, input, select, textarea, label, summary, [role='button'], [role='menu'], [role='menuitem'], [role='dialog'], .dropdown-menu";

/** The rows of a list view's table that are objects: not its loading skeleton's ghost rows. */
const OBJECT_ROWS = "tbody > tr:not(.ghost)";

/** The record locator of an object's detail, e.g. guardrail-rMTAwx: the last part of its detailUrl, or "". */
export function detailLocator(object: unknown): string {
  const url = (object as DetailObject | null | undefined)?.detailUrl ?? "";
  return url.split("/").filter(Boolean).pop() ?? "";
}

/** What a list shows, as a key: its search, its sort, and what narrows it. A detail is open for one of these. */
function shownOf(search: string, ordering: string, narrowing: Narrowing): string {
  return JSON.stringify([search, ordering, narrowing]);
}

/** How long to wait after the last keystroke of a search before it is requested, in milliseconds. */
export const SEARCH_DELAY_MS = 300;

// throttle duration for requerying to prevent excessive backend requests
const REQUERY_THROTTLE_MS = 2000;

/** Whether a requery comes too soon after the last one, which the ref holds the time of. Otherwise it records it. */
function throttled(last: { current: number | null }): boolean {
  const now = Date.now();
  if (last.current && now - last.current < REQUERY_THROTTLE_MS) return true;
  last.current = now;
  return false;
}

/** The query of a page of a tab: what load() requests. */
function pageQuery(page: number, search: string, ordering: string, narrowing: Narrowing): ListQuery {
  return { page, search, ordering, ...narrowing };
}

/**
 * The tabbed list, with the console's QueryClient, or one of its own outside the console. See SmarterQueryProvider.
 */
export default function TabbedListView<TObject>(props: TabbedListViewProps<TObject>) {
  return (
    <SmarterQueryProvider>
      <TabbedList {...props} />
    </SmarterQueryProvider>
  );
}

function TabbedList<TObject>({ sessionContext, tabbedListViewContext }: TabbedListViewProps<TObject>) {
  const tabs = tabbedListViewContext.tabs;
  const tabKeys = useMemo(() => tabs.map((tab) => tab.key), [tabs]);
  const queryClient = useQueryClient();

  // a tab shows its loading skeleton until its first page arrives, unless the cache already holds it. The
  // skeletons use cookie-backed counts to size themselves to whatever they'd most recently been, which should help
  // prevent jarring resizing when the real data loads.
  // the named filter of both tabs, from the page's url.
  const [filter, setFilter] = useState(filterOfPageUrl);
  // the tags and annotation selector of both tabs, from the page's url, then from the chips and the selector box.
  const [tags, setTags] = useState(() => valuesOfPageUrl("tag"));
  const [annotations, setAnnotations] = useState(() => valuesOfPageUrl("annotation"));
  const narrowing = useMemo<Narrowing>(() => ({ filter, tags, annotations }), [filter, tags, annotations]);

  // each tab's requested page, and the search of both tabs. searchInput is the search as it is
  // typed, and search follows it once typing pauses, so that every keystroke is not a request.
  const [pages, setPages] = useState<TabRecord<number>>(() => tabRecord(tabKeys, () => 1));
  const [searchInput, setSearchInput] = useState(() => new URLSearchParams(window.location.search).get("search") ?? "");
  const [search, setSearch] = useState(() => searchInput.trim());
  // the column that sorts both tabs, as the list api names it, e.g. "-name". Empty for its default order.
  const [ordering, setOrdering] = useState("");
  // the detail that the page's url asks for, ?detail=<record locator>, e.g. from a result of the dashboard's
  // search. It opens once a tab that has the resource loads, and only while the list shows what it did then.
  const [deepLink, setDeepLink] = useState(() => {
    const locator = valuesOfPageUrl("detail")[0];
    return locator ? { locator, shown: shownOf(searchInput.trim(), "", { filter, tags, annotations }) } : null;
  });

  // for sizing the skeleton loaders that are rendered if no cached data is available
  const maxGhostRows = 25;
  const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
  const ghostCount = (tab: TabKey) => clamp(getCookieForUrl(sessionContext.ApiUrl + tab + "/") || 6, 0, maxGhostRows);

  const [activeTab, _setActiveTab] = useState<TabKey>(() => tabKeys[0]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const setActiveTab = (tab: TabKey) => {
    setSelection(null);
    setDeepLink(null);
    _setActiveTab(tab);
  };
  // the list view's table, whose rows open their details.
  const listRef = useRef<HTMLDivElement>(null);

  const requeryRef = useRef<number | null>(null);

  // each tab's page: a query, keyed by the list, the tab and what the page shows. TanStack Query shows the cached
  // page at once, fetches it again when it is stale, and keeps showing the tab's previous page while a new one
  // loads. Only the latest page of a tab is shown, and a fetch that is no longer needed is aborted.
  const listKey = useMemo(() => listQueryKey(sessionContext.ApiUrl), [sessionContext.ApiUrl]);
  const pageKey = (tab: TabKey, query: ListQuery) => [...listKey, tab, query];
  const results = useQueries({
    queries: tabKeys.map((tab) => {
      const query = pageQuery(pages[tab] ?? 1, search, ordering, narrowing);
      return {
        queryKey: pageKey(tab, query),
        queryFn: ({ signal }: { signal: AbortSignal }) => {
          console.debug(`${loggerPrefix} loading the ${tab} objects:`, query);
          return load<unknown>(sessionContext, false, tab, query, signal);
        },
        placeholderData: keepPreviousData,
      };
    }),
  });
  const lists: TabRecord<TabList> = tabRecord(tabKeys, (tab) => {
    const result = results[tabKeys.indexOf(tab)];
    return {
      objects: result.data?.objects ?? [],
      isLoading: result.data === undefined,
      isRefreshing: result.isFetching && result.data !== undefined,
      pagination: result.data?.pagination ?? null,
    };
  });
  // a tab's failed request, until it is requested again.
  const failed = results.find((result) => result.isError && !result.isFetching);
  const errorMessage = failed?.error?.message ?? null;

  const onPage = (page: number) => {
    console.debug(`${loggerPrefix} onPage() going to page ${page} of the ${activeTab} objects`);
    setPages((prev) => ({ ...prev, [activeTab]: page }));
  };

  // sort both tabs by a column, from their first pages.
  const onSort = (requested: string) => {
    console.debug(`${loggerPrefix} onSort() sorting by "${requested}", reloading the first page of each tab`);
    setPages(tabRecord(tabKeys, () => 1));
    setOrdering(requested);
  };

  // show every object again: remove the filter, from the list and from the page's url.
  const clearFilter = () => {
    console.debug(
      `${loggerPrefix} clearFilter() removing the "${filter}" filter, reloading the first page of each tab`,
    );
    const url = new URL(window.location.href);
    url.searchParams.delete("filter");
    window.history.replaceState(window.history.state, "", url);
    setPages(tabRecord(tabKeys, () => 1));
    setFilter("");
  };

  // narrow both tabs by one more tag or annotation requirement, or by one fewer, from their first pages.
  const narrowBy = (name: "tag" | "annotation", values: string[], setValues: (values: string[]) => void) => {
    console.debug(`${loggerPrefix} narrowBy() ${name}=${JSON.stringify(values)}, reloading the first page of each tab`);
    setPageUrlValues(name, values);
    setPages(tabRecord(tabKeys, () => 1));
    setValues(values);
  };
  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) narrowBy("tag", [...tags, tag], setTags);
  };
  const removeTag = (tag: string) =>
    narrowBy(
      "tag",
      tags.filter((item) => item !== tag),
      setTags,
    );
  const addAnnotation = (requirement: string) => {
    const trimmed = requirement.trim();
    if (trimmed && !annotations.includes(trimmed)) narrowBy("annotation", [...annotations, trimmed], setAnnotations);
  };
  const removeAnnotation = (requirement: string) =>
    narrowBy(
      "annotation",
      annotations.filter((item) => item !== requirement),
      setAnnotations,
    );
  const filtering: Filtering = { tags, annotations, onTag: addTag, onAnnotation: addAnnotation };

  // request the search once typing pauses, from the first page of each tab.
  useEffect(() => {
    const timer = setTimeout(() => {
      const requested = searchInput.trim();
      if (requested === search) return;
      console.debug(`${loggerPrefix} search changed to "${requested}", reloading the first page of each tab`);
      setPageUrlValues("search", requested ? [requested] : []);
      setPages(tabRecord(tabKeys, () => 1));
      setSearch(requested);
    }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput, search, tabKeys]);

  const onRequery = () => {
    console.debug(`${loggerPrefix} onRequery() called, reloading data and invalidating the backend cache`);
    if (tabKeys.some((tab) => lists[tab]?.isLoading)) {
      return;
    }
    // throttle to prevent excessive requerying if user clicks multiple times in a short span
    if (throttled(requeryRef)) {
      return;
    }
    // every page of the list is stale, and is fetched again when it is shown. Each tab's page is fetched now, and
    // asks the list api to rebuild its own cache (Django-Redis), e.g. after a clone, rename or delete.
    void queryClient.invalidateQueries({ queryKey: listKey, refetchType: "none" });
    tabKeys.forEach((tab) => {
      const query = pageQuery(pages[tab] ?? 1, search, ordering, narrowing);
      const queryKey = pageKey(tab, query);
      void queryClient
        .cancelQueries({ queryKey, exact: true })
        .then(() =>
          queryClient.fetchQuery({
            queryKey,
            queryFn: ({ signal }) => load<unknown>(sessionContext, true, tab, query, signal),
            staleTime: 0,
          }),
        )
        .catch((error: unknown) =>
          console.error(`${loggerPrefix} onRequery() could not reload the ${tab} objects:`, error),
        );
    });
  };

  // the detail that is open. It closes when what the list shows changes: its search, its sort, or what narrows it.
  const shown = shownOf(search, ordering, narrowing);
  // the detail of the page's url, until a row is chosen: the row of any tab whose detail is the url's.
  const linked: Selection | null = (() => {
    if (selection || !deepLink || deepLink.shown !== shown) return null;
    for (const key of tabKeys) {
      const index = lists[key].objects.findIndex((object) => detailLocator(object) === deepLink.locator);
      if (index >= 0) return { tab: key, index, shown };
    }
    return null;
  })();
  const current = selection && selection.shown === shown ? selection : linked;
  const selectedList = current ? lists[current.tab] : null;
  // the detail that moved to another page shows the row that it left, until that page loads, and then that page's
  // first or last row. A detail whose row is gone, e.g. deleted from the detail, shows the page's last row, and
  // closes if the page has none.
  const pageLoaded =
    !!current &&
    !!selectedList &&
    !selectedList.isLoading &&
    (!selectedList.pagination || selectedList.pagination.page === (pages[current.tab] ?? 1));
  const isNavigating = !!current?.pending && !pageLoaded;
  const selectedIndex: number | null = (() => {
    if (!current || !selectedList) return null;
    const count = selectedList.objects.length;
    if (count === 0) return null;
    if (current.pending && pageLoaded) return current.pending === "last" ? count - 1 : 0;
    return Math.min(current.index, count - 1);
  })();

  // the page's url names the detail that is open, ?detail=<record locator>, so that it can be bookmarked, shared,
  // and opened again on a reload. It keeps the url's detail until that resource's tab has loaded.
  const openLocator = selectedList && selectedIndex !== null ? detailLocator(selectedList.objects[selectedIndex]) : "";
  const awaitingLink = !current && !!deepLink && deepLink.shown === shown;
  useEffect(() => {
    if (!awaitingLink) setPageUrlValues("detail", openLocator ? [openLocator] : []);
  }, [openLocator, awaitingLink]);

  // each row of the list view can have the focus, and the row whose detail is open stands out. The list view
  // renders its rows a few at a time, so this follows its table as it changes.
  const highlighted = current?.tab === activeTab && !isNavigating ? selectedIndex : null;
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const sync = () => {
      container.querySelectorAll<HTMLTableRowElement>(OBJECT_ROWS).forEach((row, index) => {
        if (!row.hasAttribute("tabindex")) row.tabIndex = 0;
        row.classList.toggle("smarter-row-selected", index === highlighted);
      });
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(container, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [highlighted, activeTab]);

  if (errorMessage) {
    return (
      <div className="alert alert-danger" role="alert">
        {errorMessage}
      </div>
    );
  }

  const tab = tabs.find((item) => item.key === activeTab) ?? tabs[0];
  const list = lists[tab.key];
  const ghostRows = ghostCount(tab.key);
  // the active tab's views: its own, or the list's. A tab's objects are those that its views show.
  const listViewOf = (key: TabKey) => tabs.find((item) => item.key === key)?.ListView ?? tabbedListViewContext.ListView;
  const ListView = listViewOf(tab.key) as React.ComponentType<ListViewBaseProps<unknown, SessionContext>>;
  const objectTypeName = tab.objectTypeName ?? tabbedListViewContext.objectTypeName;
  // the columns that the list api can sort by. The response of any tab with the same list view
  // says, so that the headers of a tab are sortable even before its own first response.
  const sameView = tabKeys.filter((key) => listViewOf(key) === listViewOf(tab.key));
  const pagination = list.pagination ?? sameView.map((key) => lists[key].pagination).find(Boolean);
  const sortFields = pagination?.sortFields ?? [];
  const sorting: Sorting = { ordering, sortFields, onSort };
  // the filter that applies: the api ignores, and reports as "", a filter that it doesn't offer.
  const appliedFilter = list.pagination ? (list.pagination.filter ?? filter) : filter;
  const filterLabel = tabbedListViewContext.filters?.[appliedFilter] ?? appliedFilter;
  const annotationError = list.pagination?.annotationError ?? "";

  /** The index of the row of the list view's table that an event happened in, or null for a row's own controls. */
  const rowIndexOf = (target: EventTarget | null): number | null => {
    if (!(target instanceof Element) || target.closest(ROW_CONTROLS)) return null;
    const row = target.closest("tr");
    if (!row || !listRef.current?.contains(row)) return null;
    const index = Array.from(listRef.current.querySelectorAll(OBJECT_ROWS)).indexOf(row);
    return index >= 0 && index < list.objects.length ? index : null;
  };
  const openRow = (index: number | null) => {
    if (index === null) return;
    console.debug(`${loggerPrefix} openRow() opening the detail of row ${index} of the ${tab.key} objects`);
    setSelection({ tab: tab.key, index, shown });
  };
  const onRowClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    // a click that ends a selection of the row's text leaves the text selected, so that it can be copied.
    if (window.getSelection()?.toString()) return;
    openRow(rowIndexOf(e.target));
  };
  const onRowKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if ((e.key !== "Enter" && e.key !== " ") || !(e.target instanceof HTMLTableRowElement)) return;
    const index = rowIndexOf(e.target);
    if (index === null) return;
    e.preventDefault();
    openRow(index);
  };

  // the detail that is open, and how it browses the list: within the page, and on to the previous or next page.
  const detail = (() => {
    if (!current || !selectedList || selectedIndex === null) return null;
    const objects = selectedList.objects;
    const index = selectedIndex;
    const object = objects[index];
    const selectedTab = tabs.find((item) => item.key === current.tab) ?? tab;
    const page = pages[current.tab] ?? 1;
    const tabPagination = selectedList.pagination;
    const numPages = tabPagination?.numPages ?? 1;
    const goTo = (next: Omit<Selection, "shown">) => {
      if (next.pending) {
        setPages((prev) => ({ ...prev, [next.tab]: page + (next.pending === "first" ? 1 : -1) }));
      }
      setSelection({ ...next, shown });
    };
    const onPrevious =
      index > 0
        ? () => goTo({ tab: current.tab, index: index - 1 })
        : page > 1
          ? () => goTo({ tab: current.tab, index: 0, pending: "last" })
          : undefined;
    const onNext =
      index < objects.length - 1
        ? () => goTo({ tab: current.tab, index: index + 1 })
        : page < numPages
          ? () => goTo({ tab: current.tab, index: 0, pending: "first" })
          : undefined;
    const position = tabPagination
      ? { index: (tabPagination.page - 1) * tabPagination.pageSize + index + 1, count: tabPagination.count }
      : { index: index + 1, count: objects.length };
    return (
      <ResourceDetail
        sessionContext={sessionContext}
        object={object}
        objectTypeName={selectedTab.objectTypeName ?? tabbedListViewContext.objectTypeName}
        DetailView={
          (selectedTab.DetailView ?? tabbedListViewContext.DetailView) as React.ComponentType<
            DetailViewBaseProps<unknown, SessionContext>
          >
        }
        onRequery={onRequery}
        filtering={filtering}
        position={position}
        onPrevious={onPrevious}
        onNext={onNext}
        isNavigating={isNavigating}
        onClose={() => {
          setSelection(null);
          setDeepLink(null);
        }}
      />
    );
  })();

  return (
    <div className="pt-5 pb-5 card card-flush h-xl-100">
      <div className="card-header rounded align-items-start ps-3" data-bs-theme="light">
        <TabNav activeTab={tab.key} onTabChange={setActiveTab} tabs={tabs} />
      </div>
      <div className="m-0 p-0 card-body list-view">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 pe-3">
          <div className="d-flex flex-wrap align-items-center gap-3 ps-3">
            {list.isRefreshing && (
              <span
                className="spinner-border spinner-border-sm text-primary opacity-75"
                role="status"
                title={gettext("Refreshing")}
                aria-label={gettext("Refreshing")}
              ></span>
            )}
            {appliedFilter && (
              <FilterChip
                // Translators: the label of the filter that narrows a list, e.g. "Pending deployment".
                label={interpolate(gettext("Showing: %(filter)s"), { filter: filterLabel })}
                removeLabel={gettext("Show all")}
                onRemove={clearFilter}
              />
            )}
            {tags.map((tag) => (
              <FilterChip
                key={`tag:${tag}`}
                // Translators: tag is a resource's tag, e.g. production.
                label={interpolate(gettext("Tag: %(tag)s"), { tag })}
                onRemove={() => removeTag(tag)}
              />
            ))}
            {annotations.map((requirement) => (
              <FilterChip
                key={`annotation:${requirement}`}
                // Translators: requirement is an annotation selector's requirement, e.g. acme.com/crm-id=A-1.
                label={interpolate(gettext("Annotation: %(requirement)s"), { requirement })}
                onRemove={() => removeAnnotation(requirement)}
              />
            ))}
          </div>
          <div className="d-flex flex-wrap align-items-start gap-3">
            <AnnotationSelectorBox onAdd={addAnnotation} error={annotationError} />
            <SearchBox
              value={searchInput}
              onChange={setSearchInput}
              placeholder={
                // Translators: objects is the plural of a resource kind's name, e.g. secrets.
                interpolate(gettext("Search %(objects)s"), { objects: `${objectTypeName}s` })
              }
            />
            <button
              type="button"
              className="btn btn-sm btn-light"
              disabled={list.isLoading || list.isRefreshing}
              title={gettext("Load the list again, with the latest changes")}
              onClick={onRequery}
            >
              <i className="ki-outline ki-arrows-circle fs-4 me-1" aria-hidden="true" />
              {gettext("Refresh")}
            </button>
          </div>
        </div>

        {/* a row opens its detail, when it is clicked, or when it has the focus and Enter is pressed. Each row
            is focusable (see above), so the keyboard reaches it, and its own controls keep their behavior. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div ref={listRef} className="smarter-selectable-rows" onClick={onRowClick} onKeyDown={onRowKeyDown}>
          <ListView
            key={tab.key}
            isLoading={list.isLoading}
            ghostRows={ghostRows}
            sessionContext={sessionContext}
            objects={list.objects}
            onRequery={onRequery}
            sorting={sorting}
            filtering={filtering}
          />
        </div>

        {list.pagination && list.pagination.count > 0 && (
          <PaginationControls pagination={list.pagination} disabled={list.isLoading} onPage={onPage} />
        )}
      </div>
      {detail}
    </div>
  );
}
