import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";

import { SECRET_MANIFEST, appProps } from "@/mocks/fixtures";
import { applyErrorHandlers, applyHandlers } from "@/mocks/handlers";

import App from "@/App";

/** Write, paste, open, drop or start from an example a manifest, check it as you type, and apply it. */
const meta = {
  title: "Apply Manifest/App",
  component: App,
  args: appProps,
  parameters: { msw: { handlers: applyHandlers } },
} satisfies Meta<typeof App>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The empty editor, as the page opens. */
export const Default: Story = {};

/** A chosen manifest file, open in the editor. */
export const FileOpened: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File([SECRET_MANIFEST], "secret.yaml", { type: "application/yaml" });
    await userEvent.upload(canvas.getByLabelText("Manifest file"), file);
    await expect(await canvas.findByDisplayValue(/example_secret/)).toBeInTheDocument();
  },
};

/** The drop zone, while a file is dragged over the page. */
export const Dragging: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    fireEvent.dragEnter(window, { dataTransfer: { types: ["Files"] } });
    await expect(await canvas.findByRole("region", { name: "Drop Zone" })).toBeInTheDocument();
  },
};

/** A manifest that the api rejects. */
export const ApplyFailed: Story = {
  parameters: { msw: { handlers: applyErrorHandlers } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const file = new File([SECRET_MANIFEST], "secret.yaml", { type: "application/yaml" });
    await userEvent.upload(canvas.getByLabelText("Manifest file"), file);
    await canvas.findByText("No problems", {}, { timeout: 3000 });
    await userEvent.click(canvas.getByRole("button", { name: /Apply/ }));
    await expect(await canvas.findByRole("dialog", { name: "Apply Failed" })).toBeInTheDocument();
  },
};
