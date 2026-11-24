import { describe, expect, it } from "vitest";

import { EXAMPLE_COMMIT, EXAMPLE_REPOSITORY, applyingRun, finishedRun, queuedRun } from "@/mocks/fixtures";

import {
  applyingPosition,
  commitUrl,
  isActive,
  isRepositoryUrl,
  parseRepository,
  progressOf,
  repositoryName,
  runUrl,
  stageStates,
  summaryOf,
} from "./repositoryApply";

describe("parseRepository", () => {
  it.each([
    ["https://github.com/smarter-sh/example-manifests", "smarter-sh", "example-manifests"],
    ["https://github.com/smarter-sh/example-manifests/", "smarter-sh", "example-manifests"],
    ["https://github.com/smarter-sh/example-manifests.git", "smarter-sh", "example-manifests"],
    ["  https://github.com/a/b.c_d  ", "a", "b.c_d"],
  ])("reads the owner and repository of %s", (url, owner, repo) => {
    expect(parseRepository(url)).toEqual({ owner, repo });
    expect(isRepositoryUrl(url)).toBe(true);
  });

  it.each([
    "",
    "github.com/smarter-sh/example-manifests",
    "http://github.com/smarter-sh/example-manifests",
    "https://gitlab.com/smarter-sh/example-manifests",
    "https://github.com/smarter-sh",
    "https://github.com/smarter-sh/example-manifests/tree/main",
    "https://github.com/-smarter/example-manifests",
  ])("refuses %j", (url) => {
    expect(parseRepository(url)).toBeNull();
    expect(isRepositoryUrl(url)).toBe(false);
  });
});

describe("a run's derived values", () => {
  it("names a repository owner/repo, or by its url", () => {
    expect(repositoryName(EXAMPLE_REPOSITORY)).toBe("smarter-sh/example-manifests");
    expect(repositoryName("https://example.com/repo")).toBe("https://example.com/repo");
  });

  it("links the commit, once there is one", () => {
    expect(commitUrl(finishedRun)).toBe(`${EXAMPLE_REPOSITORY}/commit/${EXAMPLE_COMMIT}`);
    expect(commitUrl(queuedRun)).toBeNull();
    expect(commitUrl({ url: "https://example.com/repo", commit: EXAMPLE_COMMIT })).toBeNull();
  });

  it("is active until it finishes or fails", () => {
    expect(isActive(queuedRun)).toBe(true);
    expect(isActive(applyingRun)).toBe(true);
    expect(isActive(finishedRun)).toBe(false);
    expect(isActive({ status: "failed" })).toBe(false);
  });

  it("counts the manifests attempted", () => {
    expect(progressOf({ pending: 3, applied: 124, skipped: 6, failed: 14 })).toEqual({ done: 144, total: 147 });
  });

  it("finds the manifest being applied, only while applying", () => {
    expect(applyingPosition(applyingRun)).toBe(64);
    expect(applyingPosition(finishedRun)).toBeNull();
    expect(applyingPosition({ ...applyingRun, manifests: finishedRun.manifests })).toBeNull();
  });

  it("drops the manifests from a summary, and builds a run's url", () => {
    expect(summaryOf(finishedRun).manifests).toEqual([]);
    expect(summaryOf(finishedRun).counts).toEqual(finishedRun.counts);
    expect(runUrl("/api/web/account/repository-apply/", 12)).toBe("/api/web/account/repository-apply/12/");
  });
});

describe("stageStates", () => {
  it("marks the stages before the current one done", () => {
    expect(stageStates({ status: "queued", commit: "" })).toEqual({
      queued: "active",
      cloning: "pending",
      applying: "pending",
      finished: "pending",
    });
    expect(stageStates({ status: "applying", commit: EXAMPLE_COMMIT })).toEqual({
      queued: "done",
      cloning: "done",
      applying: "active",
      finished: "pending",
    });
  });

  it("marks every stage done when the run finished", () => {
    expect(Object.values(stageStates(finishedRun))).toEqual(["done", "done", "done", "done"]);
  });

  it("marks where a failed run stopped: cloning without a commit, else applying", () => {
    expect(stageStates({ status: "failed", commit: "" })).toEqual({
      queued: "done",
      cloning: "failed",
      applying: "pending",
      finished: "pending",
    });
    expect(stageStates({ status: "failed", commit: EXAMPLE_COMMIT }).applying).toBe("failed");
  });
});
