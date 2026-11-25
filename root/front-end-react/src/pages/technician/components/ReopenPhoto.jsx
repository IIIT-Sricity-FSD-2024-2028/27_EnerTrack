import { useEffect, useState } from "react";
import api from "../../../api/client";

/**
 * The photo a reporter sent with "still broken". Fetched with the sign-in
 * token (a bare <img> could not send it) only once someone asks to see it.
 */
export default function ReopenPhoto({ ticketId }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);
  if (failed) return <small className="issue-task">The photo could not be loaded.</small>;
  if (!url)
    return (
      <button
        type="button"
        className="btn btn-light btn-sm"
        onClick={() =>
          api
            .getBlobUrl(`/service-requests/${ticketId}/reopen-photo`)
            .then(setUrl)
            .catch(() => setFailed(true))
        }
      >
        View photo
      </button>
    );
  return (
    <a href={url} target="_blank" rel="noreferrer" className="issue-photo">
      <img src={url} alt="Photo the reporter sent with 'still broken'" />
    </a>
  );
}
