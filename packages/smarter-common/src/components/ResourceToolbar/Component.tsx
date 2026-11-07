/**
 * ResourceToolbar
 *
 * The toolbar of a resource in a list: in each row of a list's ListView, and in its DetailView. It links to the
 * resource's manifest page (Edit), and clones, renames and deletes it through the list api's actions, with a dialog
 * that asks for the new name or confirms the deletion, then one that reports the result: the server's error
 * message, or success. Closing the success dialog queries the list again (onRequery).
 *
 * Every resource list's toolbar is this component, with the list's own messages: each is a whole sentence about
 * the list's kind, e.g. "Clone guardrail %(name)s to a new resource owned by you.", so that it translates well (see
 * ToolbarMessages). A list adds links of its own before Edit, e.g. the LLMClient's workbench, with links, and may
 * say more about what a deletion destroys, with messages.deleteWarning.
 *
 * The action is a TanStack Query mutation (see ../../lib/query): one at a time, whose buttons are disabled while it
 * runs. Only one dialog is open at a time. The dialogs are defined outside of ResourceToolbar, so that React does
 * not recreate, and reset, them each time it renders.
 */
import { useMutation } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { actionUrl } from "../../lib/actionUrl";
import { loggerPrefix } from "../../lib/const";
import fetchDjangoUrl from "../../lib/django";
import { gettext, interpolate, interpolateNodes } from "../../lib/i18n";
import { Modal } from "../../lib/modalDialogue";
import { useSmarterQueryClient } from "../../lib/query";
import type { SessionContext } from "../../lib/Types";

import "./styles.css";

/** What the toolbar needs of a resource: a row of a list api. */
export interface ToolbarResource {
  /** The id in the list api's action urls, e.g. delete/<id>/. */
  id: number | string;
  name: string;
  /** The resource's manifest page, which Edit opens. */
  manifestUrl: string;
  /** False when the resource may not be deleted: other resources depend on it, or the user may not. */
  canDelete?: boolean | null;
}

/**
 * The toolbar's messages about a list's kind, each a whole sentence, translated where the list defines them, e.g.
 * gettext("Rename guardrail %(name)s."). %(name)s is the resource's name; %(status)s and %(error)s are a failed
 * action's status and the server's error message.
 */
export interface ToolbarMessages {
  /** The buttons' titles, e.g. "Edit: Open the YAML manifest that defines this guardrail resource". */
  editTitle: string;
  cloneTitle: string;
  renameTitle: string;
  deleteTitle: string;
  /** Delete's title when the resource may not be deleted, which says why. */
  deleteForbiddenTitle: string;
  /** The clone dialog: its title, e.g. "Clone Guardrail", what it does (%(name)s), and what to type. */
  cloneDialogTitle: string;
  cloneDialogText: string;
  cloneDialogHint: string;
  /** The rename dialog: its title, what it does (%(name)s), and what to type. */
  renameDialogTitle: string;
  renameDialogText: string;
  renameDialogHint: string;
  /** The name field's placeholder, e.g. "Enter new guardrail name". */
  namePlaceholder: string;
  /** The delete dialog: its title, and its question (%(name)s). */
  deleteDialogTitle: string;
  deleteDialogText: string;
  /** What a deletion destroys. "Data is not recoverable." if omitted. */
  deleteWarning?: string;
  /** The error dialog's sentence (%(name)s). */
  errorText: string;
  /** Each action's failure (%(status)s, %(error)s), and its success, which the resource's name follows. */
  cloneFailed: string;
  cloneSucceeded: string;
  renameFailed: string;
  renameSucceeded: string;
  deleteFailed: string;
  deleteSucceeded: string;
}

type Verb = "clone" | "rename" | "delete";

type Dialog = null | Verb | "confirmation" | "error";

/** An action of the list api: its path, e.g. clone/12/new_name/, and what it does. */
interface Action {
  path: string;
  verb: Verb;
}

/** A name dialog's props. */
interface NameDialogProps {
  title: string;
  text: ReactNode;
  hint: string;
  placeholder: string;
  initialName: string;
  onOk: (name: string) => void;
  onCancel: () => void;
}

/** Asks for a name: the clone's, empty, or the new one, from the current name. It is mounted only while open. */
const NameDialog = ({ title, text, hint, placeholder, initialName, onOk, onCancel }: NameDialogProps) => {
  const [inputValue, setInputValue] = useState(initialName);
  return (
    <Modal show title={title} onOk={() => onOk(inputValue)} onCancel={onCancel}>
      <p>{text}</p>
      <p>
        <em>{hint}</em>
      </p>
      <input value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder={placeholder} />
    </Modal>
  );
};

/** The message of a failed action: the list's sentence, with the status and the server's error message. */
function failure(message: string, response: Response, data: { error?: string }): Error {
  return new Error(interpolate(message, { status: response.status, error: data.error || response.statusText }));
}

interface ResourceToolbarProps<T extends ToolbarResource> {
  sessionContext: SessionContext;
  resource: T;
  messages: ToolbarMessages;
  /** Queries the list again, after an action succeeded. */
  onRequery: () => void;
  /** The list's own links, before Edit, e.g. the LLMClient's workbench. */
  links?: ReactNode;
}

export default function ResourceToolbar<T extends ToolbarResource>({
  sessionContext,
  resource,
  messages,
  onRequery,
  links,
}: ResourceToolbarProps<T>) {
  // which dialog is open, and about which resource: a clone's dialog is about the clone.
  const [dialog, setDialog] = useState<{ type: Dialog; resource: T | null }>({ type: null, resource: null });
  const close = () => setDialog({ type: null, resource: null });

  /** The messages of an action, by its verb. */
  const outcome = (verb: Verb) => {
    if (verb === "clone") return { failed: messages.cloneFailed, succeeded: messages.cloneSucceeded };
    if (verb === "rename") return { failed: messages.renameFailed, succeeded: messages.renameSucceeded };
    return { failed: messages.deleteFailed, succeeded: messages.deleteSucceeded };
  };

  // POST to one of the list api's actions, e.g. clone/12/new_name/. See actionUrl() for how its url is built.
  const queryClient = useSmarterQueryClient();
  const action = useMutation(
    {
      mutationFn: async ({ path, verb }: Action) => {
        const response = await fetchDjangoUrl(sessionContext, actionUrl(sessionContext, path), JSON.stringify({}));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw failure(outcome(verb).failed, response, data);
        return data as Partial<T>;
      },
      onSuccess: (data, { verb }) => {
        console.debug(loggerPrefix, `ResourceToolbar: ${verb} succeeded:`, data);
        // clone and rename answer with the resulting resource; delete answers with a message.
        setDialog((current) => ({ type: "confirmation", resource: data && data.id ? (data as T) : current.resource }));
      },
      onError: (error, { verb }) => {
        console.error(loggerPrefix, `ResourceToolbar: ${verb} failed:`, error);
        setDialog((current) => ({ type: "error", resource: current.resource }));
      },
    },
    queryClient,
  );
  const run = (target: T, next: Action) => {
    // the dialog closes while the action runs, but remembers its resource, for the result.
    setDialog({ type: null, resource: target });
    action.mutate(next);
  };

  const target = dialog.resource;
  const name = <strong>{target?.name}</strong>;
  const busy = action.isPending;
  return (
    <>
      <div className="toolbar btn-group pe-2" role="group" aria-label={gettext("Actions")}>
        {links}
        <a href={resource.manifestUrl} className="btn btn-icon btn-sm border" title={messages.editTitle} tabIndex={0}>
          <i className="bi bi-pencil-square md-blue" />
        </a>
        <button
          type="button"
          className="btn btn-icon btn-sm border"
          title={messages.cloneTitle}
          onClick={() => setDialog({ type: "clone", resource })}
          disabled={busy}
          tabIndex={0}
        >
          <i className="bi bi-files md-green" />
        </button>
        <button
          type="button"
          className="btn btn-icon btn-sm border"
          title={messages.renameTitle}
          onClick={() => setDialog({ type: "rename", resource })}
          disabled={busy}
          tabIndex={0}
        >
          <i className="bi bi-pencil md-blue" />
        </button>
        <button
          type="button"
          className="btn btn-icon btn-sm border"
          title={resource.canDelete === false ? messages.deleteForbiddenTitle : messages.deleteTitle}
          onClick={() => setDialog({ type: "delete", resource })}
          disabled={resource.canDelete === false || busy}
          tabIndex={0}
        >
          <i className="bi bi-trash md-red" />
        </button>
      </div>

      <div>
        {dialog.type === "clone" && target && (
          <NameDialog
            title={messages.cloneDialogTitle}
            text={interpolateNodes(messages.cloneDialogText, { name })}
            hint={messages.cloneDialogHint}
            placeholder={messages.namePlaceholder}
            initialName=""
            onOk={(newName) => run(target, { path: `clone/${target.id}/${newName}/`, verb: "clone" })}
            onCancel={close}
          />
        )}
        {dialog.type === "rename" && target && (
          <NameDialog
            title={messages.renameDialogTitle}
            text={interpolateNodes(messages.renameDialogText, { name })}
            hint={messages.renameDialogHint}
            placeholder={messages.namePlaceholder}
            initialName={target.name}
            onOk={(newName) => run(target, { path: `rename/${target.id}/${newName}/`, verb: "rename" })}
            onCancel={close}
          />
        )}
        <Modal
          show={dialog.type === "delete"}
          title={messages.deleteDialogTitle}
          onOk={() => target && run(target, { path: `delete/${target.id}/`, verb: "delete" })}
          onCancel={close}
        >
          <p>{interpolateNodes(messages.deleteDialogText, { name })}</p>
          <p>
            <em>{messages.deleteWarning ?? gettext("Data is not recoverable.")}</em>
          </p>
        </Modal>
        <Modal show={dialog.type === "error"} title={gettext("❌ Error")} onClose={close}>
          <p>{interpolateNodes(messages.errorText, { name })}</p>
          <p>
            {action.error?.message ? (
              <span className="text-danger">{action.error.message}</span>
            ) : (
              <em>{gettext("An unknown error occurred.")}</em>
            )}
          </p>
        </Modal>
        <Modal
          show={dialog.type === "confirmation"}
          title={gettext("✅ Success")}
          onClose={() => {
            close();
            onRequery();
          }}
        >
          <p>
            {action.variables ? outcome(action.variables.verb).succeeded : ""} {name}.
          </p>
          <p>
            <em>{gettext("Operation completed successfully.")}</em>
          </p>
        </Modal>
      </div>
    </>
  );
}
