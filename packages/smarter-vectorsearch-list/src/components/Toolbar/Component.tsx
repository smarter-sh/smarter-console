/**
 * Toolbar React Component
 *
 * The toolbar of a vectorsearch, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the vectorsearch's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - vectorsearch (Vectorsearch): The vectorsearch resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} vectorsearch={vectorsearch} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { Vectorsearch } from "../../lib/Types";

/** The toolbar's messages about vectorsearchs: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this vectorsearch resource"),
  cloneTitle: gettext("Clone: Clone this vectorsearch resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this vectorsearch resource"),
  deleteTitle: gettext("Delete: Delete this vectorsearch resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this vectorsearch, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone Vectorsearch"),
  cloneDialogText: gettext("Clone vectorsearch %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned vectorsearch."),
  renameDialogTitle: gettext("Rename Vectorsearch"),
  renameDialogText: gettext("Rename vectorsearch %(name)s."),
  renameDialogHint: gettext("Provide the new name for the vectorsearch."),
  namePlaceholder: gettext("Enter new vectorsearch name"),
  deleteDialogTitle: gettext("Delete Vectorsearch"),
  deleteDialogText: gettext("Are you sure you want to delete vectorsearch %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on vectorsearch %(name)s."),
  cloneFailed: gettext("Failed to clone vectorsearch (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned vectorsearch"),
  renameFailed: gettext("Failed to rename vectorsearch (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed vectorsearch"),
  deleteFailed: gettext("Failed to delete vectorsearch (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted vectorsearch"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  vectorsearch: Vectorsearch;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, vectorsearch, onRequery }: ToolbarProps) => (
  <ResourceToolbar
    sessionContext={sessionContext}
    resource={vectorsearch}
    messages={messages()}
    onRequery={onRequery}
  />
);
