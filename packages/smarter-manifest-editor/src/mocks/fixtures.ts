/**
 * Example data for this package's stories and tests: a manifest, as the web console's manifest
 * detail page gives it to the editor, from the resource api (smarter.apps.dashboard.resource_detail).
 */
import type { SessionContext } from "@smarter/common";

import type { AppProps } from "../App";
import type { JsonSchema } from "../lib/schemaHelp";

export const APPLY_API_URL = "/api/v1/cli/apply/";
export const VALIDATE_API_URL = "/api/v1/cli/validate/";
export const DELETE_API_URL = "/api/v1/cli/delete/__kind__/";
export const SCHEMA_API_URL = "/api/v1/cli/json-schema/__kind__/";
export const KINDS = ["LLMClient", "Secret"];

export const sessionContext: SessionContext = {
  ApiUrl: APPLY_API_URL,
  csrfCookieName: "csrftoken",
  djangoSessionCookieName: "sessionid",
  cookieDomain: "localhost",
  debugMode: false,
  smarterClient: "@smarter/manifest-editor",
  smarterClientVersion: "0.0.0",
  smarterRequestId: "storybook-request-id",
};

export const SECRET_YAML = `apiVersion: smarter.sh/v1
kind: Secret
metadata:
  name: example_secret
  description: An example secret.
  version: 1.0.0
spec:
  config:
    value: not-a-real-secret
status:
  accountNumber: 3141-5926-5359
  username: admin
`;

/** A Secret that an LLMClient depends on, so it cannot be deleted. */
export const SECRET_IN_USE_YAML = `${SECRET_YAML}  dependencies:
    - kind: LLMClient
      name: example_llmclient
`;

export const appProps: AppProps = {
  sessionContext,
  initialManifest: SECRET_YAML,
  applyApiUrl: APPLY_API_URL,
  validateApiUrl: VALIDATE_API_URL,
  deleteApiUrl: DELETE_API_URL,
  kindPlaceholder: "__kind__",
};

/**
 * A Secret's JSON Schema, as the cli api's json-schema command returns it: part of
 * smarter.apps.api.v1.contract's sam/Secret.schema.json.
 */
export const SECRET_SCHEMA: JsonSchema = {
  $defs: {
    SAMSecretMetadata: {
      properties: {
        name: { description: "The name of the secret.", title: "Name", type: "string" },
        description: {
          anyOf: [{ type: "string" }, { type: "null" }],
          description: "The description for this resource.",
        },
        tags: { anyOf: [{ items: { type: "string" }, type: "array" }, { type: "null" }], description: "The tags." },
        annotations: {
          anyOf: [{ additionalProperties: { type: "string" }, type: "object" }, { type: "null" }],
          description: "Annotations, as in Kubernetes.",
        },
      },
      required: ["name"],
      title: "SAMSecretMetadata",
      type: "object",
    },
    SAMSecretSpec: {
      properties: { config: { $ref: "#/$defs/SAMSecretSpecConfig", description: "The configuration for the Secret." } },
      required: ["config"],
      title: "SAMSecretSpec",
      type: "object",
    },
    SAMSecretSpecConfig: {
      description: "Smarter API Secret Manifest Secret.spec.config.",
      properties: {
        value: { description: "The secret's value.", title: "Value", type: "string" },
        stage: { enum: ["dev", "prod"], title: "Stage" },
      },
      required: ["value"],
      title: "SAMSecretSpecConfig",
      type: "object",
    },
  },
  properties: {
    apiVersion: { description: "The API version, smarter.sh/v1.", title: "Apiversion", type: "string" },
    kind: { description: "The kind of resource.", title: "Kind", type: "string" },
    metadata: { $ref: "#/$defs/SAMSecretMetadata", description: "The manifest's metadata." },
    spec: { $ref: "#/$defs/SAMSecretSpec", description: "The manifest's spec." },
  },
  required: ["apiVersion", "kind", "metadata", "spec"],
  title: "SAMSecret",
  type: "object",
};
