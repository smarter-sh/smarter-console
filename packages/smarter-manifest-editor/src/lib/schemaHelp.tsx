/**
 * Field help for the editor: what a manifest's field is, from its kind's JSON Schema, which the cli api's
 * json-schema command returns (the Pydantic model of the kind's SAM manifest). The editor shows it as
 * Monaco's hover, and for the field under the cursor.
 */
import { fetchDjangoUrl } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { loggerPrefix } from "../const";

/** A JSON Schema, or one of its subschemas: the parts that field help reads. */
export type JsonSchema = {
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  allOf?: JsonSchema[];
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: JsonSchema | boolean;
  enum?: unknown[];
  default?: unknown;
};

/** What a field is: its path, e.g. spec.config.value, its type, whether it is required, and its description. */
export type FieldHelp = {
  path: string;
  type: string;
  required: boolean;
  description: string;
  /** The values that the field may have, if they are few. */
  values: string[];
};

/** Follow a subschema's $ref, e.g. #/$defs/SAMSecretSpec, within the root schema. */
function deref(root: JsonSchema, schema: JsonSchema): JsonSchema {
  const name = schema.$ref?.match(/^#\/\$defs\/(.+)$/)?.[1];
  return name && root.$defs?.[name] ? root.$defs[name] : schema;
}

/** The subschemas of a union, e.g. anyOf [string, null], without null. */
function branches(schema: JsonSchema): JsonSchema[] {
  const union = schema.anyOf ?? schema.oneOf ?? schema.allOf;
  return union ? union.filter((branch) => branch.type !== "null") : [schema];
}

/** The subschema of a field's value, by its key, or null if the schema has no such field. */
function child(root: JsonSchema, schema: JsonSchema, key: string): { schema: JsonSchema; required: boolean } | null {
  for (const branch of branches(schema).map((b) => deref(root, b))) {
    if (/^\d+$/.test(key) && branch.items) return { schema: branch.items, required: false };
    const property = branch.properties?.[key];
    if (property) return { schema: property, required: Boolean(branch.required?.includes(key)) };
    if (branch.additionalProperties && typeof branch.additionalProperties === "object") {
      return { schema: branch.additionalProperties, required: false };
    }
  }
  return null;
}

/** A field's type, e.g. string, integer or null, or SAMSecretSpec for an object. */
function typeLabel(root: JsonSchema, schema: JsonSchema): string {
  const union = schema.anyOf ?? schema.oneOf;
  if (union) return union.map((branch) => typeLabel(root, branch)).join(" | ");
  const resolved = deref(root, schema);
  if (resolved.enum) return "enum";
  if (Array.isArray(resolved.type)) return resolved.type.join(" | ");
  if (resolved.type === "array" && resolved.items) return `${typeLabel(root, resolved.items)}[]`;
  if (resolved.type && resolved.type !== "object") return resolved.type;
  return resolved.title ?? "object";
}

/**
 * Return what a field is, from its kind's JSON Schema, or null if the schema has no such field.
 *
 * @param schema - The kind's JSON Schema.
 * @param path - The field's path, e.g. ["spec", "config", "value"]. A sequence's item is its index.
 */
export function fieldHelp(schema: JsonSchema, path: string[]): FieldHelp | null {
  if (!path.length) return null;
  let current: JsonSchema = schema;
  let required = true;
  for (const key of path) {
    const next = child(schema, current, key);
    if (!next) return null;
    current = next.schema;
    required = next.required;
  }
  const resolved = branches(current).map((branch) => deref(schema, branch));
  const description = current.description ?? resolved.find((branch) => branch.description)?.description ?? "";
  const values = resolved.flatMap((branch) => branch.enum ?? []).map(String);
  return { path: path.join("."), type: typeLabel(schema, current), required, description, values };
}

/** Return a field's help as Markdown, for Monaco's hover. */
export function helpMarkdown(help: FieldHelp): string {
  const required = help.required ? " · required" : "";
  const values = help.values.length ? `\n\nOne of: ${help.values.map((value) => `\`${value}\``).join(", ")}` : "";
  return `**${help.path}** · \`${help.type}\`${required}${help.description ? `\n\n${help.description}` : ""}${values}`;
}

type JsonSchemaResponseBody = { data?: JsonSchema };

// each kind's schema, once per page: it changes only with the platform's release.
const schemas = new Map<string, Promise<JsonSchema | null>>();

/**
 * Return a kind's JSON Schema, from the cli api's json-schema command, or null if there isn't one.
 *
 * @param sessionContext - The session, for the request's CSRF token.
 * @param url - The command's url for the kind, e.g. /api/v1/cli/json-schema/secret/.
 */
export function loadSchema(sessionContext: SessionContext, url: string): Promise<JsonSchema | null> {
  let schema = schemas.get(url);
  if (!schema) {
    schema = fetchDjangoUrl(sessionContext, url, "{}")
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as JsonSchemaResponseBody | null;
        if (!response.ok || !body?.data || typeof body.data !== "object") {
          console.warn(loggerPrefix, `loadSchema() ${url} returned ${response.status}:`, body);
          schemas.delete(url);
          return null;
        }
        return body.data;
      })
      .catch((error: unknown) => {
        console.warn(loggerPrefix, `loadSchema() ${url} failed:`, error);
        schemas.delete(url);
        return null;
      });
    schemas.set(url, schema);
  }
  return schema;
}

/** Forget the loaded schemas. For tests. */
export function clearSchemas() {
  schemas.clear();
}
