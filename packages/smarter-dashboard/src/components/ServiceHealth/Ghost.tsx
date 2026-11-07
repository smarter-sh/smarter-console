/**
 * The ghost of the Service Health card: gray placeholders in the shape of its content, shown
 * while the content loads, or when it can't be loaded, so that the dashboard keeps its layout.
 *
 * Each placeholder has the size of what it stands in for: the subtitle in the header, the
 * runtime versions, the ring, the heading and status, the four check tiles, and the CI badges. They are
 * @smarter/common's Skeletons: they shimmer while loading, and are still when loading failed. Screen readers skip
 * them.
 */
import { createContext, useContext } from "react";
import { Skeleton } from "@smarter/common";

/** Whether the card is loading, and its ghost shimmers; it is still when loading failed. */
const Loading = createContext(true);

/** A gray bar of a given width and height, in rem. */
function Bar({ width, height = 0.75, className = "" }: { width: number; height?: number; className?: string }) {
  const loading = useContext(Loading);
  return <Skeleton width={width} height={height} still={!loading} className={className} />;
}

/** The ghost of the header's subtitle. */
export function GhostHeader({ loading = true }: { loading?: boolean }) {
  return (
    <Loading.Provider value={loading}>
      <span className="d-flex flex-column gap-2 mt-2" aria-hidden="true" data-testid="service-health-ghost-header">
        <Bar width={15} height={0.8} />
      </span>
    </Loading.Provider>
  );
}

/** The ghost of the card's body. */
export function GhostBody({ loading = true }: { loading?: boolean }) {
  return (
    <Loading.Provider value={loading}>
      <GhostBodyShapes />
    </Loading.Provider>
  );
}

/** The shapes of the card's body. */
function GhostBodyShapes() {
  const loading = useContext(Loading);
  return (
    <div aria-hidden="true" data-testid="service-health-ghost">
      <Bar width={16} height={0.6} className="mb-3" />
      <div className="d-flex align-items-center gap-4 mb-4">
        <Skeleton shape="circle" width="76px" height="76px" still={!loading} className="service-health-ghost-ring" />
        <div className="flex-grow-1 min-w-0">
          <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
            <Bar width={7} height={0.6} />
            <Bar width={6} height={0.9} />
          </div>
          <ul className="service-health-checks">
            {[0, 1, 2, 3].map((tile) => (
              <li key={tile} className="service-health-check service-health-ghost-tile">
                <Bar width={1.5} height={1.5} className="me-3 flex-shrink-0" />
                <span className="d-flex flex-column gap-1">
                  <Bar width={4.5} height={0.7} />
                  <Bar width={3} height={0.55} />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="service-health-footer d-flex gap-2">
        <Bar width={5.5} height={1.1} />
        <Bar width={5} height={1.1} />
        <Bar width={5.75} height={1.1} />
      </div>
    </div>
  );
}
