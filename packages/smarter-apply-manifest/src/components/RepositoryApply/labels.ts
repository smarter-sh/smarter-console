/** The names of the statuses of a repository apply run and of its manifests, in the page's language. */
import { gettext } from "@smarter/common";

import type { ManifestStatus, RunStatus } from "../../lib/repositoryApply";

/** Each manifest status's name. */
export function manifestStatusLabel(status: ManifestStatus): string {
  switch (status) {
    case "applied":
      return gettext("Applied");
    case "skipped":
      return gettext("Skipped");
    case "failed":
      return gettext("Failed");
    default:
      return gettext("Pending");
  }
}

/** Each run status's name. */
export function runStatusLabel(status: RunStatus): string {
  switch (status) {
    case "queued":
      return gettext("Queued");
    case "cloning":
      return gettext("Cloning");
    case "applying":
      return gettext("Applying");
    case "finished":
      return gettext("Finished");
    default:
      return gettext("Failed");
  }
}
