/**
 * ManifestEditor Component
 *
 * A Monaco YAML editor for a Smarter manifest, with a copy button on its top right. It marks the
 * manifest's errors, i.e. its YAML syntax errors, and the errors of its SAM model.
 *
 * Hovering over a field shows what it is, from its kind's JSON Schema (lib/schemaHelp), and the path of the
 * field under the cursor goes to onCursorPath, for the help under the editor.
 *
 * It uses the same editor options as @smarter/prompt-passthrough's editor, with a theme
 * that matches the read-only manifest of the Smarter web console: rounded corners,
 * a charcoal background and a white foreground (see .code-sample-body in common-styles.css).
 */
import { useEffect, useRef, useState } from "react";
import Editor, { type BeforeMount, type Monaco, type OnMount } from "@monaco-editor/react";
import type * as monaco from "monaco-editor";

import { useCopy } from "../../lib/useCopy";
import { fieldHelp, helpMarkdown, type JsonSchema } from "../../lib/schemaHelp";
import { useLockedFields } from "../../lib/useLockedFields";
import { keyPathAt, type ManifestError } from "../../lib/validation";

import "./styles.css";
import { gettext } from "@smarter/common";

const THEME = "smarter-manifest";
const BACKGROUND = "#333333";
const FOREGROUND = "#f1f1f1";
const MIN_HEIGHT = 300;
const PADDING = 15;
const MARKER_OWNER = "smarter-manifest";

/** The editor's height: its content's height, between minHeight and 75% of the window's height. */
function editorHeight(contentHeight: number, minHeight: number): number {
  return Math.max(minHeight, Math.min(contentHeight, Math.round(window.innerHeight * 0.75)));
}

const defineTheme: BeforeMount = (monacoInstance) => {
  monacoInstance.editor.defineTheme(THEME, {
    base: "vs-dark",
    inherit: true,
    rules: [{ token: "", foreground: FOREGROUND.slice(1) }],
    colors: {
      "editor.background": BACKGROUND,
      "editor.foreground": FOREGROUND,
      "editorGutter.background": BACKGROUND,
    },
  });
};

interface ManifestEditorProps {
  value: string;
  errors: ManifestError[];
  editor: monaco.editor.IStandaloneCodeEditor | null;
  onEditorDidMount: (editor: monaco.editor.IStandaloneCodeEditor) => void;
  onChange: (value: string) => void;
  /** The JSON Schema of the manifest's kind, for the help of the field under the mouse. */
  schema?: JsonSchema | null;
  /** Called with the path of the field under the cursor, or null when the cursor isn't on a field. */
  onCursorPath?: (path: string[] | null) => void;
  /** Whether apiVersion, kind and metadata.name are locked, as they are for an existing resource. */
  lockFields?: boolean;
  /** The editor's least height, in pixels. */
  minHeight?: number;
}

function ManifestEditor({
  value,
  errors,
  editor,
  onEditorDidMount,
  onChange,
  schema = null,
  onCursorPath,
  lockFields = true,
  minHeight = MIN_HEIGHT,
}: ManifestEditorProps) {
  const [height, setHeight] = useState(minHeight);
  const [monacoInstance, setMonacoInstance] = useState<Monaco | null>(null);
  const { copied, copy } = useCopy(editor);
  useLockedFields(lockFields ? editor : null, monacoInstance);

  // the hover provider is Monaco's, for every YAML editor of the page: it reads the current schema from a ref.
  const schemaRef = useRef(schema);
  const onCursorPathRef = useRef(onCursorPath);
  useEffect(() => {
    schemaRef.current = schema;
    onCursorPathRef.current = onCursorPath;
  });

  // show a field's help when the mouse is over it.
  useEffect(() => {
    if (!editor || !monacoInstance) return;
    const provider = monacoInstance.languages.registerHoverProvider("yaml", {
      provideHover: (model: monaco.editor.ITextModel, position: monaco.Position) => {
        if (model !== editor.getModel() || !schemaRef.current) return null;
        const path = keyPathAt(model.getValue(), model.getOffsetAt(position));
        const help = path ? fieldHelp(schemaRef.current, path) : null;
        if (!help) return null;
        return { contents: [{ value: helpMarkdown(help) }] };
      },
    });
    return () => provider.dispose();
  }, [editor, monacoInstance]);

  // report the field under the cursor.
  useEffect(() => {
    if (!editor) return;
    const report = () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      if (!model || !position) return;
      onCursorPathRef.current?.(keyPathAt(model.getValue(), model.getOffsetAt(position)));
    };
    const cursor = editor.onDidChangeCursorPosition(report);
    return () => cursor.dispose();
  }, [editor]);

  // mark each error in the editor, from its position to the end of its line.
  useEffect(() => {
    const model = editor?.getModel();
    if (!model || !monacoInstance) return;
    const markers = errors.map((error) => {
      const position = model.getPositionAt(error.offset);
      return {
        severity: monacoInstance.MarkerSeverity.Error,
        message: error.message,
        source: error.source === "yaml" ? "YAML" : gettext("Smarter manifest"),
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: model.getLineMaxColumn(position.lineNumber),
      };
    });
    monacoInstance.editor.setModelMarkers(model, MARKER_OWNER, markers);
  }, [editor, monacoInstance, errors]);

  const handleMount: OnMount = (editorInstance, monacoFromEditor) => {
    setMonacoInstance(monacoFromEditor);
    setHeight(editorHeight(editorInstance.getContentHeight(), minHeight));
    editorInstance.onDidContentSizeChange((e) => setHeight(editorHeight(e.contentHeight, minHeight)));
    onEditorDidMount(editorInstance);
  };

  return (
    <div className="code-sample-body manifest-editor-window">
      <button
        type="button"
        className="btn btn-sm btn-icon manifest-editor-copy"
        title={gettext("Copy: Copy this manifest to the clipboard")}
        onClick={copy}
      >
        <i className={`ki-duotone ${copied ? "ki-copy-success" : "ki-copy"} fs-2`}>
          <span className="path1"></span>
          <span className="path2"></span>
        </i>
      </button>
      <Editor
        height={`${height}px`}
        defaultLanguage="yaml"
        theme={THEME}
        value={value}
        beforeMount={defineTheme}
        onMount={handleMount}
        onChange={(newValue) => onChange(newValue ?? "")}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: '"Fira Code", "Consolas", "Monaco", monospace',
          fontLigatures: true,
          lineHeight: 22,
          wordWrap: "on",
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: PADDING, bottom: PADDING },
          renderLineHighlight: "none",
          tabSize: 2,
        }}
      />
    </div>
  );
}

export default ManifestEditor;
