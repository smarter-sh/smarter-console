/**
 * Example data for this package's stories and tests: the props that the console gives the page, and the cli
 * api's answers. See smarter.apps.api.v1.cli.views (apply, validate, json-schema and example-manifest).
 */
import type { SessionContext } from "@smarter/common";

import type { AppProps } from "../App";

export const APPLY_API_URL = "/api/v1/cli/apply/";
export const VALIDATE_API_URL = "/api/v1/cli/validate/";
export const SCHEMA_API_URL = "/api/v1/cli/json-schema/__kind__/";
export const EXAMPLE_API_URL = "/api/v1/cli/example-manifest/__kind__/";

export const sessionContext: SessionContext = {
  ApiUrl: APPLY_API_URL,
  csrfCookieName: "csrftoken",
  djangoSessionCookieName: "sessionid",
  cookieDomain: "localhost",
  debugMode: false,
  smarterClient: "@smarter/apply-manifest",
  smarterClientVersion: "0.0.0",
  smarterRequestId: "storybook-request-id",
};

export const appProps: AppProps = {
  sessionContext,
  kinds: ["LLMClient", "Secret"],
  applyApiUrl: APPLY_API_URL,
  validateApiUrl: VALIDATE_API_URL,
  schemaApiUrl: SCHEMA_API_URL,
  exampleApiUrl: EXAMPLE_API_URL,
  kindPlaceholder: "__kind__",
};

export const SECRET_MANIFEST = `apiVersion: smarter.sh/v1
kind: Secret
metadata:
  name: example_secret
  description: An example secret.
  version: 1.0.0
spec:
  config:
    value: not-a-real-secret
`;

/** What the example-manifest command returns for a Secret. */
export const EXAMPLE_SECRET = {
  apiVersion: "smarter.sh/v1",
  kind: "Secret",
  metadata: { name: "example_secret", description: "An example secret.", version: "1.0.0" },
  spec: { config: { value: "not-a-real-secret" } },
};

/** What the apply api returns for SECRET_MANIFEST. */
export const applyResult = { message: "Secret example_secret applied successfully" };
