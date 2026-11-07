import { lazy, Suspense } from "react";
import type { SessionContext } from "@smarter/common";

import "./styles.css";
import { gettext, SkeletonChart } from "@smarter/common";

import useInView from "../../hooks/useInView";

// recharts is a large dependency, so the chart is loaded in its own chunk.
const BudgetVsActualChart = lazy(() => import("./Chart"));

interface BudgetVsActualProps {
  sessionContext: SessionContext;
  apiUrl: string;
  /** The card's grid column classes, so that the dashboard can set its width. */
  className?: string;
}

/** A dashboard card with the budget versus actual chart of the budgets that apply to the user. */
function BudgetVsActual({ sessionContext, apiUrl, className = "col-xl-12" }: BudgetVsActualProps) {
  // below the fold: the chart loads recharts and its data once it comes near the viewport.
  const [body, inView] = useInView<HTMLDivElement>();
  return (
    <div id="budget-vs-actual" aria-label={gettext("Budget vs Actual")} className={`${className} mb-5 mb-xl-10`}>
      <div className="card border-transparent h-100" data-bs-theme="light">
        <div className="card-header border-0 pt-5">
          <h3 className="card-title align-items-start flex-column">
            <span className="card-label fw-bold text-gray-900">{gettext("Budget vs Actual")}</span>
            <span className="text-muted mt-1 fw-semibold fs-7">
              {gettext("Your spending against each budget's limit")}
            </span>
          </h3>
        </div>
        <div ref={body} className="card-body d-flex flex-column pt-3">
          {/* the chart's skeleton until it comes near the viewport, and while its code, with recharts, loads. */}
          {inView ? (
            <Suspense fallback={<SkeletonChart height={320} controls />}>
              <BudgetVsActualChart sessionContext={sessionContext} apiUrl={apiUrl} />
            </Suspense>
          ) : (
            <SkeletonChart height={320} controls />
          )}
        </div>
      </div>
    </div>
  );
}

export default BudgetVsActual;
