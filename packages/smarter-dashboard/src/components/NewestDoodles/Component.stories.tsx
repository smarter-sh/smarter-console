import type { Meta, StoryObj } from "@storybook/react-vite";
import { http, HttpResponse } from "msw";

import { appContext, sessionContext } from "@/mocks/fixtures";
import { dashboardErrorHandlers, doodleArtworkHandler, newestDoodlesHandler } from "@/mocks/handlers";

import NewestDoodles from "@/components/NewestDoodles/Component";

/** The newest doodles that the Smarter Doodle Artist drew for the sign-in page. */
const meta = {
  title: "Dashboard/NewestDoodles",
  component: NewestDoodles,
  args: { sessionContext, apiUrl: appContext.newestDoodlesApiUrl },
  parameters: { msw: { handlers: [newestDoodlesHandler, doodleArtworkHandler] } },
} satisfies Meta<typeof NewestDoodles>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A platform without the artist: no card at all. */
export const Empty: Story = {
  parameters: {
    msw: { handlers: [http.post(appContext.newestDoodlesApiUrl, () => HttpResponse.json({ doodles: [] }))] },
  },
};

export const ApiError: Story = {
  parameters: { msw: { handlers: dashboardErrorHandlers } },
};
