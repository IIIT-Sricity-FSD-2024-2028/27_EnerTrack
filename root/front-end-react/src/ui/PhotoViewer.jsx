/**
 * PhotoViewer — evidence-photo thumbnails that open full size when clicked.
 *
 * Used wherever a wastage report's photos are shown (the occupant's
 * report card and the Sustainability Officer's audit queue). The caller
 * fetches the photos (they sit behind the RBAC headers, so they arrive as
 * blob: URLs from api.getBlobUrl) and passes them in:
 *   <PhotoViewer photos={[{ src, alt }, ...]} />
 * A photo whose src is null/undefined is shown as an empty tile and cannot be
 * opened (still loading, or it failed).
 *
 * The enlarged view: Esc or the backdrop closes it, ←/→ step through the
 * photos, and "Download" saves the full-resolution file.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./PhotoViewer.css";

export default function PhotoViewer({ photos = [], size = 96 }) {
  const [openIndex, setOpenIndex] = useState(null);
  const thumbRefs = useRef([]);
  const closeRef = useRef(null);

  const viewable = photos.map((p, i) => ({ ...p, index: i })).filter((p) => p.src);
  const current = openIndex === null ? null : photos[openIndex];
  const position = viewable.findIndex((p) => p.index === openIndex);

  const close = useCallback(() => {
    const last = openIndex;
    setOpenIndex(null);
    // Put focus back on the thumbnail that opened the viewer
    if (last !== null) requestAnimationFrame(() => thumbRefs.current[last]?.focus());
  }, [openIndex]);

  const step = useCallback(
    (delta) => {
      if (viewable.length < 2 || position === -1) return;
      const next = viewable[(position + delta + viewable.length) % viewable.length];
      setOpenIndex(next.index);
    },
    [viewable, position],
  );

  // Keyboard controls and no page scrolling behind the viewer while open
  useEffect(() => {
    if (openIndex === null) return undefined;
    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, step]);

  if (photos.length === 0) return null;

  return (
    <>
      <div className="photo-viewer-thumbs">
        {photos.map((p, i) => (
          <button
            key={i}
            ref={(el) => (thumbRefs.current[i] = el)}
            type="button"
            className="photo-viewer-thumb"
            style={{ width: size, height: size }}
            disabled={!p.src}
            onClick={(e) => {
              e.stopPropagation(); // the campus card selects itself on click
              setOpenIndex(i);
            }}
            aria-label={p.src ? `View ${p.alt || `photo ${i + 1}`} full size` : p.alt || "Photo loading"}
          >
            {p.src ? <img src={p.src} alt="" /> : <span>{p.alt === "Photo unavailable" ? "Unavailable" : ""}</span>}
          </button>
        ))}
      </div>

      {current?.src &&
        createPortal(
          <div
            className="photo-viewer-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={current.alt || "Photo"}
            onClick={(e) => {
              e.stopPropagation();
              if (e.target === e.currentTarget) close();
            }}
          >
            <div className="photo-viewer-bar">
              <span className="photo-viewer-count">
                {viewable.length > 1 ? `Photo ${position + 1} of ${viewable.length}` : current.alt || "Photo"}
              </span>
              {/* download, not target="_blank": a blob: URL opened as a page
                  runs in this app's origin, so an upload must never be
                  rendered as a document, only saved. */}
              <a className="photo-viewer-btn" href={current.src} download={`evidence-photo-${position + 1}`}>
                Download
              </a>
              <button ref={closeRef} type="button" className="photo-viewer-btn" onClick={close}>
                Close
              </button>
            </div>

            <img className="photo-viewer-image" src={current.src} alt={current.alt || ""} />

            {viewable.length > 1 && (
              <>
                <button type="button" className="photo-viewer-nav prev" onClick={() => step(-1)} aria-label="Previous photo">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                <button type="button" className="photo-viewer-nav next" onClick={() => step(1)} aria-label="Next photo">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
