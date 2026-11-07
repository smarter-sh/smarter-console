import { describe, expect, it } from "vitest";

import { workbenchPath } from "@/lib/workbench";

describe("workbenchPath", () => {
  it("keeps the path of the backend's absolute url, so the link stays on the console's origin", () => {
    const urlChatapp = "http://localhost:9357/workbench/llm-clients/abc123/prompt/";
    expect(workbenchPath({ urlChatapp })).toBe("/workbench/llm-clients/abc123/prompt/");
  });

  it("keeps a query and a fragment", () => {
    const urlChatapp = "https://alpha.platform.example.com/workbench/llm-clients/abc123/prompt/?tab=chat#top";
    expect(workbenchPath({ urlChatapp })).toBe("/workbench/llm-clients/abc123/prompt/?tab=chat#top");
  });

  it("leaves a path as it is", () => {
    expect(workbenchPath({ urlChatapp: "/workbench/llm-clients/abc123/prompt/" })).toBe(
      "/workbench/llm-clients/abc123/prompt/",
    );
  });
});
