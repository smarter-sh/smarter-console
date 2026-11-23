/**
 * useCopyToClipboard: copies a text to the clipboard, and says so for a moment afterwards, for every copy button
 * in the console, e.g. CopyButton, the manifest editor's toolbar and the server log viewer's.
 *
 * copy(text) writes the text to the clipboard, and resolves to whether it did. copied is true for
 * COPIED_MILLISECONDS after a copy that worked; a second copy in that time starts the moment again. Nothing is
 * copied, and copy() resolves to false, when the text is empty, or when the page may not use the clipboard
 * (navigator.clipboard is undefined outside a secure context) or the browser refuses it. The text is never
 * logged: it may be a manifest, a prompt or a secret.
 *
 * Usage:
 *
 *   const { copy, copied } = useCopyToClipboard();
 *   <button type="button" onClick={() => void copy(text)}>{copied ? gettext("Copied") : gettext("Copy")}</button>
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { loggerPrefix } from "./const";

/** How long copied stays true after a copy, in milliseconds. */
export const COPIED_MILLISECONDS = 1500;

export interface CopyToClipboard {
  /** Writes text to the clipboard. Resolves to true if it did, false if it didn't. */
  copy: (text: string) => Promise<boolean>;
  /** Whether a copy worked in the last COPIED_MILLISECONDS. */
  copied: boolean;
}

export function useCopyToClipboard(): CopyToClipboard {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = useCallback(async (text: string) => {
    if (!text) return false;
    if (!navigator.clipboard) {
      console.warn(loggerPrefix, "The clipboard isn't available on this page.");
      return false;
    }
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.error(loggerPrefix, "Could not copy to the clipboard:", error);
      return false;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MILLISECONDS);
    return true;
  }, []);

  return { copy, copied };
}
