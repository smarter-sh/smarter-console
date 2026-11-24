/**
 * CopyButton
 *
 * A button that copies a text to the clipboard, and says "Copied" for a moment afterwards (useCopyToClipboard).
 * The words are in a polite live region, so a screen reader announces the change too.
 *
 * :param text: The text to copy.
 * :param label: The button's accessible name, when "Copy" alone wouldn't say what it copies, e.g. "Copy the
 *   command". Without one, the name is the button's words.
 * :param className: The button's classes. By default, a small light Bootstrap button.
 * :param iconClassName: The size and spacing classes of its icon, a copy icon that becomes a check once it has
 *   copied; or null, for words alone.
 */
import { useCopyToClipboard } from "../../lib/clipboard";
import { gettext } from "../../lib/i18n";

export interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  iconClassName?: string | null;
}

export default function CopyButton({
  text,
  label,
  className = "btn btn-sm btn-light",
  iconClassName = "fs-5",
}: CopyButtonProps) {
  const { copy, copied } = useCopyToClipboard();
  return (
    <button type="button" className={className} aria-label={label} onClick={() => void copy(text)}>
      {iconClassName !== null && (
        <i className={`ki-outline ki-${copied ? "check" : "copy"} ${iconClassName}`} aria-hidden="true" />
      )}
      <span aria-live="polite">{copied ? gettext("Copied") : gettext("Copy")}</span>
    </button>
  );
}
