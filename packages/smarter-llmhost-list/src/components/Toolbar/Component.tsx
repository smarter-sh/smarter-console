/**
 * Toolbar React Component
 *
 * The toolbar of a llmhost, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the llmhost's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - llmhost (LLMHost): The llmhost resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} llmhost={llmhost} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { LLMHost } from "../../lib/Types";

/** The toolbar's messages about llmhosts: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this llmhost resource"),
  cloneTitle: gettext("Clone: Clone this llmhost resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this llmhost resource"),
  deleteTitle: gettext("Delete: Delete this llmhost resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this llmhost, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone LLMHost"),
  cloneDialogText: gettext("Clone llmhost %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned llmhost."),
  renameDialogTitle: gettext("Rename LLMHost"),
  renameDialogText: gettext("Rename llmhost %(name)s."),
  renameDialogHint: gettext("Provide the new name for the llmhost."),
  namePlaceholder: gettext("Enter new llmhost name"),
  deleteDialogTitle: gettext("Delete LLMHost"),
  deleteDialogText: gettext("Are you sure you want to delete llmhost %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on llmhost %(name)s."),
  cloneFailed: gettext("Failed to clone llmhost (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned llmhost"),
  renameFailed: gettext("Failed to rename llmhost (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed llmhost"),
  deleteFailed: gettext("Failed to delete llmhost (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted llmhost"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  llmhost: LLMHost;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, llmhost, onRequery }: ToolbarProps) => (
  <ResourceToolbar sessionContext={sessionContext} resource={llmhost} messages={messages()} onRequery={onRequery} />
);
