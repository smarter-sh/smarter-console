import type { Meta, StoryObj } from "@storybook/react-vite";

import { fieldHelp } from "@/lib/schemaHelp";
import { SECRET_SCHEMA } from "@/mocks/fixtures";

import FieldHelp from "@/components/FieldHelp/Component";

/** What the field under the editor's cursor is, from its kind's JSON Schema. */
const meta = {
  title: "Manifest Editor/FieldHelp",
  component: FieldHelp,
  args: { help: fieldHelp(SECRET_SCHEMA, ["spec", "config", "value"]) },
} satisfies Meta<typeof FieldHelp>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RequiredField: Story = {};

export const FieldWithValues: Story = { args: { help: fieldHelp(SECRET_SCHEMA, ["spec", "config", "stage"]) } };

export const NoField: Story = { args: { help: null } };
