/**
 * FieldHelp Component
 *
 * What the field under the editor's cursor is: its path, type, whether it is required, its description
 * and its values, from its kind's JSON Schema (lib/schemaHelp). Without a field, it says how to get help.
 */
import { gettext, interpolateNodes } from "@smarter/common";

import type { FieldHelp as FieldHelpType } from "../../lib/schemaHelp";

import "./styles.css";

interface FieldHelpProps {
  /** The field's help, or null when the cursor isn't on a field that the schema has. */
  help: FieldHelpType | null;
}

function FieldHelp({ help }: FieldHelpProps) {
  if (!help) {
    return (
      <div className="manifest-editor-field-help text-muted mb-2" aria-live="polite">
        <i className="bi bi-lightbulb me-2" />
        {gettext("Move the cursor to a field, or hover over it, to see what it is.")}
      </div>
    );
  }
  return (
    <div className="manifest-editor-field-help mb-2" aria-live="polite" aria-label={gettext("Field help")}>
      <i className="bi bi-lightbulb text-primary me-2" />
      <strong className="me-2">{help.path}</strong>
      <code className="me-2">{help.type}</code>
      {help.required && <span className="badge badge-light-danger me-2">{gettext("required")}</span>}
      {help.description && <span className="text-gray-700">{help.description}</span>}
      {help.values.length > 0 && (
        <span className="text-muted ms-2">
          {interpolateNodes(gettext("One of: %(values)s"), {
            values: <code>{help.values.join(", ")}</code>,
          })}
        </span>
      )}
    </div>
  );
}

export default FieldHelp;
