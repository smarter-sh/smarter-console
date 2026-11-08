/**
 * DropOverlay Component
 *
 * The drop zone: shown over the editor only while the user drags a file over the page (see lib/useFileDrag).
 * Dropping the file on it opens the file in the editor.
 */
import type { DragEvent } from "react";

import { gettext } from "@smarter/common";

import "./styles.css";

interface DropOverlayProps {
  /** Called with the dropped file. */
  onFile: (file: File) => void;
}

function DropOverlay({ onFile }: DropOverlayProps) {
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className="apply-manifest-drop-overlay"
      role="region"
      aria-label={gettext("Drop Zone")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <span className="apply-manifest-drop-overlay-title">{gettext("Drop Zone")}</span>
      <span className="fs-4 text-muted">{gettext("Drop a manifest file to open it in the editor.")}</span>
    </div>
  );
}

export default DropOverlay;
