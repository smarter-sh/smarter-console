import packageJson from "../../package.json" with { type: "json" };

export const platformName = "Smarter";
export const projectName = packageJson.name;
export const projectVersion = packageJson.version;
export const loggerPrefix = `[${platformName} ${projectName} v${projectVersion}]`;

/** The largest document that the api accepts: smarter.apps.vectorstore.extract.MAX_DOCUMENT_BYTES. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024;

/**
 * The url of a vectorstore's documents, in the api: GET lists them, and POST adds files, text or a url.
 *
 * @param hashedId - The vectorstore's hashed id.
 * @returns The url.
 */
export function documentsUrl(hashedId: string): string {
  return `/api/v1/vectorstores/${hashedId}/documents/`;
}

/**
 * The url of one of a vectorstore's documents, in the api: DELETE removes it, and its chunks.
 *
 * @param hashedId - The vectorstore's hashed id.
 * @param documentId - The document's id.
 * @returns The url.
 */
export function documentUrl(hashedId: string, documentId: number): string {
  return `${documentsUrl(hashedId)}${documentId}/`;
}
