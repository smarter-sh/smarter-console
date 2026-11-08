/**
 * The Download My Data dialog, which the user menu's Download My Data item opens.
 *
 * It first explains what is about to happen: what the user will get, how long it takes, where the link
 * goes and for how long it works, and that Secrets' values are left out. Request my data starts an
 * export, with the console's account api, and the dialog then follows it, step by step: it lists the
 * steps, illustrates the one in progress, and counts the manifests as they are written. When the export
 * is done, it says where the email went; when it fails, it says why, and offers to try again. An export
 * that is already in progress when the dialog opens is followed from where it is.
 *
 * It is a modal. Escape, the close button and a click on the backdrop close it, and Tab keeps the focus
 * inside it. Closing it doesn't stop the export: the email comes anyway.
 *
 * :param sessionContext: The cookies and headers of the requests.
 * :param apiUrl: The data export api's url, /api/web/account/data-export/.
 * :param onClose: Called when the user closes the dialog.
 * :param pollInterval: Milliseconds between the requests for the export's progress.
 * :param stepDuration: The fewest milliseconds that each step shows, so that its illustration plays.
 */
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { gettext, interpolate, ngettext, type SessionContext } from "@smarter/common";

import { DoneIllustration, FailedIllustration, IntroIllustration, StepIllustration } from "./illustrations";
import { exportSteps, formatSize, isFinished, nextShownIndex, STEP_COUNT, stepIndex } from "./steps";
import { getDataExport, getDataExportOverview, startDataExport } from "../../lib/api";
import { loggerPrefix } from "../../lib/const";
import type { DataExportOverview, DataExportProgress } from "../../lib/Types";
import "./styles.css";

interface DataExportDialogProps {
  sessionContext: SessionContext;
  apiUrl: string;
  onClose: () => void;
  pollInterval?: number;
  stepDuration?: number;
}

const FOCUSABLE = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** How many hours the link works when the overview hasn't said. */
const DEFAULT_LINK_HOURS = 24;

type Phase = "loading" | "intro" | "progress" | "done" | "failed";

/** The phase that the dialog shows, from what it knows. */
function phaseOf(overview: DataExportOverview | null, progress: DataExportProgress | null, shown: number): Phase {
  if (progress === null) {
    return overview === null ? "loading" : "intro";
  }
  if (progress.status === "succeeded" && shown >= STEP_COUNT) return "done";
  if (progress.status === "failed" && shown >= stepIndex(progress.step)) return "failed";
  return "progress";
}

function DataExportDialog({
  sessionContext,
  apiUrl,
  onClose,
  pollInterval = 1000,
  stepDuration = 900,
}: DataExportDialogProps) {
  const [overview, setOverview] = useState<DataExportOverview | null>(null);
  const [progress, setProgress] = useState<DataExportProgress | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const titleId = useId();
  const leadId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const steps = exportSteps();
  const phase = phaseOf(overview, progress, shown);
  const linkHours = overview?.linkHours ?? DEFAULT_LINK_HOURS;

  // the overview, and the export in progress, if any, which the dialog then follows.
  useEffect(() => {
    let active = true;
    getDataExportOverview(apiUrl)
      .then((data) => {
        if (!active) return;
        setOverview(data);
        if (data.latest && !isFinished(data.latest)) {
          setShown(stepIndex(data.latest.step));
          setProgress(data.latest);
        }
      })
      .catch((err: Error) => {
        if (!active) return;
        console.error(loggerPrefix, "Error loading the data export overview", err);
        setError(err.message);
        setOverview({ email: "", linkHours: DEFAULT_LINK_HOURS, exportsPerDay: 0, exportsLeftToday: 0, latest: null });
      });
    return () => {
      active = false;
    };
  }, [apiUrl]);

  // the export's progress, until it finishes.
  useEffect(() => {
    if (progress === null || isFinished(progress)) return;
    const timer = window.setTimeout(() => {
      getDataExport(apiUrl, progress.id)
        .then(setProgress)
        .catch((err: Error) => {
          console.error(loggerPrefix, "Error loading the data export's progress", err);
          setProgress({ ...progress, status: "failed", error: err.message });
        });
    }, pollInterval);
    return () => window.clearTimeout(timer);
  }, [apiUrl, progress, pollInterval]);

  // the step that shows moves toward the export's, one at a time, so that each illustration plays.
  useEffect(() => {
    if (progress === null) return;
    const next = nextShownIndex(shown, progress);
    if (next === shown) return;
    const timer = window.setTimeout(() => setShown(next), stepDuration);
    return () => window.clearTimeout(timer);
  }, [progress, shown, stepDuration]);

  // the focus moves onto each phase's main button.
  useEffect(() => {
    if (phase === "progress") {
      closeRef.current?.focus();
    } else {
      primaryRef.current?.focus();
    }
  }, [phase]);

  useEffect(() => {
    // the page behind the modal doesn't scroll while it's open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, []);

  const start = useCallback(() => {
    setStarting(true);
    setError(null);
    startDataExport(sessionContext, apiUrl)
      .then((started) => {
        setShown(stepIndex(started.step));
        setProgress(started);
      })
      .catch((err: Error) => {
        console.error(loggerPrefix, "Error starting a data export", err);
        setError(err.message);
      })
      .finally(() => setStarting(false));
  }, [apiUrl, sessionContext]);

  const tryAgain = () => {
    setProgress(null);
    setShown(0);
    if (overview) {
      setOverview({ ...overview, exportsLeftToday: Math.max(0, overview.exportsLeftToday - 1) });
    }
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "Tab") {
      // keep the focus inside the dialog.
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const end = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        end.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  const email = progress?.email || overview?.email || "";
  const canStart = Boolean(overview && overview.email && overview.exportsLeftToday > 0 && !starting);

  let art = <IntroIllustration />;
  if (phase === "progress") art = <StepIllustration key={shown} step={steps[Math.min(shown, STEP_COUNT - 1)].name} />;
  if (phase === "done") art = <DoneIllustration />;
  if (phase === "failed") art = <FailedIllustration />;

  return (
    // Clicking the backdrop closes the dialog: a mouse convenience, whose keyboard equivalent is Escape.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="smarter-dx-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- the dialog handles its own keys: Escape and Tab. */}
      <div
        ref={dialogRef}
        className="smarter-dx-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={leadId}
        onKeyDown={handleKeyDown}
      >
        <button
          type="button"
          className="smarter-dx-close btn btn-icon btn-sm btn-active-light"
          onClick={onClose}
          aria-label={gettext("Close")}
          title={gettext("Close")}
        >
          <i className="ki-outline ki-cross fs-1"></i>
        </button>

        <div className="smarter-dx-art-panel">
          <div key={phase} className="smarter-dx-figure">
            {art}
          </div>
        </div>

        <div className="smarter-dx-body">
          <div key={phase} className="smarter-dx-phase">
            <div className="smarter-dx-eyebrow">{gettext("Download My Data")}</div>

            {(phase === "loading" || phase === "intro") && (
              <>
                <h2 id={titleId} className="smarter-dx-title">
                  {gettext("Get a copy of your data")}
                </h2>
                <p id={leadId} className="smarter-dx-lead">
                  {gettext(
                    "Everything that you've built on Smarter is described by manifests. Download them all, to keep, to put under version control, or to apply to another Smarter platform.",
                  )}
                </p>
                <ul className="smarter-dx-highlights">
                  <li>
                    <span className="smarter-dx-icon">
                      <i className="ki-outline ki-document fs-2"></i>
                    </span>
                    <span>
                      <span className="smarter-dx-highlight-title">{gettext("What you'll get")}</span>
                      <span className="smarter-dx-highlight-description">
                        {gettext(
                          "A zip file with the manifest of every resource that you own, in every account that you belong to: one YAML file per resource, and a README.",
                        )}
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="smarter-dx-icon">
                      <i className="ki-outline ki-time fs-2"></i>
                    </span>
                    <span>
                      <span className="smarter-dx-highlight-title">{gettext("How long it takes")}</span>
                      <span className="smarter-dx-highlight-description">
                        {gettext(
                          "Usually a few seconds. You can close this window at any time: the email comes either way.",
                        )}
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="smarter-dx-icon">
                      <i className="ki-outline ki-sms fs-2"></i>
                    </span>
                    <span>
                      <span className="smarter-dx-highlight-title">{gettext("Where it goes")}</span>
                      <span className="smarter-dx-highlight-description">
                        {email
                          ? interpolate(
                              gettext("A download link is emailed to %(email)s. It works for %(hours)s hours."),
                              { email, hours: linkHours },
                            )
                          : interpolate(gettext("A download link is emailed to you. It works for %(hours)s hours."), {
                              hours: linkHours,
                            })}
                      </span>
                    </span>
                  </li>
                  <li>
                    <span className="smarter-dx-icon">
                      <i className="ki-outline ki-lock fs-2"></i>
                    </span>
                    <span>
                      <span className="smarter-dx-highlight-title">{gettext("Your secrets stay secret")}</span>
                      <span className="smarter-dx-highlight-description">
                        {gettext(
                          "Secrets' values are left out, because the link travels by email. Their names and settings are included.",
                        )}
                      </span>
                    </span>
                  </li>
                </ul>
                {phase === "loading" && (
                  <p className="text-muted fs-7" role="status">
                    {gettext("Loading…")}
                  </p>
                )}
                {phase === "intro" && overview && overview.exportsPerDay > 0 && overview.email === "" && (
                  <p className="text-danger fs-7" role="alert">
                    {gettext("Your account has no email address to send the download link to.")}
                  </p>
                )}
                {phase === "intro" && overview && overview.exportsPerDay > 0 && overview.exportsLeftToday === 0 && (
                  <p className="text-danger fs-7" role="alert">
                    {interpolate(
                      gettext("You can download your data %(count)s times a day. Please try again tomorrow."),
                      { count: overview.exportsPerDay },
                    )}
                  </p>
                )}
              </>
            )}

            {phase === "progress" && progress && (
              <>
                <h2 id={titleId} className="smarter-dx-title">
                  {gettext("Preparing your data…")}
                </h2>
                <p id={leadId} className="smarter-dx-lead">
                  {gettext("You can close this window. The email comes either way.")}
                </p>
                <ol className="smarter-dx-steps">
                  {steps.map((step, index) => {
                    let state = "pending";
                    if (index < shown) state = "done";
                    if (index === shown) state = "active";
                    return (
                      <li
                        key={step.name}
                        className={`smarter-dx-step smarter-dx-step-${state}`}
                        aria-current={state === "active" ? "step" : undefined}
                      >
                        <span className="smarter-dx-step-marker" aria-hidden="true">
                          {state === "done" ? <i className="ki-outline ki-check fs-4"></i> : index + 1}
                        </span>
                        <span className="smarter-dx-step-text">
                          <span className="smarter-dx-step-title">{step.title}</span>
                          <span className="smarter-dx-step-description">{step.description}</span>
                          {step.name === "manifests" && state === "active" && progress.resourceCount > 0 && (
                            <span className="smarter-dx-meter">
                              <span
                                className="smarter-dx-meter-bar"
                                role="progressbar"
                                aria-label={gettext("Manifests written")}
                                aria-valuemin={0}
                                aria-valuemax={progress.resourceCount}
                                aria-valuenow={progress.manifestCount}
                              >
                                <span
                                  className="smarter-dx-meter-fill"
                                  style={{
                                    width: `${Math.round((100 * progress.manifestCount) / progress.resourceCount)}%`,
                                  }}
                                ></span>
                              </span>
                              <span className="smarter-dx-meter-label">
                                {interpolate(gettext("%(done)s of %(total)s"), {
                                  done: progress.manifestCount,
                                  total: progress.resourceCount,
                                })}
                              </span>
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ol>
                <p className="visually-hidden" aria-live="polite">
                  {steps[Math.min(shown, STEP_COUNT - 1)].title}
                </p>
              </>
            )}

            {phase === "done" && progress && (
              <>
                <h2 id={titleId} className="smarter-dx-title">
                  {gettext("Check your inbox")}
                </h2>
                <p id={leadId} className="smarter-dx-lead">
                  {interpolate(
                    gettext("A link to your data is on its way to %(email)s. It works for %(hours)s hours."),
                    { email, hours: linkHours },
                  )}
                </p>
                <div className="smarter-dx-summary">
                  <div className="smarter-dx-stat">
                    <span className="smarter-dx-stat-value">{progress.manifestCount}</span>
                    <span className="smarter-dx-stat-label">
                      {ngettext("manifest", "manifests", progress.manifestCount)}
                    </span>
                  </div>
                  <div className="smarter-dx-stat">
                    <span className="smarter-dx-stat-value">{formatSize(progress.sizeBytes)}</span>
                    <span className="smarter-dx-stat-label">{gettext("zip file")}</span>
                  </div>
                </div>
                {progress.failedCount > 0 && (
                  <p className="text-warning fs-7">
                    {interpolate(
                      ngettext(
                        "%(count)s resource could not be exported. The README says which, and why.",
                        "%(count)s resources could not be exported. The README says which, and why.",
                        progress.failedCount,
                      ),
                      { count: progress.failedCount },
                    )}
                  </p>
                )}
                <p className="smarter-dx-note">
                  {gettext("Didn't get it? Look in your spam folder, or request your data again.")}
                </p>
              </>
            )}

            {phase === "failed" && progress && (
              <>
                <h2 id={titleId} className="smarter-dx-title">
                  {gettext("Your data couldn't be exported")}
                </h2>
                <p id={leadId} className="smarter-dx-lead">
                  {gettext("Something went wrong while your data was being prepared, and no email was sent.")}
                </p>
                {progress.error && (
                  <p className="text-danger fs-7" role="alert">
                    {progress.error}
                  </p>
                )}
              </>
            )}

            {error && phase !== "failed" && (
              <p className="text-danger fs-7" role="alert">
                {error}
              </p>
            )}
          </div>

          <div className="smarter-dx-footer">
            <div className="smarter-dx-quota">
              {phase === "intro" && overview && overview.exportsPerDay > 0 && (
                <>
                  {interpolate(gettext("%(left)s of %(count)s requests left today"), {
                    left: overview.exportsLeftToday,
                    count: overview.exportsPerDay,
                  })}
                </>
              )}
            </div>
            <div className="smarter-dx-actions">
              {(phase === "loading" || phase === "intro") && (
                <>
                  <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
                    {gettext("Cancel")}
                  </button>
                  <button
                    ref={primaryRef}
                    type="button"
                    className="btn btn-sm smarter-dx-primary"
                    disabled={!canStart}
                    onClick={start}
                  >
                    {starting ? gettext("Starting…") : gettext("Request my data")}
                  </button>
                </>
              )}
              {phase === "progress" && (
                <button ref={closeRef} type="button" className="btn btn-sm btn-light" onClick={onClose}>
                  {gettext("Close")}
                </button>
              )}
              {phase === "done" && (
                <button ref={primaryRef} type="button" className="btn btn-sm smarter-dx-primary" onClick={onClose}>
                  {gettext("Done")}
                </button>
              )}
              {phase === "failed" && (
                <>
                  <button type="button" className="btn btn-sm btn-light" onClick={onClose}>
                    {gettext("Close")}
                  </button>
                  <button ref={primaryRef} type="button" className="btn btn-sm smarter-dx-primary" onClick={tryAgain}>
                    {gettext("Try again")}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DataExportDialog;
