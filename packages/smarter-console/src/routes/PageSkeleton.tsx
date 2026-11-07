/**
 * The skeleton of a page whose code is loading, in its frame (see lib/pageSkeleton): gray shapes in the layout of
 * the page to come, from @smarter/common's Skeletons. Screen readers hear Loading once.
 */
import { Skeleton, SkeletonRegion, SkeletonRows, SkeletonText } from "@smarter/common";
import type { SkeletonColumn } from "@smarter/common";

import type { PageSkeletonKind } from "@/lib/pageSkeleton";

/** A card, with a title, whose body is its children. */
function Card({
  height,
  children,
  className = "",
}: {
  height?: number;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`card card-flush h-100 ${className}`}>
      <div className="card-header pt-5">
        <Skeleton width={9} height={1.1} className="mt-2" />
      </div>
      <div className="card-body pt-2" style={height ? { minHeight: `${height}px` } : undefined}>
        {children ?? <SkeletonText lines={4} />}
      </div>
    </div>
  );
}

/** The dashboard: the search, three cards, then a wide one, and two charts. */
function DashboardSkeleton() {
  return (
    <>
      <div className="card mb-10">
        <div className="card-body py-6">
          <Skeleton shape="block" height={2.75} />
        </div>
      </div>
      <div className="row g-5 g-xl-10 mb-5 mb-xl-10">
        {[0, 1, 2].map((card) => (
          <div key={card} className="col-xl-4">
            <Card height={190} />
          </div>
        ))}
      </div>
      <div className="mb-5 mb-xl-10">
        <Card height={220} />
      </div>
      <div className="row g-5 g-xl-10">
        {[0, 1].map((chart) => (
          <div key={chart} className="col-xl-6">
            <Card>
              <Skeleton shape="block" width={8} height={2.1} className="d-block mb-4" />
              <Skeleton shape="block" height="320px" className="d-block" />
            </Card>
          </div>
        ))}
      </div>
    </>
  );
}

/** A list's columns, which the list's own skeleton rows replace once its code loads. */
const LIST_COLUMNS: SkeletonColumn[] = [
  "",
  "d-none d-lg-table-cell",
  "d-none d-lg-table-cell",
  { shape: "paragraph" },
  "d-none d-md-table-cell",
  "text-end",
];

/** A list: its tabs, its search and Refresh, and its table. */
function ListSkeleton() {
  return (
    <div className="pt-5 pb-5 card card-flush mt-5">
      <div className="card-header ps-3 align-items-center gap-3">
        <Skeleton width={8} height={1.1} />
        <Skeleton width={8} height={1.1} />
      </div>
      <div className="card-body m-0 p-0">
        <div className="d-flex justify-content-end gap-3 pe-3 mb-3">
          <Skeleton shape="block" width={11} height={2.4} />
          <Skeleton shape="block" width={11} height={2.4} />
          <Skeleton shape="block" width={6} height={2.4} />
        </div>
        <div className="table-responsive ps-3 pe-3">
          <table className="table align-middle border">
            <thead>
              <tr>
                {LIST_COLUMNS.map((column, index) => (
                  <th key={index} className={typeof column === "string" ? column || undefined : undefined}>
                    <Skeleton width={4} height={0.7} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SkeletonRows count={8} columns={LIST_COLUMNS} />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** A manifest's page: its name, and its editor's lines of YAML. */
function ManifestSkeleton() {
  return (
    <div className="row g-5 g-xl-10 mt-1">
      <div className="col-xl-8">
        <Skeleton width={14} height={1.6} className="d-block mb-6" />
        <div className="card">
          <div className="card-body">
            {[10, 6, 14, 12, 8, 16, 11, 7, 13, 9, 15, 6].map((width, line) => (
              <Skeleton key={line} width={width} height={0.8} className="d-block mb-3" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The workbench: the chat, and the console beside it. */
function WorkbenchSkeleton() {
  return (
    <div className="row g-5" style={{ minHeight: "80vh" }}>
      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-body d-flex flex-column gap-5">
            <Skeleton width={12} height={1.2} />
            <Skeleton shape="block" width="70%" height={4} />
            <Skeleton shape="block" width="55%" height={3} className="align-self-end" />
            <Skeleton shape="block" width="75%" height={5} />
            <Skeleton shape="block" height={3} className="mt-auto" />
          </div>
        </div>
      </div>
      <div className="col-lg-6">
        <div className="card h-100">
          <div className="card-header align-items-center gap-3">
            {[6, 7, 6, 8].map((width, tab) => (
              <Skeleton key={tab} width={width} height={1} />
            ))}
          </div>
          <div className="card-body">
            <SkeletonText lines={10} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A docs page: its title, and paragraphs. */
function DocsSkeleton() {
  return (
    <div className="py-5">
      <Skeleton width={16} height={2} className="d-block mb-6" />
      {[0, 1, 2].map((paragraph) => (
        <div key={paragraph} className="mb-6">
          <SkeletonText lines={4} />
        </div>
      ))}
    </div>
  );
}

/** Another page: its title, and a card. */
function GenericSkeleton() {
  return (
    <div className="mt-5">
      <Skeleton width={14} height={1.6} className="d-block mb-6" />
      <Card height={320} />
    </div>
  );
}

const SKELETONS: Record<PageSkeletonKind, () => React.JSX.Element> = {
  dashboard: DashboardSkeleton,
  list: ListSkeleton,
  manifest: ManifestSkeleton,
  workbench: WorkbenchSkeleton,
  docs: DocsSkeleton,
  page: GenericSkeleton,
};

/** The skeleton of a page of this shape. */
export function PageSkeleton({ kind }: { kind: PageSkeletonKind }) {
  const Shape = SKELETONS[kind];
  return (
    <SkeletonRegion className="smarter-page-skeleton">
      <Shape />
    </SkeletonRegion>
  );
}
