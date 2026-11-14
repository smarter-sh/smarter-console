/**
 * Central type definitions for the Orchestrator List React application.
 *
 * This module exports TypeScript types and interfaces used throughout the DetailView,
 * orchestrator, and API response layers. It provides strong typing for user, orchestrator,
 * orchestrator, API response, and session context data structures.
 *
 * Exports:
 *   - TabKey: Type for tab keys ("owned" | "shared").
 *   - Orchestrator: Type for orchestrator objects.
 *   - SessionContext: Type for session and authentication context.
 *
 * Usage:
 *   Import these types to ensure type safety and consistency across components and API calls.
 */
import type { SessionContext, Sorting, Annotations, Tags, UserProfile, Filtering } from "@smarter/common";

// ----------------------------------------------------------------------------
// Orchestrator Definition
// ----------------------------------------------------------------------------

export type OrchestrationStrategy = "sequential" | "parallel" | "supervisor" | "router" | "voting" | "debate";

export type HarnessRole = "planner" | "executor" | "critic" | "router" | "summarizer" | "tool_caller";

export type OrchestratorHarness = {
  llmClientName: string;
  role: HarnessRole;
  executionOrder: number;
  isActive: boolean;
  config: Record<string, unknown>;
};

export type Orchestrator = {
  id: number;
  hashedId: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  userProfile: UserProfile;
  baseUrl: string;
  description: string;
  version: string;
  tags: Tags;
  annotations: Annotations;
  manifestUrl: string;
  /** The url of the 's detail: its manifest, what it uses, and what uses it. See ResourceDetail. */
  detailUrl: string | null;
  canDelete: boolean; // false if other resources depend on it, or you may not delete it
  ready: boolean;
  rfc1034CompliantName: string | null;
  strategy: OrchestrationStrategy;
  maxIterations: number;
  isActive: boolean;
  harnesses: OrchestratorHarness[];
};

// ----------------------------------------------------------------------------
// Runs: an orchestrator's attempts at an objective (the api's OrchestratorApiRun, /api/v1/orchestrators/<id>/runs/)
// ----------------------------------------------------------------------------

export type OrchestrationRunStatus =
  "pending" | "running" | "succeeded" | "failed" | "cancelled" | "max_iterations_exceeded";

/** One step of a run: one call of a harness LLMClient, as its owner. */
export type OrchestrationStep = {
  sequence: number;
  llmclient: string;
  accountNumber: string;
  role: HarnessRole;
  status: "succeeded" | "failed" | "skipped";
  errorMessage: string | null;
  createdAt: string | null;
};

/** A run of an orchestrator, with its steps and, once it succeeded, its result. */
export type OrchestrationRun = {
  id: number;
  orchestrator: number;
  objective: string;
  status: OrchestrationRunStatus;
  result: string | null;
  errorMessage: string | null;
  iterationCount: number;
  startedBy: UserProfile | null;
  createdAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: OrchestrationStep[];
};

// ----------------------------------------------------------------------------
// Component Props Interfaces
// ----------------------------------------------------------------------------
export interface OrchestratorDetailViewProps {
  sessionContext: SessionContext;
  object: Orchestrator;
  onRequery: () => void;
  filtering?: Filtering;
}

export interface OrchestratorListViewProps {
  isLoading: boolean;
  ghostRows: number;
  sessionContext: SessionContext;
  objects: Orchestrator[];
  onRequery: () => void;
  sorting?: Sorting;
}
