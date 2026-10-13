/**
 * DuplicateModal — the "Possible Duplicate Report" popup on /campus/wastage.
 *
 * Shown by WastageForm when the visitor already reported the same category
 * at the same place in the last 7 days. It only displays and reports back:
 * the form decides when to show it and what the buttons do.
 *
 * Props:
 *   type       the wastage category being submitted ("Energy", ...)
 *   duplicate  the earlier report: { id, ... }
 *   daysAgo    whole days since it was filed (worked out by the form when
 *              Submit is pressed: a component may not read the clock while
 *              it draws, or it could show a different result each time)
 *   onCancel   called by Cancel, or by clicking the dark background
 *   onConfirm  called by Submit Anyway
 *
 * Styles: wastage.css. Replaces the overlay built with innerHTML in
 * js/enduser/wastage.js.
 */
export default function DuplicateModal({
  type,
  duplicate,
  daysAgo,
  onCancel,
  onConfirm,
}) {
  let when = "today";
  if (daysAgo === 1) when = "1 day ago";
  if (daysAgo > 1) when = `${daysAgo} days ago`;

  return (
    // The dark background. A click on it (but not on the white box) cancels.
    <div
      className="dup-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="dup-box">
        <h3>Possible Duplicate Report</h3>

        <div className="dup-warning">
          <p>
            A similar <strong>{type} wastage</strong> report (
            <strong>#{duplicate.id}</strong>) was filed <strong>{when}</strong>{" "}
            for the same location.
          </p>
        </div>

        <p className="dup-question">Do you still want to submit this report?</p>

        <div className="dup-actions">
          <button type="button" className="dup-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dup-btn primary" onClick={onConfirm}>
            Submit Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
