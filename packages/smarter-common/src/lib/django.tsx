/**
 * Requests to the Smarter Django backend, with the session's cookie and Smarter's client headers.
 *
 * fetchDjangoUrl POSTs JSON, and sendDjangoForm POSTs a multipart form, e.g. uploaded files, each with the CSRF
 * token, read from its cookie; deleteDjangoUrl DELETEs, with the CSRF token; getDjangoUrl GETs, e.g. a REST read of
 * the api. None logs a header or a body: the CSRF token, and a body's text, e.g. an objective, a prompt or a file,
 * must never reach the log, which the console shows in DEBUG mode.
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
 * The CSRF token, read from its cookie, which every request that changes something sends.
 *
 * @param sessionContext - The session context, which names the cookie.
 * @param caller - The calling function's name, for the error that a missing cookie logs.
 * @returns The token, or an empty string if there is no cookie.
 */
function csrfToken(sessionContext: SessionContext, caller: string): string {
  const token = getCookie({ name: sessionContext.csrfCookieName, domain: sessionContext.cookieDomain });
  if (!token) {
    console.error(
      `${loggerPrefix} ${caller}() No CSRF token found for cookie name ${sessionContext.csrfCookieName} in domain ${sessionContext.cookieDomain}.`,
    );
  }
  return token || "";
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
  const requestHeaders = {
    ...smarterHeaders(sessionContext),
    "X-CSRFToken": csrfToken(sessionContext, "fetchDjangoUrl"),
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
 * Sends a multipart form, e.g. uploaded files, to the Smarter Django backend, with CSRF and session authentication.
 *
 * It sends the headers that fetchDjangoUrl sends, but not its JSON content type: the browser sets the multipart
 * content type, with its boundary.
 *
 * @param sessionContext - The session context, which names the client and the CSRF cookie.
 * @param url - The URL to POST to.
 * @param form - The form.
 * @param signal - Aborts the request.
 * @returns A `Promise<Response>` from the Fetch API.
 */
export async function sendDjangoForm(
  sessionContext: SessionContext,
  url: string,
  form: FormData,
  signal?: AbortSignal,
) {
  console.debug(`${loggerPrefix} sendDjangoForm() POST ${url}`);
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { ...smarterHeaders(sessionContext), "X-CSRFToken": csrfToken(sessionContext, "sendDjangoForm") },
    body: form,
    signal,
  });
  console.debug(`${loggerPrefix} sendDjangoForm() POST ${url} answered ${res.status}`);
  return res;
}

/**
 * Sends a DELETE request to the Smarter Django backend, with CSRF and session authentication.
 *
 * @param sessionContext - The session context, which names the client and the CSRF cookie.
 * @param url - The URL to DELETE.
 * @param signal - Aborts the request.
 * @returns A `Promise<Response>` from the Fetch API.
 */
export async function deleteDjangoUrl(sessionContext: SessionContext, url: string, signal?: AbortSignal) {
  console.debug(`${loggerPrefix} deleteDjangoUrl() DELETE ${url}`);
  const res = await fetch(url, {
    method: "DELETE",
    credentials: "include",
    headers: { ...smarterHeaders(sessionContext), "X-CSRFToken": csrfToken(sessionContext, "deleteDjangoUrl") },
    signal,
  });
  console.debug(`${loggerPrefix} deleteDjangoUrl() DELETE ${url} answered ${res.status}`);
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
