/**
 * Where the page's manifests come from, besides the user's typing: a file, and a kind's example manifest, from
 * the cli api's example-manifest command (smarter.apps.api.v1.cli.views.example_manifest).
 */
import { dump } from "js-yaml";

import { fetchDjangoUrl, gettext, interpolate } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { loggerPrefix } from "../const";

/** The largest manifest file that the page opens: manifests are a few kilobytes. */
export const MAX_FILE_BYTES = 1024 * 1024;

/**
 * Return a manifest file's text.
 *
 * @throws Error if the file is too large to be a manifest, or can't be read.
 */
export async function readManifestFile(file: File): Promise<string> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(interpolate(gettext("%(name)s is too large to be a manifest."), { name: file.name }));
  }
  try {
    return await file.text();
  } catch (error) {
    console.error(loggerPrefix, "readManifestFile()", error);
    throw new Error(interpolate(gettext("%(name)s could not be read."), { name: file.name }), { cause: error });
  }
}

type ExampleResponseBody = { data?: unknown };

/**
 * Return a kind's example manifest, as YAML.
 *
 * @param sessionContext - The session, for the request's CSRF token.
 * @param url - The command's url for the kind, e.g. /api/v1/cli/example-manifest/secret/.
 * @param kind - The kind, for the error's message.
 * @throws Error if the api has no example.
 */
export async function loadExample(sessionContext: SessionContext, url: string, kind: string): Promise<string> {
  const response = await fetchDjangoUrl(sessionContext, url, "{}");
  const body = (await response.json().catch(() => null)) as ExampleResponseBody | null;
  if (!response.ok || !body?.data || typeof body.data !== "object") {
    console.warn(loggerPrefix, `loadExample() ${url} returned ${response.status}:`, body);
    throw new Error(interpolate(gettext("The example %(kind)s manifest could not be loaded."), { kind }));
  }
  return dump(body.data, { lineWidth: 120, noRefs: true });
}
