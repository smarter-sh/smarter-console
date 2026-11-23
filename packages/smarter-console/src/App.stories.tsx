/** The console, signed in and not, with its session answered by MSW. */
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryRouter } from "react-router";

import App from "@/App";
import { doodleByDayHandler, sessionErrorHandler, userSessionHandler, visitorSessionHandler } from "@/mocks/handlers";
import { routes } from "@/router";

function ConsoleAt({ path }: { path: string }) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return <App router={router} />;
}

const meta = {
  title: "Console/App",
  component: ConsoleAt,
  args: { path: "/" },
  parameters: { msw: { handlers: [userSessionHandler] } },
} satisfies Meta<typeof ConsoleAt>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};

export const Visitor: Story = {
  parameters: { msw: { handlers: [visitorSessionHandler] } },
};

export const ServerUnreachable: Story = {
  parameters: { msw: { handlers: [sessionErrorHandler] } },
};

export const PageNotFound: Story = {
  args: { path: "/no-such-page/" },
};

/** The page of a doodle that the dashboard's Newest Doodles link to, for a visitor. */
export const Doodle: Story = {
  args: { path: "/doodles/2026-11-19/mx/" },
  parameters: { msw: { handlers: [visitorSessionHandler, doodleByDayHandler] } },
};

/** The page of a doodle that isn't available. */
export const DoodleNotAvailable: Story = {
  args: { path: "/doodles/2026-11-20/mx/" },
  parameters: { msw: { handlers: [visitorSessionHandler, doodleByDayHandler] } },
};
