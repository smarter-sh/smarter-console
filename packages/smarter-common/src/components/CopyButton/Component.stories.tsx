import type { Meta, StoryObj } from "@storybook/react-vite";

import CopyButton from "./Component";

/**
 * A button that copies a text to the clipboard, and says "Copied" for a moment afterwards. Its words are a polite
 * live region, so a screen reader announces the change.
 */
const meta = {
  title: "Common/CopyButton",
  component: CopyButton,
  args: {
    text: "smarter apply -f manifest.yaml",
  },
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** An accessible name that says what it copies. */
export const WithLabel: Story = {
  args: { label: "Copy the command", className: "btn btn-sm btn-light py-1 px-3", iconClassName: "fs-6 me-1" },
};

/** Words alone, styled by the page that shows it, e.g. a terminal's. */
export const WithoutIcon: Story = {
  args: { className: "btn btn-sm btn-outline-secondary", iconClassName: null },
};
