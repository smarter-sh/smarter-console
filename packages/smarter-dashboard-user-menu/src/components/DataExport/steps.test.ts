import { describe, expect, it } from "vitest";

import { queuedExport, runningExport, succeededExport } from "@/mocks/fixtures";

import { exportSteps, formatSize, isFinished, nextShownIndex, STEP_COUNT, stepIndex } from "./steps";

describe("steps", () => {
  it("lists the backend's steps, in its order", () => {
    const names = exportSteps().map((step) => step.name);
    expect(names).toEqual(["inventory", "manifests", "archive", "upload", "email"]);
    expect(names).toHaveLength(STEP_COUNT);
  });

  it("places a queued export on the first step, and a finished one past the last", () => {
    expect(stepIndex("queued")).toBe(0);
    expect(stepIndex("inventory")).toBe(0);
    expect(stepIndex("manifests")).toBe(1);
    expect(stepIndex("email")).toBe(4);
    expect(stepIndex("done")).toBe(STEP_COUNT);
  });

  it("moves toward the export's step one at a time", () => {
    expect(nextShownIndex(0, succeededExport)).toBe(1);
    expect(nextShownIndex(4, succeededExport)).toBe(5);
    expect(nextShownIndex(5, succeededExport)).toBe(5);
    expect(nextShownIndex(1, runningExport)).toBe(1);
    expect(nextShownIndex(0, queuedExport)).toBe(0);
  });

  it("knows when an export has finished", () => {
    expect(isFinished(queuedExport)).toBe(false);
    expect(isFinished(runningExport)).toBe(false);
    expect(isFinished(succeededExport)).toBe(true);
    expect(isFinished({ ...runningExport, status: "failed" })).toBe(true);
  });

  it("formats a size in KB, else in MB", () => {
    expect(formatSize(0)).toBe("1 KB");
    expect(formatSize(28_400)).toBe("28 KB");
    expect(formatSize(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});
