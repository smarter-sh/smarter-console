/**
 * Apply Manifest
 *
 * The web console's page for applying any Smarter manifest: an editor (@smarter/manifest-editor, for a new
 * manifest) in which the user pastes, types, opens or drops a manifest, or starts from a kind's example. The
 * editor checks it as the user types, shows each field's help from its kind's JSON Schema, and applies it
 * with the cli api, which creates its resource, or updates it if it exists.
 *
 * Dragging a file over the page shows the drop zone over the editor; dropping the file there opens it. A
 * manifest that replaces the editor's text asks first.
 */
import { useState } from "react";

import { gettext, interpolateNodes, Modal } from "@smarter/common";
import type { SessionContext } from "@smarter/common";
import { ManifestEditor } from "@smarter/manifest-editor";

import Actions from "./components/Actions";
import DropOverlay from "./components/DropOverlay";
import { loadExample, readManifestFile } from "./lib/manifests";
import { useFileDrag } from "./lib/useFileDrag";

export interface AppProps {
  sessionContext: SessionContext;
  /** The SAM kinds, e.g. the session's samKinds: the kinds that a manifest may have, and that have examples. */
  kinds: string[];
  /** The cli api's apply url. */
  applyApiUrl: string;
  /** The cli api's validate url. */
  validateApiUrl: string;
  /** The cli api's json-schema url, with kindPlaceholder for the kind. */
  schemaApiUrl: string;
  /** The cli api's example-manifest url, with kindPlaceholder for the kind. */
  exampleApiUrl: string;
  kindPlaceholder: string;
}

/** The editor's text: each new one has a new version, which mounts a new editor with it. */
type Content = { yaml: string; version: number };

/** A manifest that would replace the editor's text, and where it came from, e.g. its file's name. */
type Pending = { yaml: string; source: string };

/** The editor's least height: most of the window, as the drop zone's was. */
function editorMinHeight(): number {
  return Math.max(300, Math.round(window.innerHeight * 0.55));
}

function App({
  sessionContext,
  kinds,
  applyApiUrl,
  validateApiUrl,
  schemaApiUrl,
  exampleApiUrl,
  kindPlaceholder,
}: AppProps) {
  const [content, setContent] = useState<Content>({ yaml: "", version: 0 });
  const [current, setCurrent] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingExample, setIsLoadingExample] = useState(false);
  const [minHeight] = useState(editorMinHeight);
  const isDragging = useFileDrag();

  const replace = (yaml: string) => {
    setContent((previous) => ({ yaml, version: previous.version + 1 }));
    setCurrent(yaml);
    setPending(null);
  };

  /** Put a manifest in the editor, after asking, if it would replace the user's text. */
  const offer = (yaml: string, source: string) => {
    setError(null);
    if (current.trim() && current !== yaml) {
      setPending({ yaml, source });
    } else {
      replace(yaml);
    }
  };

  const openFile = async (file: File) => {
    try {
      offer(await readManifestFile(file), file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const openExample = async (kind: string) => {
    setIsLoadingExample(true);
    try {
      const url = exampleApiUrl.replace(kindPlaceholder, encodeURIComponent(kind.toLowerCase()));
      offer(await loadExample(sessionContext, url, kind), kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsLoadingExample(false);
    }
  };

  return (
    <section id="apply-manifest" className="mt-5" aria-labelledby="apply-manifest-title">
      <h3 id="apply-manifest-title" className="pt-5">
        {gettext("Apply Smarter YAML Manifest")}
      </h3>
      <p className="text-muted">
        {gettext(
          "Paste or type a manifest, open a file, drag one onto this page, or start from an example. It is checked as you type, and hovering over a field shows what it is. Apply creates its resource, or updates it if it exists.",
        )}
      </p>

      <Actions
        kinds={kinds}
        isBusy={isLoadingExample}
        onFile={(file) => void openFile(file)}
        onExample={(kind) => void openExample(kind)}
      />

      {error && (
        <div role="alert" className="alert alert-danger d-flex justify-content-between align-items-center">
          <span>{error}</span>
          <button type="button" className="btn-close" aria-label={gettext("Dismiss")} onClick={() => setError(null)} />
        </div>
      )}

      <div className="position-relative">
        <ManifestEditor
          key={content.version}
          sessionContext={sessionContext}
          initialManifest={content.yaml}
          applyApiUrl={applyApiUrl}
          validateApiUrl={validateApiUrl}
          schemaApiUrl={schemaApiUrl}
          kindPlaceholder={kindPlaceholder}
          kinds={kinds}
          isNew
          minHeight={minHeight}
          emptyMessage={gettext("Paste or type a manifest, open a file, drag one here, or start from an example.")}
          onChange={setCurrent}
        />
        {isDragging && <DropOverlay onFile={(file) => void openFile(file)} />}
      </div>

      {pending && (
        <Modal
          show
          title={gettext("Replace the manifest?")}
          onOk={() => replace(pending.yaml)}
          onCancel={() => setPending(null)}
        >
          <p>
            {interpolateNodes(gettext("Replace the manifest in the editor with %(source)s?"), {
              source: <strong>{pending.source}</strong>,
            })}
          </p>
          <p>
            <em>{gettext("Your changes to it will be lost. Download it first to keep them.")}</em>
          </p>
        </Modal>
      )}
    </section>
  );
}

export default App;
