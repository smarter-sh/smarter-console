/**
 * Toolbar Component
 *
 * The manifest editor's toolbar: a Bootstrap button toolbar, of button groups for save; undo and redo;
 * copy and paste; revert and download; and clone and delete. It is the header of the editor's card.
 *
 * For a new manifest (isNew), save is a labelled Apply button, which applies whatever manifest the editor
 * holds, and there is no resource to clone or delete.
 *
 * Saving, cloning and deleting are handled by the parent, with the cli api. The other
 * buttons work on the Monaco editor directly.
 */
import type * as monaco from "monaco-editor";

import { useCopy } from "../../lib/useCopy";

import "./styles.css";
import { gettext, interpolate, ngettext } from "@smarter/common";

// the most paths that a Keenicons duotone icon in this toolbar has: ki-trash has 5.
const DUOTONE_PATHS = [1, 2, 3, 4, 5];

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  iconClass: string;
  disabled?: boolean;
  /** The button's text, beside its icon, for a primary button; or none, for an icon button. */
  label?: string;
}

function ToolbarButton({ onClick, title, iconClass, disabled = false, label }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={label ? "btn btn-sm btn-primary" : "btn btn-sm btn-icon btn-outline-secondary"}
      onClick={onClick}
      title={title}
      disabled={disabled}
    >
      <i className={label ? `${iconClass} me-1` : iconClass}>
        {DUOTONE_PATHS.map((n) => (
          <span key={n} className={`path${n}`}></span>
        ))}
      </i>
      {label}
    </button>
  );
}

interface CopiedMessageProps {
  show: boolean;
}

/** The same "Copied to clipboard" message as @smarter/prompt-passthrough's toolbar. */
export function CopiedMessage({ show }: CopiedMessageProps) {
  if (!show) return null;
  return <div className="manifest-editor-copied">{gettext("Copied to clipboard")}</div>;
}

interface ToolbarProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  isDirty: boolean;
  problemCount: number;
  isBusy: boolean;
  fileName: string;
  canDelete: boolean;
  deleteTitle: string;
  onSave: () => void;
  onRevert: () => void;
  onClone: () => void;
  onDelete: () => void;
  /** Whether the manifest is a new one, to apply, rather than an existing resource's. */
  isNew?: boolean;
  /** Whether the editor is empty. */
  isEmpty?: boolean;
}

/** The save button's title: why it is disabled, or what it does. */
function saveTitle(isNew: boolean, isEmpty: boolean, isDirty: boolean, problemCount: number): string {
  if (isEmpty) return gettext("Apply: Paste, type or open a manifest first");
  if (!isNew && !isDirty) return gettext("Save: There are no changes to save");
  if (problemCount) {
    return interpolate(
      ngettext(
        "Save: Fix this manifest's problem first",
        "Save: Fix this manifest's %(problemCount)s problems first",
        problemCount,
      ),
      { problemCount },
    );
  }
  return isNew
    ? gettext("Apply: Create the resource that this manifest describes, or update it if it exists")
    : gettext("Save: Apply your changes to this manifest");
}

function Toolbar({
  editor,
  isDirty,
  problemCount,
  isBusy,
  fileName,
  canDelete,
  deleteTitle,
  onSave,
  onRevert,
  onClone,
  onDelete,
  isNew = false,
  isEmpty = false,
}: ToolbarProps) {
  const { copied, copy } = useCopy(editor);

  const handleUndo = () => editor?.trigger("toolbar", "undo", null);
  const handleRedo = () => editor?.trigger("toolbar", "redo", null);

  const handlePaste = async () => {
    if (!editor) return;
    const text = await navigator.clipboard.readText();
    const selection = editor.getSelection();
    if (selection) {
      editor.executeEdits("toolbar", [{ range: selection, text, forceMoveMarkers: true }]);
    }
    editor.focus();
  };

  const handleDownload = () => {
    const value = editor?.getValue();
    if (!value) return;
    const url = URL.createObjectURL(new Blob([value], { type: "application/yaml" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="btn-toolbar manifest-editor-toolbar position-relative"
      role="toolbar"
      aria-label={gettext("Manifest editor")}
    >
      <div className="btn-group me-2" role="group" aria-label={gettext("Save")}>
        <ToolbarButton
          onClick={onSave}
          title={saveTitle(isNew, isEmpty, isDirty, problemCount)}
          iconClass={isNew ? "bi bi-cloud-upload fs-4" : "bi bi-floppy fs-2"}
          label={isNew ? gettext("Apply") : undefined}
          disabled={isEmpty || (!isNew && !isDirty) || problemCount > 0 || isBusy}
        />
      </div>
      <div className="btn-group me-2" role="group" aria-label={gettext("History")}>
        <ToolbarButton onClick={handleUndo} title={gettext("Undo")} iconClass="ki-duotone ki-arrow-circle-left fs-2" />
        <ToolbarButton onClick={handleRedo} title={gettext("Redo")} iconClass="ki-duotone ki-arrow-circle-right fs-2" />
      </div>
      <div className="btn-group me-2" role="group" aria-label={gettext("Clipboard")}>
        <ToolbarButton
          onClick={copy}
          title={gettext("Copy: Copy this manifest to the clipboard")}
          iconClass={`ki-duotone ${copied ? "ki-copy-success" : "ki-copy"} fs-2`}
        />
        <ToolbarButton
          onClick={handlePaste}
          title={gettext("Paste: Paste from the clipboard into this manifest")}
          iconClass="ki-duotone ki-clipboard fs-2"
        />
      </div>
      <div className="btn-group me-2" role="group" aria-label={gettext("File")}>
        <ToolbarButton
          onClick={onRevert}
          title={gettext("Revert: Discard your changes to this manifest")}
          iconClass="ki-duotone ki-arrows-circle fs-2"
          disabled={!isDirty || isBusy}
        />
        <ToolbarButton
          onClick={handleDownload}
          title={interpolate(gettext("Download: Save this manifest as %(fileName)s"), { fileName })}
          iconClass="ki-duotone ki-file-down fs-2"
        />
      </div>
      {!isNew && (
        <div className="btn-group" role="group" aria-label={gettext("Resource")}>
          <ToolbarButton
            onClick={onClone}
            title={gettext("Clone: Create a copy of this resource, with a new name")}
            iconClass="ki-duotone ki-file-added fs-2"
            disabled={isBusy}
          />
          <ToolbarButton
            onClick={onDelete}
            title={deleteTitle}
            iconClass="ki-duotone ki-trash fs-2"
            disabled={!canDelete || isBusy}
          />
        </div>
      )}
      <CopiedMessage show={copied} />
    </div>
  );
}

export default Toolbar;
