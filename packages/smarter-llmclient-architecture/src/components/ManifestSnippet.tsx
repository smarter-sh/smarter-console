/**
 * A manifest excerpt to paste into the LLMClient's manifest: the lines that it goes beneath, dimmed, then the lines
 * to add. The Copy button copies only the lines to add, and says "Copied" for a moment afterwards.
 */
import { CopyButton } from "@smarter/common";

import type { ManifestSnippet as Snippet } from "../lib/gettingStarted";

interface ManifestSnippetProps {
  snippet: Snippet;
  /** The excerpt's name, for screen readers, e.g. "A Guardrail, in the manifest". */
  label: string;
}

export default function ManifestSnippet({ snippet, label }: ManifestSnippetProps) {
  return (
    <div className="architecture-snippet" role="group" aria-label={label}>
      <div className="architecture-snippet-bar">
        <span className="architecture-snippet-title">manifest.yaml</span>
        <CopyButton text={`${snippet.code}\n`} className="architecture-snippet-copy" iconClassName="fs-7 me-1" />
      </div>
      <pre className="architecture-snippet-code">
        <code>
          <span className="architecture-snippet-context" aria-hidden="true">
            {`${snippet.context}\n`}
          </span>
          <span className="architecture-snippet-added">{snippet.code}</span>
        </code>
      </pre>
    </div>
  );
}
