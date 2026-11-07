/**
 * Toolbar React Component
 *
 * The toolbar of a orchestrator, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the orchestrator's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - orchestrator (Orchestrator): The orchestrator resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} orchestrator={orchestrator} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Orchestrator } from "../../lib/Types";

/** The toolbar's messages about orchestrators: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this orchestrator resource"),
  cloneTitle: gettext("Clone: Clone this orchestrator resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this orchestrator resource"),
  deleteTitle: gettext("Delete: Delete this orchestrator resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this orchestrator, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Orchestrator"),
  cloneDialogText: gettext("Clone orchestrator %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned orchestrator."),
  renameDialogTitle: gettext("Rename Orchestrator"),
  renameDialogText: gettext("Rename orchestrator %(name)s."),
  renameDialogHint: gettext("Provide the new name for the orchestrator."),
  namePlaceholder: gettext("Enter new orchestrator name"),
  deleteDialogTitle: gettext("Delete Orchestrator"),
  deleteDialogText: gettext("Are you sure you want to delete orchestrator %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on orchestrator %(name)s."),
  cloneFailed: gettext("Failed to clone orchestrator (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned orchestrator"),
  renameFailed: gettext("Failed to rename orchestrator (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed orchestrator"),
  deleteFailed: gettext("Failed to delete orchestrator (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted orchestrator"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  orchestrator: Orchestrator;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, orchestrator, onRequery }: ToolbarProps) => (
  <ResourceToolbar
    sessionContext={sessionContext}
    resource={orchestrator}
    messages={messages()}
    onRequery={onRequery}
  />
);
