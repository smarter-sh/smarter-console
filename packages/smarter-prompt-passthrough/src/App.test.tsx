import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PROVIDER_API_URL, sessionContext } from "@/mocks/fixtures";
import { providerHandlers } from "@/mocks/handlers";
import { server } from "@test/server";

import App from "@/App";

vi.mock("@monaco-editor/react", async () => await import("@/mocks/MonacoEditor"));

describe("App", () => {
  it("has no Server Logs tab without a log stream url", async () => {
    server.use(...providerHandlers);
    render(
      <App
        sessionContext={sessionContext}
        defaultLLMProviderId={1}
        defaultTemplateId={1}
        providerApiUrl={PROVIDER_API_URL}
      />,
    );
    expect(await screen.findByRole("option", { name: "anthropic" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Request", "Response"]);
  });
});
