import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";

import { API_URL, exampleToolbarMessages, sessionContext } from "../../mocks/example";
import ResourceToolbar from "./Component";

const ACTIONS = API_URL.replace(/listview\/$/, "");

/** The toolbar of a resource in a list: Edit, Clone, Rename and Delete, with the list's messages. */
const meta = {
  title: "Common/ResourceToolbar",
  component: ResourceToolbar,
  args: {
    sessionContext,
    resource: { id: 7, name: "first_example", manifestUrl: "/example/abc/", canDelete: true },
    messages: exampleToolbarMessages,
    onRequery: () => {},
  },
  parameters: {
    msw: {
      handlers: [
        http.post(`${ACTIONS}clone/7/:name/`, ({ params }) => HttpResponse.json({ id: 8, name: params.name })),
        http.post(`${ACTIONS}rename/7/:name/`, ({ params }) => HttpResponse.json({ id: 7, name: params.name })),
        http.post(`${ACTIONS}delete/7/`, () => HttpResponse.json({ message: "deleted" })),
      ],
    },
  },
} satisfies Meta<typeof ResourceToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Other resources depend on it, or the user may not delete it: Delete is disabled, and says why. */
export const CannotDelete: Story = {
  args: { resource: { id: 7, name: "first_example", manifestUrl: "/example/abc/", canDelete: false } },
};
