/** MSW request handlers for the cli api. See storybook/preview.ts and test/server.ts in the workspace. */
import { http, HttpResponse } from "msw";

import { schemaHandler, validHandler } from "@smarter/manifest-editor/mocks";

import { APPLY_API_URL, EXAMPLE_SECRET, applyResult } from "./fixtures";

/** The example-manifest command: a Secret's example, and no other kind's. */
export const exampleHandler = http.post("/api/v1/cli/example-manifest/:kind/", ({ params }) =>
  params.kind === "secret"
    ? HttpResponse.json({ data: EXAMPLE_SECRET })
    : HttpResponse.json({ error: "not found" }, { status: 404 }),
);

export const applyHandlers = [
  validHandler,
  schemaHandler,
  exampleHandler,
  http.post(APPLY_API_URL, () => HttpResponse.json(applyResult)),
];

export const applyErrorHandlers = [
  http.post(APPLY_API_URL, () => HttpResponse.json({ error: "Invalid manifest" }, { status: 400 })),
  ...applyHandlers,
];
