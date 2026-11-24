import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";

import { REPOSITORY_APPLY_API_URL, sessionContext } from "@/mocks/fixtures";
import { repositoryIdleHandlers, repositoryInProgressHandlers, repositoryRecentHandlers } from "@/mocks/handlers";

import RepositoryApply from "./Component";

/**
 * Apply a GitHub repository: enter a public repository's url, follow the run, and investigate its manifests'
 * failures. Runs are shaped like real runs of smarter-sh/example-manifests.
 */
const meta = {
  title: "Apply Manifest/RepositoryApply",
  component: RepositoryApply,
  args: { sessionContext, apiUrl: REPOSITORY_APPLY_API_URL, pollInterval: 2000 },
  parameters: { msw: { handlers: repositoryIdleHandlers() } },
} satisfies Meta<typeof RepositoryApply>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The form, before the user has applied any repository. Applying one follows it to the end. */
export const Idle: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("You haven't applied a repository yet.")).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /Apply repository/ })).toBeDisabled();
  },
};

/** The newest run is applying: the page follows it, and shows the manifest being applied. */
export const InProgress: Story = {
  parameters: { msw: { handlers: repositoryInProgressHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Applying manifest 65 of 134…")).toBeInTheDocument();
    await expect(canvas.getByRole("progressbar", { name: "Manifests attempted" })).toBeInTheDocument();
  },
};

/** A finished run whose MCPClients failed for want of their Secrets: the failures, and the first one's details. */
export const FinishedWithFailures: Story = {
  parameters: { msw: { handlers: repositoryRecentHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const recent = await canvas.findByRole("region", { name: "Recent runs" });
    await userEvent.click((await within(recent).findAllByRole("button"))[0]);
    await userEvent.click(await canvas.findByRole("button", { name: "Failed 14" }));
    await userEvent.click(canvas.getByRole("button", { name: "Failed: details of MCPClient asana" }));
    await expect(canvas.getByText(/Secret asana_access_token not found/)).toBeInTheDocument();
  },
};

/** A run that failed as a whole: the repository could not be cloned. */
export const FailedRun: Story = {
  parameters: { msw: { handlers: repositoryRecentHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const recent = await canvas.findByRole("region", { name: "Recent runs" });
    await userEvent.click((await within(recent).findAllByRole("button"))[1]);
    await expect(await canvas.findByRole("alert")).toHaveTextContent("The repository could not be cloned.");
  },
};
