/**
 * The Prompt Engineer's Workbench's configuration, from the LLMClient's hashed id and the console's session: the urls
 * that Django passed it until it moved here. See routes/WorkbenchPage, and smarter.apps.prompt.api.web.urls.
 */
import type { WorkbenchConfig } from "@smarter/workbench";

import type { ConsoleSession } from "@/contract.gen";
import { djangoSessionContext, requestId } from "@/lib/djangoSession";
import { KIND_PLACEHOLDER, manifestEditorUrls } from "@/lib/manifestPages";
import { toolUrls } from "@/lib/tools";

/** The workbench's route. */
export const WORKBENCH_PATH = "/workbench/llm-clients/:id/prompt";

/** The LLM Clients list, where the workbench goes after its LLMClient is deleted. */
export const LLMCLIENT_LIST_PATH = "/workbench";

/** The cookie of the chat session's key: smarter.common.const.SMARTER_CHAT_SESSION_KEY_NAME. */
export const CHAT_SESSION_COOKIE_NAME = "session_key";

/**
 * The path of the workbench's chat session cookies. Not the workbench's own path: a browser's document.cookie shows
 * only the cookies of the url that the document loaded at, and the console's router changes the url without a load.
 * A cookie for the workbench's path is therefore invisible after the user navigates to the workbench from another
 * console page, and the chat would start a new session, and overwrite the one the user left, on every return.
 */
export const CHAT_SESSION_COOKIE_PATH = "/";

/**
 * The name of the chat session's cookie of one LLMClient. The cookie's path is the whole site
 * (CHAT_SESSION_COOKIE_PATH), so the name, not the path, gives each LLMClient's workbench its own chat session.
 *
 * @param hashedId - The LLMClient's hashed id.
 * @returns The cookie's name, e.g. session_key_rMTAwMDAxMgx.
 */
export function chatSessionCookieName(hashedId: string): string {
  return `${CHAT_SESSION_COOKIE_NAME}_${hashedId}`;
}

/** The LLMClient's record locator, for the resource api, which decides whether the user may open its workbench. */
export function llmclientLocator(hashedId: string): string {
  return `llmclient-${hashedId}`;
}

/**
 * The workbench's configuration.
 *
 * @param session - The console's session.
 * @param hashedId - The LLMClient's hashed id, from the route.
 * @param navigate - The router's navigate, with which the workbench leaves for the list after a delete.
 * @returns The configuration, with every tab, and the Server Logs tab while the session's serverLogs is on.
 */
export function workbenchConfig(
  session: ConsoleSession,
  hashedId: string,
  navigate: (url: string) => void,
): WorkbenchConfig {
  const id = encodeURIComponent(hashedId);
  const webApi = `/api/web/prompt/llm-clients/${id}/`;
  const sessionContext = djangoSessionContext(session, manifestEditorUrls.apply, ["custom"]);
  return {
    apiUrl: `/api/v1/llm-clients/${id}/`,
    toggleMetadata: true,
    csrfCookieName: session.cookies.csrfCookieName,
    sessionCookieName: chatSessionCookieName(hashedId),
    cookiePath: CHAT_SESSION_COOKIE_PATH,
    cookieDomain: sessionContext.cookieDomain,
    debugMode: session.flags.reactDebugMode,
    smarterRequestId: requestId(),
    logStreamUrl: session.flags.serverLogs ? toolUrls.logStream : null,
    manifestUrl: `${webApi}manifest/`,
    architectureUrl: `${webApi}architecture/`,
    deploymentUrl: `${webApi}deployment/`,
    llmclientListUrl: LLMCLIENT_LIST_PATH,
    navigate,
    applyApiUrl: manifestEditorUrls.apply,
    validateApiUrl: manifestEditorUrls.validate,
    deleteApiUrl: manifestEditorUrls.delete,
    kindPlaceholder: KIND_PLACEHOLDER,
    session: sessionContext,
  };
}
