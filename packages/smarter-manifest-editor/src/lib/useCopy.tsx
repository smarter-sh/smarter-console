import type * as monaco from "monaco-editor";
import { useCopyToClipboard } from "@smarter/common";

/** Copy the editor's YAML to the clipboard, and briefly show that it was copied (useCopyToClipboard). */
export function useCopy(editor: monaco.editor.IStandaloneCodeEditor | null) {
  const { copy, copied } = useCopyToClipboard();
  return { copied, copy: () => copy(editor?.getValue() ?? "") };
}
