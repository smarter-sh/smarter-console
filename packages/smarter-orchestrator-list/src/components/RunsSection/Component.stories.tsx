import type { Meta, StoryObj } from "@storybook/react-vite";

import { makeObject, makeRun, sessionContext } from "@/mocks/fixtures";
import { runsHandlers } from "@/mocks/handlers";

import RunsSection from "@/components/RunsSection/Component";

const meta = {
  title: "Orchestrator List/RunsSection",
  component: RunsSection,
  args: { sessionContext, orchestrator: makeObject(1) },
  parameters: { msw: { handlers: runsHandlers() } },
} satisfies Meta<typeof RunsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The user's runs: the newest's steps and result. */
export const Default: Story = {};

/** No run yet. */
export const NoRuns: Story = { parameters: { msw: { handlers: runsHandlers([]) } } };

/** A run that failed at a step. */
export const Failed: Story = {
  parameters: {
    msw: {
      handlers: runsHandlers([
        makeRun(5, { status: "failed", result: null, errorMessage: "hr_assistant failed: The step failed." }),
      ]),
    },
  },
};

/** An inactive orchestrator can't run. */
export const Inactive: Story = { args: { orchestrator: makeObject(1, { isActive: false }) } };
