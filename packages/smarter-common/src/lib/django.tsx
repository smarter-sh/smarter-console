/**
 * Requests to the Smarter Django backend, with the session's cookie and Smarter's client headers.
 *
 * fetchDjangoUrl POSTs JSON, with the CSRF token, read from its cookie; getDjangoUrl GETs, e.g. a REST read of the
 * api. Neither logs a header or a body: the CSRF token, and a body's text, e.g. an objective or a prompt, must never
 * reach the log, which the console shows in DEBUG mode.
 */
import { loggerPrefix } from "./const";
import { getCookie } from "./cookie";
import type { SessionContext } from "./Types";

const applicationJson = "application/json";

/**
 * The headers that every request sends: what the client is, and the request's id.
 *
 * Any custom header added here must also be added to the Django backend's CORS_ALLOW_HEADERS setting in
 * smarter.settings.base.py.
 *
 * @param sessionContext - The session context, which names the client.
 * @returns The headers.
 */
function smarterHeaders(sessionContext: SessionContext): Record<string, string> {
  const capabilities = sessionContext.smarterCapabilities
    ? sessionContext.smarterCapabilities.join(",")
    : "listview,cardview";
  return {
    Accept: applicationJson,
    "X-Smarter-Client": sessionContext.smarterClient,
    "X-Smarter-ClientVersion": sessionContext.smarterClientVersion,
    "X-Smarter-ClientType": "react",
    "X-Smarter-RequestId": sessionContext.smarterRequestId,
    "X-Smarter-Capabilities": capabilities,
  };
}

/**
 * Sends a POST request to the Smarter Django backend with CSRF and session authentication.
 *
 * @param sessionContext - The session context containing API URL, CSRF token, and session cookie information.
 * @param url - The URL to send the POST request to.
 * @param requestJson - The JSON string body to send in the request.
 * @param signal - Aborts the request, e.g. when TanStack Query no longer needs its answer.
 * @returns A `Promise<Response>` from the Fetch API.
 */
export default async function fetchDjangoUrl(
  sessionContext: SessionContext,
  url: string,
  requestJson: string,
  signal?: AbortSignal,
) {
  const csrftokenValue = getCookie({ name: sessionContext.csrfCookieName, domain: sessionContext.cookieDomain });
  if (!csrftokenValue) {
    console.error(
      `${loggerPrefix} fetchDjangoUrl() No CSRF token found for cookie name ${sessionContext.csrfCookieName} in domain ${sessionContext.cookieDomain}.`,
    );
  }
  const requestHeaders = {
    ...smarterHeaders(sessionContext),
    "X-CSRFToken": csrftokenValue!,
    "Content-Type": applicationJson,
  };

  console.debug(`${loggerPrefix} fetchDjangoUrl() POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: requestHeaders,
    body: requestJson,
    signal,
  });

  console.debug(`${loggerPrefix} fetchDjangoUrl() POST ${url} answered ${res.status}`);

  return res;
}

/**
 * Sends a GET request to the Smarter Django backend, with the session's cookie.
 *
 * @param sessionContext - The session context, which names the client.
 * @param url - The URL to GET.
 * @param signal - Aborts the request, e.g. when TanStack Query no longer needs its answer.
 * @returns A `Promise<Response>` from the Fetch API.
 */
export async function getDjangoUrl(sessionContext: SessionContext, url: string, signal?: AbortSignal) {
  console.debug(`${loggerPrefix} getDjangoUrl() GET ${url}`);
  const res = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: smarterHeaders(sessionContext),
    signal,
  });
  console.debug(`${loggerPrefix} getDjangoUrl() GET ${url} answered ${res.status}`);
  return res;
}
