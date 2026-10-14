/**
 * Badge — a coloured pill for a status or severity.
 *
 *   <Badge status="implemented" />   ->  green "Implemented"
 *
 * Replaces badge() from js/auditor/utils/utils.js, which returned an HTML
 * string.
 */
import { badgeClass, label } from "../auditorUtils";

export default function Badge({ status }) {
  return <span className={"badge " + badgeClass(status)}>{label(status)}</span>;
}
