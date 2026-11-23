/**
 * The requests of a vectorstore's Documents section to the api's documents routes
 * (smarter.apps.vectorstore.api.v1.views): list them, add files or a url, and remove one, and what the section says
 * about them.
 *
 * Only the vectorstore's owner may add or remove documents: the api answers anyone else with 404, as it does for a
 * vectorstore that they may not see. Neither a file's text nor its name is ever logged.
 */
import {
  deleteDjangoUrl,
  fetchDjangoUrl,
  getDjangoUrl,
  gettext,
  interpolate,
  ngettext,
  sendDjangoForm,
} from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { documentsUrl, documentUrl, loggerPrefix } from "./const";
import type { Vectorstore, VectorstoreDocument, VectorstoreDocuments, VectorstoreDocumentsAdded } from "./Types";

/**
 * The api's reason for a failed request, or a message with its status.
 *
 * @param response - The failed response.
 * @param fallback - The message, with a %(status)s, for a response without a reason.
 * @returns The error to throw.
 */
async function requestError(response: Response, fallback: string): Promise<Error> {
  if (response.status === 404) {
    return new Error(gettext("Only the vectorstore's owner may add or remove its documents."));
  }
  const body: unknown = await response.json().catch(() => null);
  const reason = (body as { error?: unknown; detail?: unknown } | null) ?? {};
  const message = reason.error ?? reason.detail;
  if (typeof message === "string" && message) {
    return new Error(message);
  }
  return new Error(interpolate(fallback, { status: response.status }));
}

/**
 * Load a vectorstore's documents.
 *
 * @param sessionContext - The session.
 * @param hashedId - The vectorstore's hashed id.
 * @param signal - Aborts the request.
 * @returns The documents, newest first.
 * @throws Error if they can't be loaded.
 */
export async function loadDocuments(
  sessionContext: SessionContext,
  hashedId: string,
  signal?: AbortSignal,
): Promise<VectorstoreDocument[]> {
  const response = await getDjangoUrl(sessionContext, documentsUrl(hashedId), signal);
  if (!response.ok) {
    console.error(loggerPrefix, "Error loading the documents:", response.status);
    throw new Error(
      interpolate(gettext("The documents could not be loaded (%(status)s)."), { status: response.status }),
    );
  }
  const body = (await response.json()) as VectorstoreDocuments;
  return body.documents;
}

/**
 * Upload files to a vectorstore. Their text is extracted now, and they are loaded in the background.
 *
 * @param sessionContext - The session.
 * @param hashedId - The vectorstore's hashed id.
 * @param files - The files.
 * @returns What was added, the duplicates, and whether they are queued to be loaded.
 * @throws Error with the api's reason, e.g. a file whose text can't be extracted.
 */
export async function uploadDocuments(
  sessionContext: SessionContext,
  hashedId: string,
  files: File[],
): Promise<VectorstoreDocumentsAdded> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const response = await sendDjangoForm(sessionContext, documentsUrl(hashedId), form);
  if (!response.ok) {
    console.error(loggerPrefix, "Error uploading documents:", response.status);
    throw await requestError(response, gettext("The documents could not be added (%(status)s)."));
  }
  return (await response.json()) as VectorstoreDocumentsAdded;
}

/**
 * Add the page or file at a public url to a vectorstore.
 *
 * @param sessionContext - The session.
 * @param hashedId - The vectorstore's hashed id.
 * @param url - The url, http or https.
 * @returns What was added, the duplicates, and whether they are queued to be loaded.
 * @throws Error with the api's reason, e.g. a url that can't be fetched.
 */
export async function addDocumentUrl(
  sessionContext: SessionContext,
  hashedId: string,
  url: string,
): Promise<VectorstoreDocumentsAdded> {
  const response = await fetchDjangoUrl(sessionContext, documentsUrl(hashedId), JSON.stringify({ url }));
  if (!response.ok) {
    console.error(loggerPrefix, "Error adding a url:", response.status);
    throw await requestError(response, gettext("The url could not be added (%(status)s)."));
  }
  return (await response.json()) as VectorstoreDocumentsAdded;
}

/**
 * Remove a document, and its chunks, from a vectorstore, in the background.
 *
 * @param sessionContext - The session.
 * @param hashedId - The vectorstore's hashed id.
 * @param documentId - The document's id.
 * @throws Error with the api's reason.
 */
export async function removeDocument(sessionContext: SessionContext, hashedId: string, documentId: number) {
  const response = await deleteDjangoUrl(sessionContext, documentUrl(hashedId, documentId));
  if (!response.ok) {
    console.error(loggerPrefix, "Error removing document", documentId, response.status);
    throw await requestError(response, gettext("The document could not be removed (%(status)s)."));
  }
}

/**
 * Whether a document will change without anyone doing anything: it is loading, being removed, or waiting in a
 * vectorstore that is ready, whose Celery task loads it.
 *
 * @param document - The document.
 * @param vectorstore - Its vectorstore.
 * @returns True if the documents should be asked for again.
 */
export function isChanging(document: VectorstoreDocument, vectorstore: Vectorstore): boolean {
  if (document.status === "loading" || document.status === "deleting") {
    return true;
  }
  return document.status === "pending" && vectorstore.status === "ready";
}

/**
 * What an addition did, for a person.
 *
 * @param result - The api's answer.
 * @returns A sentence or two.
 */
export function addedMessage(result: VectorstoreDocumentsAdded): string {
  const added = result.documents.length;
  const duplicates = result.duplicates.length;
  const sentences: string[] = [];
  if (added) {
    sentences.push(
      interpolate(ngettext("Added %(count)s document.", "Added %(count)s documents.", added), { count: added }),
    );
  }
  if (duplicates) {
    sentences.push(
      interpolate(
        ngettext(
          "%(count)s document was already in the vectorstore.",
          "%(count)s documents were already in the vectorstore.",
          duplicates,
        ),
        { count: duplicates },
      ),
    );
  }
  if (added && !result.queued) {
    sentences.push(gettext("They are loaded once the vectorstore is deployed and ready."));
  }
  return sentences.join(" ");
}
