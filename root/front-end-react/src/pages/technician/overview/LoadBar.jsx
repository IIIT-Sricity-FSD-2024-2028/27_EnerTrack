/**
 * LoadBar — how full a technician is, without showing the internal score.
 * A short bar (filled by the work they hold), the number of open jobs and a
 * word: Light, Busy or Full. The word is always there so colour is never the
 * only signal. It draws what it is given and owns nothing.
 */
import { LOAD_LABEL as LABEL, jobsText } from "./issueStage";

export default function LoadBar({ person }) {
  const max = person.max_load || 6;
  const filled = Math.min(person.open_points ?? 0, max);
  const level = person.load || "light";
  const jobs = jobsText(person.open_jobs ?? 0);

  return (
    <span className={`load load-${level}`} role="img" aria-label={`${LABEL[level]}, ${jobs}`}>
      <span className="load-bar" aria-hidden="true">
        {Array.from({ length: max }, (_, i) => (
          <span key={i} className={"load-seg" + (i < filled ? " on" : "")} />
        ))}
      </span>
      <span className="load-text">
        <strong>{LABEL[level]}</strong>
        <small>{jobs}</small>
      </span>
    </span>
  );
}
