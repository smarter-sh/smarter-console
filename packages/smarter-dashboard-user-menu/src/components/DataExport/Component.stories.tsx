import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { appContext, sessionContext } from "@/mocks/fixtures";
import {
  dataExportFailureHandlers,
  dataExportHandlers,
  dataExportInProgressHandlers,
  dataExportLimitHandlers,
} from "@/mocks/handlers";

import DataExportDialog from "@/components/DataExport/Component";

/** The Download My Data dialog, for a student, with the data export api mocked. */
const meta = {
  title: "DashboardUserMenu/DataExport",
  component: DataExportDialog,
  args: {
    sessionContext,
    apiUrl: appContext.urls.dataExportApi,
    onClose: fn(),
  },
  parameters: { layout: "fullscreen", msw: { handlers: dataExportHandlers() } },
} satisfies Meta<typeof DataExportDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the dialog says before the student starts. */
export const Introduction: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("4 of 5 requests left today")).toBeInTheDocument();
  },
};

/** Request my data runs an export through its steps, slowly enough to watch each illustration. */
export const Export: Story = {
  args: { pollInterval: 1500, stepDuration: 1500 },
  parameters: { msw: { handlers: dataExportHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Request my data" }));
    await expect(await canvas.findByRole("heading", { name: "Preparing your data…" })).toBeInTheDocument();
  },
};

/** An export that is already in progress when the dialog opens, writing its manifests. */
export const InProgress: Story = {
  args: { pollInterval: 600_000 },
  parameters: { msw: { handlers: dataExportInProgressHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("progressbar", { name: "Manifests written" })).toBeInTheDocument();
  },
};

/** The export is done, and the link emailed. */
export const Done: Story = {
  args: { pollInterval: 1, stepDuration: 1 },
  parameters: { msw: { handlers: dataExportHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Request my data" }));
    await expect(await canvas.findByRole("heading", { name: "Check your inbox" })).toBeInTheDocument();
  },
};

/** The export failed. */
export const Failed: Story = {
  args: { pollInterval: 1, stepDuration: 1 },
  parameters: { msw: { handlers: dataExportFailureHandlers() } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Request my data" }));
    await expect(await canvas.findByRole("button", { name: "Try again" })).toBeInTheDocument();
  },
};

/** The day's requests are used up. */
export const LimitReached: Story = {
  parameters: { msw: { handlers: dataExportLimitHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "Request my data" })).toBeDisabled();
  },
};
