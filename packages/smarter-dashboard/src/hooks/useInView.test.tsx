import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { appContext, sessionContext } from "@/mocks/fixtures";

import BudgetVsActual from "@/components/BudgetVsActual/BudgetVsActual";
import UserCharges from "@/components/TokenUsage/UserCharges";
import useInView from "@/hooks/useInView";

/** A stand-in for the browser's IntersectionObserver, which jsdom lacks: a test says when an element intersects. */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;
  options?: IntersectionObserverInit;
  observed: Element[] = [];
  disconnect = vi.fn();

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  /** Reports whether the observed element intersects the viewport. */
  intersect(isIntersecting: boolean) {
    const entries = this.observed.map((target) => ({ target, isIntersecting }) as IntersectionObserverEntry);
    act(() => this.callback(entries, this as unknown as IntersectionObserver));
  }
}

function Probe({ attach = true }: { attach?: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>("50px");
  return <div ref={attach ? ref : undefined}>{inView ? "in view" : "out of view"}</div>;
}

describe("useInView", () => {
  beforeEach(() => {
    FakeIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is in view once the element comes near the viewport, and stops observing it", () => {
    render(<Probe />);
    expect(screen.getByText("out of view")).toBeInTheDocument();
    const [observer] = FakeIntersectionObserver.instances;
    expect(observer.options).toEqual({ rootMargin: "50px" });

    observer.intersect(false);
    expect(screen.getByText("out of view")).toBeInTheDocument();

    observer.intersect(true);
    expect(screen.getByText("in view")).toBeInTheDocument();
    expect(observer.disconnect).toHaveBeenCalled();
  });

  it("observes nothing without an element", () => {
    render(<Probe attach={false} />);
    expect(screen.getByText("out of view")).toBeInTheDocument();
    expect(FakeIntersectionObserver.instances).toHaveLength(0);
  });

  it("is in view at once without IntersectionObserver", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getByText("in view")).toBeInTheDocument();
  });

  it.each([
    ["UserCharges", () => <UserCharges sessionContext={sessionContext} apiUrl={appContext.chargesApiUrl} />],
    ["BudgetVsActual", () => <BudgetVsActual sessionContext={sessionContext} apiUrl={appContext.budgetsApiUrl} />],
  ])("%s shows its chart's skeleton, and requests nothing, until it comes near the viewport", (_, card) => {
    // an unhandled request would fail the test: the chart's data isn't requested yet.
    render(card());
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
  });
});
