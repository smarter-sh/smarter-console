/**
 * The link from an llmclient's row to its Prompt Engineer's Workbench.
 */
import type { LLMClient } from "./Types";

/**
 * The path of the llmclient's workbench, on the page's own origin.
 *
 * The list api sends urlChatapp as an absolute url, on the platform's host (smarter_settings.environment_url), as
 * the api's other clients expect. The workbench is a page of the same console, so the list keeps only its path: the
 * link then stays on the origin that served the console, e.g. Vite's dev server, instead of leaving for the backend's.
 *
 * @param llmclient - The list's row.
 * @returns The path, with any query and fragment, e.g. /workbench/llm-clients/<hashed id>/prompt/.
 */
export function workbenchPath(llmclient: Pick<LLMClient, "urlChatapp">): string {
  const url = new URL(llmclient.urlChatapp, window.location.origin);
  return `${url.pathname}${url.search}${url.hash}`;
}
