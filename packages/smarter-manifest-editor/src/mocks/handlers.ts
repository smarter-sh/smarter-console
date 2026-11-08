/** MSW request handlers for the smarter cli api. See storybook/preview.ts and test/server.ts in the workspace. */
import { http, HttpResponse } from "msw";

import { APPLY_API_URL, SECRET_SCHEMA, VALIDATE_API_URL } from "./fixtures";

export const validHandler = http.post(VALIDATE_API_URL, () => HttpResponse.json({ data: { valid: true, errors: [] } }));

/** The manifest's SAM model rejects spec.config.value. */
export const invalidHandler = http.post(VALIDATE_API_URL, () =>
  HttpResponse.json({
    data: {
      valid: false,
      errors: [{ loc: ["spec", "config", "value"], message: "value must be at least 32 characters" }],
    },
  }),
);

/** The cli api's json-schema command: a Secret's schema, and no other kind's. */
export const schemaHandler = http.post("/api/v1/cli/json-schema/:kind/", ({ params }) =>
  params.kind === "secret"
    ? HttpResponse.json({ data: SECRET_SCHEMA })
    : HttpResponse.json({ error: "not found" }, { status: 404 }),
);

export const cliHandlers = [
  validHandler,
  schemaHandler,
  http.post(APPLY_API_URL, () => HttpResponse.json({ message: "Secret example_secret applied" })),
  http.post("/api/v1/cli/delete/:kind/", () => HttpResponse.json({ message: "Secret example_secret deleted" })),
];
