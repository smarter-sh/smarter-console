import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import McpServer from "@/components/McpServer/Component";

describe("McpServer", () => {
  it("shows the command that adds this platform's MCP server to Claude Code", () => {
    render(<McpServer />);
    expect(screen.getByLabelText("Add this platform's MCP server to Claude Code")).toHaveTextContent(
      `claude mcp add --transport http smarter-project ${window.location.origin}/api/v1/mcp/smarter-project/`,
    );
  });

  it("links to the documentation", () => {
    render(<McpServer />);
    expect(screen.getByRole("link", { name: "Documentation" })).toHaveAttribute(
      "href",
      "https://docs.smarter.sh/smarter-platform/mcpserver.html#public-tools",
    );
  });

  it("shows another platform's MCP server", () => {
    render(<McpServer serverUrl="https://platform.smarter.sh/api/v1/mcp/smarter-project/" />);
    expect(screen.getByLabelText("Add this platform's MCP server to Claude Code")).toHaveTextContent(
      "claude mcp add --transport http smarter-project https://platform.smarter.sh/api/v1/mcp/smarter-project/",
    );
  });

  it("shows the server's path when rendered without a browser", () => {
    vi.stubGlobal("window", undefined);
    try {
      // renderToString is react-dom's, not testing-library's render, whose result the rule names.
      // eslint-disable-next-line testing-library/render-result-naming-convention
      const html = renderToString(<McpServer />);
      expect(html).toContain("/api/v1/mcp/smarter-project/");
      expect(html).not.toContain("http://localhost");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
