/**
 * MSW request handlers for the Django api that this package calls. Stories and tests use them
 * to answer its requests. See storybook/preview.ts and test/server.ts in the workspace.
 */
import { http, HttpResponse } from "msw";

import type { Vectorstore, VectorstoreDocument } from "../lib/Types";

import {
  ACTIONS_URL as BASE,
  API_URL,
  documents as exampleDocuments,
  makeDocument,
  makeObject,
  ownedObjects,
  sharedObjects,
} from "./fixtures";

/** The list api: the owned and shared objects. */
export function listHandlers(owned: Vectorstore[] = ownedObjects, shared: Vectorstore[] = sharedObjects) {
  return [
    http.post(`${API_URL}owned/`, () => HttpResponse.json({ objects: owned })),
    http.post(`${API_URL}shared/`, () => HttpResponse.json({ objects: shared })),
  ];
}

/** The clone, rename and delete apis, which succeed. */
export const actionHandlers = [
  http.post(`${BASE}clone/:id/:newName/`, ({ params }) =>
    HttpResponse.json(makeObject(99, { name: String(params.newName) })),
  ),
  http.post(`${BASE}rename/:id/:newName/`, ({ params }) =>
    HttpResponse.json(makeObject(1, { name: String(params.newName) })),
  ),
  http.post(`${BASE}delete/:id/`, ({ params }) => HttpResponse.json({ message: `${params.id} deleted.` })),
];

/** The list api fails. */
export const listErrorHandlers = [
  http.post(`${API_URL}:tab/`, () => HttpResponse.json({ error: "Database unavailable" }, { status: 500 })),
];

export const DOCUMENTS_URL = "/api/v1/vectorstores/:hashedId/documents/";
export const DOCUMENT_URL = "/api/v1/vectorstores/:hashedId/documents/:documentId/";

/**
 * The documents api: the documents, an addition that answers 202 with the documents added, and a removal.
 *
 * @param list - The documents that the list returns.
 */
export function documentsHandlers(list: VectorstoreDocument[] = exampleDocuments) {
  return [
    http.get(DOCUMENTS_URL, () => HttpResponse.json({ documents: list })),
    http.post(DOCUMENTS_URL, () =>
      HttpResponse.json(
        {
          documents: [makeDocument(9, { status: "pending", chunkCount: 0 })],
          duplicates: [],
          queued: true,
          message: "",
        },
        { status: 202 },
      ),
    ),
    http.delete(DOCUMENT_URL, () =>
      HttpResponse.json({ document: "handbook-1.md", status: "deleting" }, { status: 202 }),
    ),
  ];
}
