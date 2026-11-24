/**
 * EditorViewToolbar Component
 *
 * The view controls of a Monaco editor, the Request's or the Response's, in the same toolbar as the
 * Server Logs tab's log viewer, and with its buttons (ToolbarButton, from @smarter/serverlogs):
 * - Wrap lines: long lines wrap, or scroll horizontally. They wrap, until the user scrolls them.
 * - Expand JSON: the JSON is expanded, or its nested objects and arrays are folded, so that only
 *   the top-level keys show. Replacing the editor's whole text, e.g. with a new response or another
 *   template, expands it again, as Monaco forgets the folds.
 * - Copy: the editor's text, to the clipboard.
 *
 * The toolbar owns the editor's wordWrap option, so the editor's own options must not set it: the
 * editor re-applies its options whenever its parent renders.
 *
 * :param editor: The editor, once it has mounted, or null.
 * :type editor: monaco.editor.IStandaloneCodeEditor | null
 */
import { useEffect, useState } from "react";
import type * as monaco from "monaco-editor";

import { gettext, useCopyToClipboard } from "@smarter/common";
import { ToolbarButton } from "@smarter/serverlogs";

import "./styles.css";

interface EditorViewToolbarProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
}

function EditorViewToolbar({ editor }: EditorViewToolbarProps) {
  const [wrap, setWrap] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const { copy: copyText, copied } = useCopyToClipboard();

  useEffect(() => {
    editor?.updateOptions({ wordWrap: wrap ? "on" : "off" });
  }, [editor, wrap]);

  // a new text has no folds.
  useEffect(() => {
    if (!editor) return;
    const subscription = editor.onDidChangeModelContent((event) => {
      const replaced = event.isFlush || (event.changes.length === 1 && event.changes[0].text === editor.getValue());
      if (replaced) setExpanded(true);
    });
    return () => subscription.dispose();
  }, [editor]);

  const toggleExpanded = () => {
    if (!editor) return;
    editor.trigger("toolbar", "editor.unfoldAll", null);
    // level 1 is the root object, so folding level 2 leaves its keys in view.
    if (expanded) editor.trigger("toolbar", "editor.foldLevel2", null);
    setExpanded((previous) => !previous);
  };

  // where the page may not write to the clipboard, the text can still be selected.
  const copy = () => void copyText(editor?.getValue() ?? "");

  return (
    <div className="console-server-logs-toolbar passthrough-editor-toolbar">
      <div className="console-server-logs-controls ms-auto">
        <ToolbarButton
          icon="wrap"
          label={gettext("Wrap lines")}
          title={wrap ? gettext("Scroll long lines") : gettext("Wrap long lines")}
          pressed={wrap}
          onClick={() => setWrap((previous) => !previous)}
          showLabel
        />
        <ToolbarButton
          icon="expandJson"
          label={gettext("Expand JSON")}
          title={expanded ? gettext("Collapse all the JSON") : gettext("Expand all the JSON")}
          pressed={expanded}
          onClick={toggleExpanded}
          showLabel
        />
        <ToolbarButton
          icon="copy"
          label={copied ? gettext("Copied") : gettext("Copy the text")}
          title={copied ? gettext("Copied") : gettext("Copy the text")}
          onClick={copy}
        />
      </div>
    </div>
  );
}

export default EditorViewToolbar;
