/**
 * Every page renders nothing until the session has loaded. The router renders them only once it has (see App), so
 * these render each page by itself, in a SessionContext without a session, or with one that has no user.
 */
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { http, HttpResponse } from "msw";
import type { ComponentType } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { server } from "@test/server";

import { AuthCard } from "@/components/AuthCard";
import { accountUrls } from "@/lib/account";
import { LIST_PAGES } from "@/lib/lists";
import { MANIFEST_PAGES } from "@/lib/manifestPages";
import { visitorSession } from "@/mocks/fixtures";
import { ActivatePage } from "@/routes/ActivatePage";
import { DashboardPage } from "@/routes/DashboardPage";
import { DocsLayout } from "@/routes/DocsLayout";
import { JsonSchemasPage, KindJsonSchemaPage, KindManifestPage, ManifestsPage } from "@/routes/DocsPages";
import { ExtensionsPage } from "@/routes/ExtensionsPage";
import { InactivePage } from "@/routes/InactivePage";
import { Layout } from "@/routes/Layout";
import { ListPage } from "@/routes/ListPage";
import { LoginPage } from "@/routes/LoginPage";
import { ManifestPage } from "@/routes/ManifestPage";
import { PasswordResetPage } from "@/routes/PasswordResetPage";
import { PasswordResetRequestPage } from "@/routes/PasswordResetRequestPage";
import { RegisterPage } from "@/routes/RegisterPage";
import { ApplyManifestPage, PassthroughPage, TerminalPage } from "@/routes/ToolPages";
import { WorkbenchPage } from "@/routes/WorkbenchPage";
import { SessionContext, type SessionState } from "@/session/context";

// Monaco loads from a CDN at runtime, which jsdom can't: the editor package's stand-in is a textarea.
vi.mock("@monaco-editor/react", async () => await import("@smarter/manifest-editor/mocks/monaco"));
// the terminal's xterm.js asks jsdom for a canvas when it loads, which jsdom doesn't have.
vi.mock("@smarter/terminal-emulator", () => ({ TerminalEmulator: () => <p>a terminal</p> }));
// what the console gives the Extensions console.
vi.mock("@smarter/extension-console", () => ({
  ExtensionConsole: ({ context }: { context: { canEdit: boolean } }) => (
    <p>{context.canEdit ? "can edit" : "read-only"}</p>
  ),
}));

const NO_SESSION: SessionState = {
  session: null,
  error: null,
  refresh: () => Promise.resolve(),
  replace: () => {},
};

/** Render a page, without a session by default, at a path with the params that the account pages read. */
function renderPage(Page: ComponentType, state: SessionState = NO_SESSION) {
  const router = createMemoryRouter([{ path: "/page/:uidb64/:token/", element: <Page /> }], {
    initialEntries: ["/page/a/b/"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <SessionContext.Provider value={state}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </SessionContext.Provider>,
  );
}

const manifestPage = MANIFEST_PAGES[0];
const listPage = LIST_PAGES[0];

const PAGES: [string, ComponentType][] = [
  ["the dashboard", DashboardPage],
  ["the extensions", ExtensionsPage],
  ["the frame", Layout],
  ["the docs frame", DocsLayout],
  ["the Manifests page", ManifestsPage],
  ["the JSON Schemas page", JsonSchemasPage],
  ["a kind's manifest", KindManifestPage],
  ["a kind's JSON Schema", KindJsonSchemaPage],
  ["the sign-in page", LoginPage],
  ["the sign-up page", RegisterPage],
  ["the activation page", ActivatePage],
  ["the inactive account page", InactivePage],
  ["the password reset request page", PasswordResetRequestPage],
  ["the password reset page", PasswordResetPage],
  ["Apply Manifest", ApplyManifestPage],
  ["the Prompt Passthrough", PassthroughPage],
  ["the Terminal", TerminalPage],
  ["the workbench", WorkbenchPage],
  ["a manifest page", () => <ManifestPage page={manifestPage} />],
  ["a list", () => <ListPage page={listPage} List={() => <p>a list</p>} />],
  ["an auth card", () => <AuthCard title="A title">its content</AuthCard>],
];

describe("a page without a session", () => {
  it.each(PAGES)("%s renders nothing", (_name, Page) => {
    // the password reset page checks its link at once, and the resource pages ask for their resource.
    server.use(
      http.get(accountUrls.passwordReset("a", "b"), () => HttpResponse.json({ detail: "" })),
      http.get("/api/web/dashboard/resource/:locator/", () => new Promise<Response>(() => {})),
    );
    const { container } = renderPage(Page);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("a page of a session without a user", () => {
  it("shows the extensions read-only", () => {
    renderPage(ExtensionsPage, { ...NO_SESSION, session: visitorSession });
    expect(screen.getByText("read-only")).toBeInTheDocument();
  });
});
