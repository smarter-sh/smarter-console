/**
 * DocumentsSection React Component
 *
 * The Documents section of a vectorstore's Details tab: add documents, by uploading files (picked, or dropped on the
 * section) or by a public url, follow each one as it is loaded, and remove one. The backend extracts a file's text
 * when it is added, then splits, embeds and loads it in the background, so the section asks for the documents again
 * every few seconds while one of them is loading or being removed. A document added to a vectorstore that isn't
 * ready waits, and is loaded once its deploy is ready.
 *
 * Only the vectorstore's owner may add or remove documents; anyone who may see the vectorstore may see them.
 *
 * Props:
 * - sessionContext (SessionContext): Authentication and API context.
 * - vectorstore (Vectorstore): The vectorstore.
 * - onRequery (function): Reloads the list, whose document and vector counts change.
 *
 * Usage:
 * <DocumentsSection sessionContext={sessionContext} vectorstore={vectorstore} onRequery={onRequery} />
 */
import { useState } from "react";
import type { DragEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DetailSection, formatDateTime, gettext, interpolate, useSmarterQueryClient } from "@smarter/common";
import type { SessionContext } from "@smarter/common";

import { MAX_DOCUMENT_BYTES } from "../../lib/const";
import {
  addDocumentUrl,
  addedMessage,
  isChanging,
  loadDocuments,
  removeDocument,
  uploadDocuments,
} from "../../lib/documents";
import { DOCUMENT_STATUS_BADGES, formatBytes } from "../../lib/format";
import type { Vectorstore, VectorstoreDocument } from "../../lib/Types";

/** How often the documents are asked for again while one of them is changing, in milliseconds. */
export const POLL_INTERVAL = 3000;

/** The file types whose text the backend extracts: smarter.apps.vectorstore.extract. */
export const ACCEPTED_FILES = ".pdf,.txt,.md,.markdown,.csv,.json,.yaml,.yml,.html,.htm";

interface DocumentsSectionProps {
  sessionContext: SessionContext;
  vectorstore: Vectorstore;
  onRequery: () => void;
}

/** A document's status badge, and why it failed, if it did. */
function DocumentStatus({ document }: { document: VectorstoreDocument }) {
  const badge = DOCUMENT_STATUS_BADGES[document.status] ?? { className: "badge-light", label: document.status };
  return (
    <>
      <span className={`badge ${badge.className} fw-semibold`}>{badge.label}</span>
      {document.status === "failed" && document.statusMessage && (
        <div className="text-danger fs-7 mt-1">{document.statusMessage}</div>
      )}
    </>
  );
}

function DocumentsSection({ sessionContext, vectorstore, onRequery }: DocumentsSectionProps) {
  const queryClient = useSmarterQueryClient();
  const queryKey = ["smarter-vectorstore-documents", vectorstore.hashedId];
  const query = useQuery(
    {
      queryKey,
      queryFn: ({ signal }) => loadDocuments(sessionContext, vectorstore.hashedId, signal),
      // asked for again while a document is loading or being removed, so that its status changes.
      refetchInterval: (current) => {
        const documents = current.state.data ?? [];
        const changing = documents.some((document) => isChanging(document, vectorstore));
        return changing ? POLL_INTERVAL : false;
      },
    },
    queryClient,
  );
  const [url, setUrl] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    onRequery();
  };
  const upload = useMutation(
    {
      mutationFn: (files: File[]) => uploadDocuments(sessionContext, vectorstore.hashedId, files),
      onSuccess: (result) => {
        setNotice(addedMessage(result));
        refresh();
      },
    },
    queryClient,
  );
  const addUrl = useMutation(
    {
      mutationFn: (address: string) => addDocumentUrl(sessionContext, vectorstore.hashedId, address),
      onSuccess: (result) => {
        setUrl("");
        setNotice(addedMessage(result));
        refresh();
      },
    },
    queryClient,
  );
  const remove = useMutation(
    {
      mutationFn: (document: VectorstoreDocument) => removeDocument(sessionContext, vectorstore.hashedId, document.id),
      onSuccess: () => {
        setConfirmingId(null);
        refresh();
      },
    },
    queryClient,
  );

  const [tooLarge, setTooLarge] = useState<string[]>([]);
  const send = (files: File[]) => {
    const accepted: File[] = [];
    const rejected: string[] = [];
    for (const file of files) {
      if (file.size > MAX_DOCUMENT_BYTES) {
        rejected.push(file.name);
      } else {
        accepted.push(file);
      }
    }
    setTooLarge(rejected);
    setNotice("");
    if (accepted.length) {
      upload.mutate(accepted);
    }
  };
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    send(Array.from(event.dataTransfer.files));
  };

  const documents = query.data ?? [];
  const busy = upload.isPending || addUrl.isPending;
  const inputId = `vectorstore-${vectorstore.id}-files`;
  const urlId = `vectorstore-${vectorstore.id}-url`;
  const mutationError = upload.error ?? addUrl.error ?? remove.error;

  return (
    <DetailSection title={gettext("Documents")} icon="folder">
      <div
        className={`border border-dashed rounded p-5 mb-4 text-center ${dragging ? "border-primary bg-light-primary" : "border-gray-300"}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={gettext("Drop files here to add them")}
      >
        <p className="mb-2">
          {gettext("Drop files here, or")}{" "}
          <label htmlFor={inputId} className="btn btn-sm btn-light-primary ms-1 mb-0">
            {gettext("choose files")}
          </label>
        </p>
        <input
          id={inputId}
          type="file"
          multiple
          accept={ACCEPTED_FILES}
          className="d-none"
          disabled={busy}
          onChange={(event) => {
            send(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <div className="text-muted fs-7">
          {interpolate(gettext("PDF, text, Markdown, CSV, JSON, YAML or HTML, up to %(size)s each."), {
            size: formatBytes(MAX_DOCUMENT_BYTES),
          })}
        </div>
      </div>

      <form
        className="d-flex gap-2 mb-4"
        onSubmit={(event) => {
          event.preventDefault();
          setNotice("");
          if (url.trim()) addUrl.mutate(url.trim());
        }}
      >
        <label htmlFor={urlId} className="visually-hidden">
          {gettext("Url of a page or file")}
        </label>
        <input
          id={urlId}
          type="url"
          className="form-control form-control-sm"
          placeholder={gettext("https://example.com/faq.html")}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="submit" className="btn btn-sm btn-primary text-nowrap" disabled={busy || !url.trim()}>
          {gettext("Add url")}
        </button>
      </form>

      {busy && <p className="text-muted fs-7">{gettext("Adding... Their text is being extracted.")}</p>}
      {notice && <div className="alert alert-light-success fs-7 py-2">{notice}</div>}
      {tooLarge.length > 0 && (
        <div className="text-danger fs-7 mb-2">
          {interpolate(gettext("Too large to add: %(names)s."), { names: tooLarge.join(", ") })}
        </div>
      )}
      {mutationError && <div className="text-danger fs-7 mb-2">{mutationError.message}</div>}
      {vectorstore.status !== "ready" && (
        <p className="text-muted fs-7">
          {gettext("This vectorstore isn't ready. Documents added now are loaded once it is deployed and ready.")}
        </p>
      )}

      {query.isError && <div className="text-danger fs-7">{query.error.message}</div>}
      {query.isSuccess && documents.length === 0 && (
        <p className="text-muted fs-7">{gettext("It has no documents yet.")}</p>
      )}
      {documents.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm table-row-bordered align-middle mb-0">
            <thead>
              <tr className="fw-semibold text-gray-600">
                <th scope="col">{gettext("Document")}</th>
                <th scope="col">{gettext("Status")}</th>
                <th scope="col" className="text-end">
                  {gettext("Chunks")}
                </th>
                <th scope="col" className="text-end">
                  {gettext("Size")}
                </th>
                <th scope="col">{gettext("Added")}</th>
                <th scope="col">
                  <span className="visually-hidden">{gettext("Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="text-break">{document.name}</td>
                  <td>
                    <DocumentStatus document={document} />
                  </td>
                  <td className="text-end">{document.chunkCount}</td>
                  <td className="text-end text-nowrap">{formatBytes(document.sizeBytes)}</td>
                  <td className="text-nowrap">{document.createdAt ? formatDateTime(document.createdAt) : ""}</td>
                  <td className="text-end text-nowrap">
                    {confirmingId === document.id ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm btn-danger me-1"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate(document)}
                        >
                          {gettext("Remove it")}
                        </button>
                        <button type="button" className="btn btn-sm btn-light" onClick={() => setConfirmingId(null)}>
                          {gettext("Keep it")}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm btn-light-danger"
                        disabled={document.status === "deleting"}
                        aria-label={interpolate(gettext("Remove %(name)s"), { name: document.name })}
                        onClick={() => setConfirmingId(document.id)}
                      >
                        {gettext("Remove")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DetailSection>
  );
}

export default DocumentsSection;
