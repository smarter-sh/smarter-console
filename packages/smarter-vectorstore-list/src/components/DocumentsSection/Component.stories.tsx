import type { Meta, StoryObj } from "@storybook/react-vite";

import { makeDocument, makeObject, sessionContext } from "@/mocks/fixtures";
import { documentsHandlers } from "@/mocks/handlers";

import DocumentsSection from "@/components/DocumentsSection/Component";

/** The Documents section of a vectorstore's Details tab: add files or a url, follow their loading, remove one. */
const meta = {
  title: "Vectorstore List/DocumentsSection",
  component: DocumentsSection,
  args: { sessionContext, vectorstore: makeObject(1), onRequery: () => {} },
  parameters: { msw: { handlers: documentsHandlers() } },
} satisfies Meta<typeof DocumentsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Documents that are loaded, loading, and failed. */
export const Default: Story = {};

/** A vectorstore without documents. */
export const Empty: Story = { parameters: { msw: { handlers: documentsHandlers([]) } } };

/** A vectorstore that isn't deployed: documents added now wait. */
export const NotReady: Story = {
  args: { vectorstore: makeObject(2, { status: "pending" }) },
  parameters: { msw: { handlers: documentsHandlers([makeDocument(1, { status: "pending", chunkCount: 0 })]) } },
};
