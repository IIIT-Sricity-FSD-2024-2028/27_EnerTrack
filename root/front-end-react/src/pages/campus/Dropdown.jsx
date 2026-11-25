/**
 * Dropdown — the report form's picker, in place of a native <select>.
 *
 * The browser decides where a native select's list opens and often puts it
 * above the box when the page is scrolled. This one always opens below,
 * scrolls inside itself, and closes on Escape, on a pick, or on a click
 * outside. Arrow keys move, Enter picks.
 *
 * options: [{ value, label }] or, for headed groups,
 *          [{ group: "Corridor", options: [{ value, label }] }]
 * Styles: .dd-* in campus.css.
 */
import { useEffect, useId, useRef, useState } from "react";

/** Flat list of pickable options, in display order. */
function flatten(options) {
  return options.flatMap((o) => (o.group ? o.options : [o]));
}

export default function Dropdown({ id, value, onChange, options, placeholder = "Select…" }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const flat = flatten(options);
  const selected = flat.find((o) => o.value === value);

  // Close when clicking anywhere else.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep the highlighted option in view while using the arrow keys.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setActive(Math.max(0, flat.findIndex((o) => o.value === value)));
    setOpen(true);
  }

  function pick(option) {
    onChange(option.value);
    setOpen(false);
  }

  function onKeyDown(e) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (flat[active]) pick(flat[active]);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const indexOf = new Map(flat.map((o, i) => [o.value, i]));
  const renderOption = (o) => {
    const i = indexOf.get(o.value);
    return (
      <li
        key={o.value}
        id={`${listId}-${i}`}
        data-index={i}
        role="option"
        aria-selected={o.value === value}
        className={"dd-option" + (i === active ? " is-active" : "") + (o.value === value ? " is-selected" : "")}
        onMouseEnter={() => setActive(i)}
        onMouseDown={(e) => e.preventDefault()} // keep focus on the button
        onClick={() => pick(o)}
      >
        {o.label}
      </li>
    );
  };

  return (
    <div className="dd" ref={rootRef}>
      <button
        id={id}
        type="button"
        className={"dd-button" + (open ? " is-open" : "")}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? "" : "dd-placeholder"}>{selected ? selected.label : placeholder}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul className="dd-list" id={listId} role="listbox" ref={listRef}>
          {options.map((o) =>
            o.group ? (
              <li key={`g-${o.group}`} role="presentation">
                <div className="dd-group">{o.group}</div>
                <ul role="group" aria-label={o.group}>
                  {o.options.map(renderOption)}
                </ul>
              </li>
            ) : (
              renderOption(o)
            ),
          )}
        </ul>
      )}
    </div>
  );
}
