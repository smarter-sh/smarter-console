/**
 * The Console's "Architecture" tab: the tree of the SAM resources that the LLMClient is built from, as cards that
 * open each resource's manifest in a new tab. It fetches the tree when it is first opened, and again when its
 * Reload button is pressed, e.g. after a manifest was changed in another tab.
 */
import { useState } from "react";
import { Skeleton, SkeletonRegion } from "@smarter/common";
import { LLMClientArchitecture } from "@smarter/llmclient-architecture";

import TabError from "./TabError";
import { useTabData } from "./useTabData";
import { fetchArchitecture } from "../../lib/api";
import type { WorkbenchConfig } from "../../lib/types";

function ArchitectureTree({ url, onReload }: { url: string; onReload: () => void }) {
  const { data: architecture, error } = useTabData(() => fetchArchitecture(url));
  if (error) return <TabError error={error} />;
  // the diagram's shape while the architecture loads: the LLMClient, and the resources it uses, below it.
  if (architecture === null) {
    return (
      <SkeletonRegion className="d-flex flex-column align-items-center gap-6 p-8">
        <Skeleton shape="block" width={16} height={4.5} />
        <span className="d-flex flex-wrap justify-content-center gap-4">
          {[0, 1, 2, 3].map((card) => (
            <Skeleton key={card} shape="block" width={11} height={3.5} />
          ))}
        </span>
      </SkeletonRegion>
    );
  }
  return <LLMClientArchitecture architecture={architecture} onReload={onReload} />;
}

function ArchitectureTab({ workbench }: { workbench: WorkbenchConfig }) {
  // a new key mounts the tree again, which fetches it again.
  const [generation, setGeneration] = useState(0);
  return (
    <div className="console-architecture-page">
      <ArchitectureTree
        key={generation}
        url={workbench.architectureUrl ?? ""}
        onReload={() => setGeneration((current) => current + 1)}
      />
    </div>
  );
}

export default ArchitectureTab;
