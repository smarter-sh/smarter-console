/**
 * Apply a GitHub repository
 *
 * The Apply page's batch apply: the user enters a public GitHub repository's url, and the repository apply api
 * applies every Smarter manifest in it, in the order of their dependencies, as the user, in their account. The
 * page follows the run (polling its detail until it finishes or fails), lists the manifests that it discovered
 * with each one's status, and opens a failed or skipped manifest's details: why, what applying it printed, and
 * its file on GitHub.
 *
 * Beside it, the user's recent runs; choosing one shows it. When the page opens on a run that is still in
 * progress, it shows that run and follows it.
 *
 * :param sessionContext: The cookies and headers of the requests.
 * :param apiUrl: The repository apply api's url, /api/web/account/repository-apply/.
 * :param pollInterval: Milliseconds between the requests for a run's progress.
 */
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { gettext, interpolate, type SessionContext } from "@smarter/common";

import { loggerPrefix } from "../../const";
import {
  getRun,
  isActive,
  isRepositoryUrl,
  listRuns,
  startRun,
  summaryOf,
  type Run,
  type RunList,
} from "../../lib/repositoryApply";
import RecentRuns from "./RecentRuns";
import RunView from "./RunView";
import "./styles.css";

export interface RepositoryApplyProps {
  sessionContext: SessionContext;
  apiUrl: string;
  pollInterval?: number;
}

/** How many runs the list of recent runs keeps, as the api returns. */
const RECENT_RUNS = 10;

function RepositoryApply({ sessionContext, apiUrl, pollInterval = 2000 }: RepositoryApplyProps) {
  const [list, setList] = useState<RunList | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const requested = useRef<number | null>(null);
  const inputId = useId();
  const helpId = useId();
  const errorId = useId();

  /** Show a run, and keep its summary in the list of recent runs. */
  const show = useCallback((next: Run) => {
    setRun(next);
    setList((previous) => {
      if (!previous) return previous;
      const runs = previous.runs.some((r) => r.id === next.id)
        ? previous.runs.map((r) => (r.id === next.id ? summaryOf(next) : r))
        : [summaryOf(next), ...previous.runs].slice(0, RECENT_RUNS);
      return { ...previous, runs };
    });
  }, []);

  /** Fetch a run's detail, and show it, unless another run was chosen meanwhile. */
  const select = useCallback(
    (id: number) => {
      requested.current = id;
      setSelectedId(id);
      setLoadError(null);
      setNotice(null);
      getRun(sessionContext, apiUrl, id)
        .then((loaded) => {
          if (requested.current === id) show(loaded);
        })
        .catch((err: Error) => {
          if (requested.current !== id) return;
          console.error(loggerPrefix, "Error loading repository apply run", id, err);
          setLoadError(err.message);
        });
    },
    [apiUrl, sessionContext, show],
  );

  // the recent runs, and the newest one, if it is still in progress.
  useEffect(() => {
    let active = true;
    listRuns(sessionContext, apiUrl)
      .then((loaded) => {
        if (!active) return;
        setList(loaded);
        const newest = loaded.runs[0];
        if (newest && isActive(newest) && requested.current === null) select(newest.id);
      })
      .catch((err: Error) => {
        if (!active) return;
        console.error(loggerPrefix, "Error loading the recent repository apply runs", err);
        setLoadError(err.message);
      });
    return () => {
      active = false;
    };
  }, [apiUrl, sessionContext, select]);

  // the run's progress, until it finishes or fails.
  useEffect(() => {
    if (run === null || !isActive(run)) return;
    let active = true;
    const timer = window.setTimeout(() => {
      getRun(sessionContext, apiUrl, run.id)
        .then((next) => {
          if (active && requested.current === run.id) show(next);
        })
        .catch((err: Error) => {
          if (!active) return;
          console.error(loggerPrefix, "Error loading repository apply run", run.id, err);
          setLoadError(err.message);
        });
    }, pollInterval);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [apiUrl, pollInterval, run, sessionContext, show]);

  const shown = run !== null && run.id === selectedId ? run : null;
  const inProgress = Boolean((shown && isActive(shown)) || list?.runs.some(isActive));
  const valid = isRepositoryUrl(url);
  const showInvalid = touched && url.trim() !== "" && !valid;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || inProgress || starting) return;
    setStarting(true);
    setStartError(null);
    setNotice(null);
    startRun(sessionContext, apiUrl, url.trim())
      .then(({ run: started, alreadyInProgress }) => {
        requested.current = started.id;
        setSelectedId(started.id);
        setLoadError(null);
        show(started);
        if (alreadyInProgress) {
          setNotice(
            gettext("You already have a repository being applied. Here it is; apply another one when it's done."),
          );
        }
      })
      .catch((err: Error) => {
        console.error(loggerPrefix, "Error starting a repository apply run", err);
        setStartError(err.message);
      })
      .finally(() => setStarting(false));
  };

  const describedBy = [helpId, showInvalid || startError ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className="row g-6">
      <div className="col-lg-8 d-flex flex-column gap-5">
        <form noValidate onSubmit={submit} aria-label={gettext("Apply a GitHub repository")}>
          <label htmlFor={inputId} className="form-label fw-semibold">
            {gettext("Public GitHub repository")}
          </label>
          <div className="d-flex flex-wrap gap-3 align-items-start">
            <div className="flex-grow-1 smarter-ra-input">
              <input
                id={inputId}
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                className={`form-control ${showInvalid || startError ? "is-invalid" : ""}`}
                placeholder="https://github.com/owner/repository"
                value={url}
                aria-invalid={showInvalid || Boolean(startError)}
                aria-describedby={describedBy}
                onChange={(event) => {
                  setUrl(event.target.value);
                  setStartError(null);
                }}
                onBlur={() => setTouched(true)}
              />
              {(showInvalid || startError) && (
                <div id={errorId} className="invalid-feedback d-block" role="alert">
                  {showInvalid
                    ? gettext("Enter a public GitHub repository's url: https://github.com/<owner>/<repository>.")
                    : startError}
                </div>
              )}
            </div>
            <button type="submit" className="btn btn-primary" disabled={!valid || inProgress || starting}>
              {starting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" aria-hidden="true" />
                  {gettext("Starting…")}
                </>
              ) : (
                <>
                  <i className="ki-outline ki-github fs-4 me-1" aria-hidden="true" />
                  {gettext("Apply repository")}
                </>
              )}
            </button>
          </div>
          <div id={helpId} className="form-text">
            {gettext(
              "Every manifest in the repository is applied as you, in your account, in the order of their dependencies. The repository's scripts never run, folders that its owners.yaml assigns to other users are skipped, and no LLMClient is deployed.",
            )}{" "}
            {list && list.runsPerDay > 0
              ? interpolate(gettext("You can apply up to %(count)s repositories a day."), { count: list.runsPerDay })
              : null}
          </div>
          {inProgress && !starting && (
            <p className="text-muted fs-7 mt-2 mb-0">
              {gettext("A repository is being applied. You can apply another one when it's done.")}
            </p>
          )}
        </form>

        {notice && (
          <div role="status" className="alert alert-info mb-0">
            {notice}
          </div>
        )}

        {loadError && (
          <div role="alert" className="alert alert-danger d-flex justify-content-between align-items-center mb-0">
            <span>{loadError}</span>
            <button
              type="button"
              className="btn-close"
              aria-label={gettext("Dismiss")}
              onClick={() => setLoadError(null)}
            />
          </div>
        )}

        {shown ? (
          <RunView key={shown.id} run={shown} />
        ) : (
          selectedId !== null &&
          !loadError && (
            <p className="text-muted" role="status">
              {gettext("Loading the run…")}
            </p>
          )
        )}
      </div>

      <div className="col-lg-4">
        {list ? (
          <RecentRuns runs={list.runs} selectedId={selectedId} onSelect={select} />
        ) : (
          !loadError && (
            <p className="text-muted fs-7" role="status">
              {gettext("Loading your recent runs…")}
            </p>
          )
        )}
      </div>
    </div>
  );
}

export default RepositoryApply;
