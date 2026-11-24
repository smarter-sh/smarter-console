/**
 * NewestDoodles dashboard widget.
 *
 * This component renders the newest doodles that the Smarter Doodle Artist drew for the
 * sign-in page, in any region: each doodle's artwork, as a thumbnail, and its title, which
 * both open the console's page of the doodle, /doodles/<date>/<region>/, a copy of the
 * sign-in page that shows it; its caption, which links to the page it links to on the
 * sign-in page, in a new tab; its region and its date. The links to the doodle's page are
 * plain links, which the console opens in place, as it does every link to one of its pages. Every user sees the same doodles. On a platform without the artist,
 * the list is empty and the widget renders nothing; it also renders nothing while the
 * doodles load, so that such a platform never shows a card that then disappears. If the
 * doodles fail to load, it shows the error.
 *
 * :param sessionContext: Session context used for authenticated requests.
 * :type sessionContext: SessionContext
 * :param apiUrl: Endpoint used to request the newest doodles.
 * :type apiUrl: str
 *
 * :returns: A JSX element containing the doodles card, or null.
 * :rtype: JSX.Element | null
 *
 * :example:
 *
 *     <NewestDoodles sessionContext={sessionContext} apiUrl="/api/web/dashboard/doodles/" />
 */
import { gettext, interpolateNodes } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import useDashboardApi from "../../hooks/useDashboardApi";
import "./styles.css";

/** A doodle that the artist drew. See DrawnDoodle in smarter.apps.doodle.contract.models. */
export interface DrawnDoodle {
  /** The doodle's date, e.g. 2026-11-19. */
  date: string;
  /** The region's slug, e.g. mx. */
  region: string;
  /** The region, as people read it, e.g. Mexico. */
  regionName: string;
  /** The theme's slug. */
  theme: string;
  /** What the doodle celebrates, e.g. Revolution Day. */
  title: string;
  /** The caption below the artwork. Empty for none. */
  caption: string;
  /** The artwork's description, for screen readers. */
  altText: string;
  /** Where the caption links to. Empty for nowhere. */
  linkUrl: string;
  /** The artwork's url. */
  imageUrl: string;
  isDefault: boolean;
  /** What a Smarter AI application did for the doodle: chose it, drew it too, or nothing. */
  aiCredit: "" | "chosen" | "drawn";
}

/** The response of POST /api/web/dashboard/doodles/. See DrawnDoodlesResponse. */
export interface DrawnDoodlesResponse {
  /** The newest first. */
  doodles: DrawnDoodle[];
}

interface NewestDoodlesProps {
  sessionContext: SessionContext;
  apiUrl: string;
}

/**
 * The console's page of a doodle, which shows it as the sign-in page does.
 *
 * @param doodle - The doodle.
 * @returns Its path, e.g. /doodles/2026-11-19/mx/.
 */
function doodlePath(doodle: Pick<DrawnDoodle, "date" | "region">): string {
  return `/doodles/${encodeURIComponent(doodle.date)}/${encodeURIComponent(doodle.region)}/`;
}

/** The doodle's date, e.g. Nov 19, 2026, as it is in every time zone: the date is the region's, not the viewer's. */
function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" });
}

function DoodleTile({ doodle }: { doodle: DrawnDoodle }) {
  return (
    <li className="col-6 col-md-4 col-xl-2">
      <a href={doodlePath(doodle)} className="newest-doodles-artwork d-block mb-3">
        <img src={doodle.imageUrl} alt={doodle.altText} loading="lazy" />
      </a>
      <a href={doodlePath(doodle)} className="d-block fw-bold text-gray-900 text-hover-primary fs-6">
        {doodle.title}
      </a>
      {doodle.caption &&
        (doodle.linkUrl ? (
          <a
            href={doodle.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="d-block text-gray-700 text-hover-primary fs-7"
          >
            {doodle.caption}
          </a>
        ) : (
          <div className="text-gray-700 fs-7">{doodle.caption}</div>
        ))}
      <div className="text-muted fs-8 mt-1">
        {doodle.regionName} · <time dateTime={doodle.date}>{formatDate(doodle.date)}</time>
      </div>
    </li>
  );
}

function NewestDoodles({ sessionContext, apiUrl }: NewestDoodlesProps) {
  const { data, error } = useDashboardApi<DrawnDoodlesResponse>(sessionContext, apiUrl);
  const doodles = data?.doodles ?? [];

  let body;
  if (error) {
    body = (
      <div className="text-danger fs-7">
        {interpolateNodes(gettext("Failed to load the newest doodles: %(error)s"), { error })}
      </div>
    );
  } else if (doodles.length === 0) {
    // loading, or a platform without the artist: no card at all.
    return null;
  } else {
    body = (
      <ul className="list-unstyled row g-5 mb-0">
        {doodles.map((doodle) => (
          <DoodleTile key={`${doodle.date}-${doodle.region}-${doodle.theme}`} doodle={doodle} />
        ))}
      </ul>
    );
  }

  return (
    <div className="row g-5 g-xl-10">
      <div className="col-xl-12 mb-5 mb-xl-10">
        <section id="newest-doodles" aria-label={gettext("Newest Doodles")} className="card border-transparent">
          <div className="card-header border-0 pt-5">
            <h3 className="card-title align-items-start flex-column">
              <span className="card-label fw-bold text-gray-900">{gettext("Newest Doodles")}</span>
              <span className="text-muted mt-1 fw-semibold fs-7">
                {gettext("Drawn for the sign-in page by the Smarter Doodle Artist")}
              </span>
            </h3>
          </div>
          <div className="card-body pt-3">{body}</div>
        </section>
      </div>
    </div>
  );
}

export default NewestDoodles;
