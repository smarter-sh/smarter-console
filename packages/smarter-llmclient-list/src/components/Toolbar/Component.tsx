/**
 * Toolbar React Component
 *
 * The toolbar of a llmclient, in each row of the ListView and in its DetailView: @smarter/common's ResourceToolbar,
 * with this list's messages. Edit opens the llmclient's manifest page, and Clone, Rename and Delete use the list api's
 * actions, with a dialog that asks, and one that reports the result. Its own link, before Edit, opens the
 * LLMClient's prompt workbench.
 *
 * Props:
 * - sessionContext (SessionContext): Contains authentication and API information for backend operations.
 * - llmclient (LLMClient): The llmclient resource to manage.
 * - onRequery: Queries the list again, after an action succeeded.
 *
 * Usage:
 * <Toolbar sessionContext={sessionContext} llmclient={llmclient} onRequery={onRequery} />
 */
import type { SessionContext, ToolbarMessages } from "@smarter/common";
import { gettext, ResourceToolbar } from "@smarter/common";

import type { LLMClient } from "../../lib/Types";
import { workbenchPath } from "../../lib/workbench";

/** The toolbar's messages about llmclients: whole sentences, so that they translate well. */
const messages = (): ToolbarMessages => ({
  editTitle: gettext("Edit: Open the YAML manifest that defines this llmclient resource"),
  cloneTitle: gettext("Clone: Clone this llmclient resource to a new resource owned by you"),
  renameTitle: gettext("Rename: Rename this llmclient resource"),
  deleteTitle: gettext("Delete: Delete this llmclient resource"),
  deleteForbiddenTitle: gettext(
    "Delete: You can't delete this llmclient, because other resources depend on it, or you don't have permission to delete it",
  ),
  cloneDialogTitle: gettext("Clone LLMClient"),
  cloneDialogText: gettext("Clone llmclient %(name)s to a new resource owned by you."),
  cloneDialogHint: gettext("Provide the new name for the cloned llmclient."),
  renameDialogTitle: gettext("Rename LLMClient"),
  renameDialogText: gettext("Rename llmclient %(name)s."),
  renameDialogHint: gettext("Provide the new name for the llmclient."),
  namePlaceholder: gettext("Enter new llmclient name"),
  deleteDialogTitle: gettext("Delete LLMClient"),
  deleteDialogText: gettext("Are you sure you want to delete llmclient %(name)s?"),
  errorText: gettext("An error occurred while performing the operation on llmclient %(name)s."),
  cloneFailed: gettext("Failed to clone llmclient (%(status)s): %(error)s"),
  cloneSucceeded: gettext("Successfully cloned llmclient"),
  renameFailed: gettext("Failed to rename llmclient (%(status)s): %(error)s"),
  renameSucceeded: gettext("Successfully renamed llmclient"),
  deleteFailed: gettext("Failed to delete llmclient (%(status)s): %(error)s"),
  deleteSucceeded: gettext("Successfully deleted llmclient"),
});

interface ToolbarProps {
  sessionContext: SessionContext;
  llmclient: LLMClient;
  onRequery: () => void;
}

export const Toolbar = ({ sessionContext, llmclient, onRequery }: ToolbarProps) => (
  <ResourceToolbar
    sessionContext={sessionContext}
    resource={llmclient}
    messages={messages()}
    onRequery={onRequery}
    links={
      <a
        href={workbenchPath(llmclient)}
        className="btn btn-icon btn-sm border"
        title={gettext("Chat: Open the prompt workbench")}
        tabIndex={0}
      >
        <i className="bi bi-chat-dots md-teal" />
      </a>
    }
  />
);
