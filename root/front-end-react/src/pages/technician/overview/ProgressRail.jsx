/**
 * ProgressRail — six small segments showing how far an issue has come:
 * Reported, Assigned, Accepted, Working, Review, Fixed. It draws what it is
 * given and owns nothing.
 */
import { STEPS } from "./issueStage";

export default function ProgressRail({ step, stalled }) {
  return (
    <div
      className={"rail" + (stalled ? " rail-stalled" : "")}
      role="img"
      aria-label={`Step ${step + 1} of ${STEPS.length}: ${STEPS[step]}`}
    >
      {STEPS.map((name, i) => (
        <span key={name} className={"rail-seg" + (i <= step ? " on" : "")} title={name} />
      ))}
    </div>
  );
}
