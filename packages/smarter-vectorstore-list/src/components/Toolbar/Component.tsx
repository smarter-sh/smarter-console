/**
 * Toolbar React Component
 *
 * The toolbar of a vectorstore, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the vectorstore's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - vectorstore (Vectorstore): The vectorstore resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} vectorstore={vectorstore} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Vectorstore } from "../../lib/Types";

/** The toolbar's messages about vectorstores: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this vectorstore resource"),
  cloneTitle: gettext("Clone: Clone this vectorstore resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this vectorstore resource"),
  deleteTitle: gettext("Delete: Delete this vectorstore resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this vectorstore, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Vectorstore"),
  cloneDialogText: gettext("Clone vectorstore %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned vectorstore."),
  renameDialogTitle: gettext("Rename Vectorstore"),
  renameDialogText: gettext("Rename vectorstore %(name)s."),
  renameDialogHint: gettext("Provide the new name for the vectorstore."),
  namePlaceholder: gettext("Enter new vectorstore name"),
  deleteDialogTitle: gettext("Delete Vectorstore"),
  deleteDialogText: gettext("Are you sure you want to delete vectorstore %(name)s?"),
  deleteWarning: gettext(
    "Its database, its documents and its snapshots are destroyed, and cannot be recovered. A vectorstore with deletion protection cannot be deleted.",
  ),
  errorText: gettext("An error occurred while performing the operation on vectorstore %(name)s."),
  cloneFailed: gettext("Failed to clone vectorstore (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned vectorstore"),
  renameFailed: gettext("Failed to rename vectorstore (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed vectorstore"),
  deleteFailed: gettext("Failed to delete vectorstore (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted vectorstore"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  vectorstore: Vectorstore;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, vectorstore, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={vectorstore} messages={messages()} onRequery={onRequery} />
);
