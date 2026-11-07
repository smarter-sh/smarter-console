/**
 * The Console's "Deployment" tab: what comes after deploying the LLMClient, the web console's deployment page, in
 * its workbench mode. It fetches the page's data when it is first opened, and manages the LLMClient's api key in
 * place, with the workbench's session.
 */
import { Skeleton, SkeletonRegion, SkeletonText } from "@smarter/common";
import { DeploymentPage } from "@smarter/llmclient-deployment";

import TabError from "./TabError";
import { useTabData } from "./useTabData";
import { fetchDeploymentPage } from "../../lib/api";
import type { WorkbenchConfig } from "../../lib/types";

function DeploymentTab({ workbench }: { workbench: WorkbenchConfig }) {
  const { data: page, error } = useTabData(() => fetchDeploymentPage(workbench.deploymentUrl ?? ""));
  if (error) return <TabError error={error} />;
  // the deployment page's shape while it loads: its heading, its status, and its sections.
  if (page === null) {
    return (
      <SkeletonRegion className="d-flex flex-column gap-5 p-5">
        <Skeleton width={16} height={1.6} />
        <Skeleton shape="block" height={5} />
        <SkeletonText lines={4} />
        <Skeleton shape="block" height={8} />
      </SkeletonRegion>
    );
  }
  return (
    <div className="console-deployment-page">
      <DeploymentPage context={{ page, session: workbench.session }} />
    </div>
  );
}

export default DeploymentTab;
