/**
 * Actions Component
 *
 * The ways to start a manifest, above the editor, besides pasting or typing one: open a YAML file, or start
 * from a kind's example manifest.
 */
import { useRef, type ChangeEvent } from "react";

import { gettext } from "@smarter/common";

interface ActionsProps {
  /** The SAM kinds, whose example manifests the user may start from. */
  kinds: string[];
  /** Whether an example is loading. */
  isBusy: boolean;
  /** Called with the file that the user chose. */
  onFile: (file: File) => void;
  /** Called with the kind whose example the user chose. */
  onExample: (kind: string) => void;
}

function Actions({ kinds, isBusy, onFile, onExample }: ActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // the same file may be chosen again.
    event.target.value = "";
    if (file) onFile(file);
  };

  const handleExample = (event: ChangeEvent<HTMLSelectElement>) => {
    const kind = event.target.value;
    event.target.value = "";
    if (kind) onExample(kind);
  };

  return (
    <div className="d-flex flex-wrap align-items-center gap-3 mb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".yaml,.yml,.json"
        aria-label={gettext("Manifest file")}
        hidden
        onChange={handleFile}
      />
      <button type="button" className="btn btn-sm btn-light-primary" onClick={() => fileInputRef.current?.click()}>
        <i className="bi bi-folder2-open me-1" />
        {gettext("File Open")}
      </button>
      {kinds.length > 0 && (
        <select
          className="form-select form-select-sm w-auto"
          aria-label={gettext("Start from an example")}
          defaultValue=""
          disabled={isBusy}
          onChange={handleExample}
        >
          <option value="">{isBusy ? gettext("Loading the example…") : gettext("Start from an example…")}</option>
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default Actions;
