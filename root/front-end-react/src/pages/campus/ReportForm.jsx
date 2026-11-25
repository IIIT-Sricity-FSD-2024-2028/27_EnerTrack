/**
 * ReportForm — the one-page "Report an Issue" form on /campus/dashboard.
 *
 * Students only describe what they see. Each question appears after the one
 * before it is answered, and changing an earlier answer clears everything
 * below it. Nothing is prefilled.
 *
 * The lists come from the server (GET /service-requests/catalogue). They hold
 * labels and follow-up questions only, so this page never knows (or shows)
 * priority, severity, job size or which team will handle the issue: the server
 * works all of that out and takes the reporter from the login.
 *
 * Props:
 *   email     the signed-in user's email, shown read-only
 *   catalogue the question lists from the server
 *   buildings [{ building_id, name }]
 *   onSubmit  async (payload) => result from the server, or throws
 *   onPlusOne async (ticketId) => void, for the "Already reported here" row
 *   nearby    open issues on the chosen building and floor (status only)
 *   viewing   a submitted report from My Reports ({ id, status, summary,
 *             reported_on, form, reopen_reason }): the form is shown filled
 *             in exactly as it was sent, locked, with "New report" below
 *   onNew     () => void, leaves the read-only view for a blank form
 */
import { useMemo, useState } from "react";
import Dropdown from "./Dropdown";
import { Link } from "react-router-dom";
import { PATHS } from "../../routes";

const EMPTY = {
  building_id: "",
  floor: "",
  area: "",
  part: "",
  partOther: false,
  issue_type_id: "",
  item_id: "",
  how_many: "",
  problem_id: "",
  answers: {},
  how_bad: "",
  other_text: "",
  in_danger: null,
  happened_before: null,
  description: "",
};

// Which fields each question owns, so a change clears the ones below it.
const ORDER = [
  "building_id",
  "floor",
  "area",
  "part",
  "issue_type_id",
  "item_id",
  "how_many",
  "problem_id",
  "answers",
  "how_bad",
  "other_text",
  "in_danger",
  "happened_before",
  "description",
];

const OTHER_ITEM = "other";

function Choice({ options, value, onChange }) {
  return (
    <div className="choice-grid">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.value)}
          className={"choice-btn" + (value === o.value ? " selected" : "")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const MAX_FLOOR = 200;
const FLOOR_WORDS = {
  basement: "basement",
  ground: "ground",
  g: "ground",
  roof: "roof",
  terrace: "roof",
  outside: "outside",
  "outside the building": "outside",
  "whole building": "whole_building",
  whole_building: "whole_building",
};

/** What the student typed → a floor id, or "" if it is not a floor (same rules as the server). */
function floorId(raw) {
  const s = String(raw || "").trim().toLowerCase().replace(/[\s-]+/g, " ");
  if (/^\d{1,3}$/.test(s)) {
    const n = Number(s);
    return n >= 1 && n <= MAX_FLOOR ? String(n) : "";
  }
  return FLOOR_WORDS[s] || "";
}

/** A submitted report's answers (GET /service-requests/mine → form) as form state. */
function fromSubmitted(sent, catalogue) {
  if (!sent) return EMPTY;
  const floorLabel = catalogue.floors.find((f) => f.id === sent.floor)?.label;
  return {
    ...EMPTY,
    ...sent,
    floor: floorLabel || String(sent.floor ?? ""),
    // These two are set by the server for floors that decide the place.
    area: ["whole_building", "outside"].includes(sent.area) ? "" : sent.area || "",
    part: sent.part || "",
    answers: sent.answers || {},
    in_danger: sent.in_danger === true,
    happened_before: sent.happened_before === true ? true : null,
    description: sent.description || "",
    other_text: sent.other_text || "",
    how_bad: sent.how_bad || "",
    how_many: sent.how_many || "",
  };
}

function Select({ id, label, value, onChange, options, placeholder }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <Dropdown
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder || "Select…"}
        options={options.map((o) => ({ value: o.id, label: o.label }))}
      />
    </div>
  );
}

export default function ReportForm({
  email,
  catalogue,
  buildings,
  nearby,
  onSubmit,
  onPlusOne,
  onFloorChange,
  viewing = null,
  onNew,
}) {
  const readOnly = !!viewing;
  const [form, setForm] = useState(() => (viewing ? fromSubmitted(viewing.form, catalogue) : EMPTY));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // When an open whole-floor/building issue covers this spot, the server asks
  // "Is this the same problem?" and we hold the answer here.
  const [covers, setCovers] = useState(null);

  // The floor the student typed, understood the way the server will (or "").
  const floor = floorId(form.floor);

  // Change one answer and clear every question below it.
  function set(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      const at = ORDER.indexOf(field);
      for (const later of ORDER.slice(at + 1)) next[later] = EMPTY[later];
      if (field === "area") next.partOther = false;
      return next;
    });
    setError("");
    setCovers(null);
    if (field === "floor" || field === "building_id") {
      onFloorChange?.(
        field === "building_id" ? value : form.building_id,
        field === "floor" ? floorId(value) : "",
      );
    }
  }

  // One "Which place?" list covers the area and its part ("Restroom: Near lift").
  const placeValue =
    floor === "outside"
      ? form.part
      : form.area && catalogue.parts[form.area] && form.part
        ? `${form.area}:${form.part}`
        : form.area;

  function pickPlace(v) {
    if (floor === "outside") return set("part", v);
    const [area, part] = v.split(":");
    set("area", area);
    if (part) setForm((p) => ({ ...p, part }));
  }

  // The area the server will use: some floors decide it themselves.
  const effectiveArea =
    floor === "whole_building"
      ? "whole_building"
      : floor === "outside"
        ? "outside"
        : form.area;

  const issueType = catalogue.issueTypes.find(
    (t) => t.id === form.issue_type_id,
  );

  // Dropdowns only show options that make sense for the place.
  const items = useMemo(() => {
    if (!issueType || !effectiveArea) return [];
    return issueType.items.filter(
      (i) =>
        (!i.areas || i.areas.includes(effectiveArea)) &&
        (!i.floors || i.floors.includes(floor)),
    );
  }, [issueType, effectiveArea, floor]);

  const isOther = form.item_id === OTHER_ITEM;
  const item = items.find((i) => i.id === form.item_id);
  const problem = item?.problems.find((p) => p.id === form.problem_id);

  const parts = catalogue.parts[effectiveArea];
  const needsRoom = effectiveArea === "inside_room";
  const needsTypedPart = effectiveArea === "other";
  const skipsPart =
    floor === "whole_building" ||
    effectiveArea === "whole_floor" ||
    effectiveArea === "laundry_room";
  const placeAnswered =
    !!form.building_id &&
    !!floor &&
    !!effectiveArea &&
    (skipsPart || form.part.trim() !== "");

  const followUps = (item?.followUps || []).filter(
    (f) =>
      (!f.problems || f.problems.includes(form.problem_id)) &&
      (!f.howMany || f.howMany === form.how_many),
  );
  const followUpsDone = followUps.every((f) => form.answers[f.id]);
  const asksHowMany = item?.id === "lights";
  const howManyDone = !asksHowMany || !!form.how_many;

  const describedOk = isOther
    ? !!form.how_bad && form.other_text.trim() !== ""
    : !!form.problem_id && howManyDone && followUpsDone;

  const showDanger = describedOk;
  const showBefore = showDanger && form.in_danger !== null;
  const showNotes = showBefore;
  const canSubmit = showNotes && !submitting && !readOnly;

  const summary = (() => {
    if (!showNotes) return "";
    const b = buildings.find((x) => x.building_id === form.building_id)?.name;
    const floorLabel = catalogue.floors.find((f) => f.id === floor)?.label || floor;
    const area = catalogue.areas.find((a) => a.id === effectiveArea)?.label;
    const partLabel =
      parts?.find((p) => p.id === form.part)?.label || form.part || "";
    const what = isOther
      ? `Other: ${form.other_text.trim()}`
      : `${item?.label} – ${problem?.label}`;
    const where = [
      b,
      floor === "whole_building" ? null : `floor ${floorLabel}`,
      floor === "whole_building" || floor === "outside"
        ? null
        : area?.toLowerCase(),
      partLabel,
    ]
      .filter(Boolean)
      .join(", ");
    return `${what}: ${where}`;
  })();

  function payload(extra = {}) {
    const p = {
      building_id: form.building_id,
      floor,
      area: effectiveArea,
      item_id: form.item_id,
      issue_type_id: form.issue_type_id,
      in_danger: form.in_danger === true,
      ...extra,
    };
    if (form.part.trim()) p.part = form.part.trim();
    if (isOther) {
      p.how_bad = form.how_bad;
      p.other_text = form.other_text.trim();
    } else {
      p.problem_id = form.problem_id;
      if (asksHowMany) p.how_many = form.how_many;
      if (Object.keys(form.answers).length) p.answers = form.answers;
    }
    if (form.happened_before === true) p.happened_before = true;
    if (form.description.trim()) p.description = form.description.trim();
    return p;
  }

  async function send(extra) {
    setSubmitting(true);
    setError("");
    try {
      const result = await onSubmit(payload(extra));
      if (result?.outcome === "covered") {
        setCovers(result.covers);
        return;
      }
      setCovers(null);
      setForm(EMPTY);
    } catch (err) {
      setError(err.message || "Could not submit your report.");
    } finally {
      setSubmitting(false);
    }
  }

  const yesNo = [
    { value: true, label: "Yes" },
    { value: false, label: "No" },
  ];

  return (
    <div className={"report-card" + (readOnly ? " report-card--view" : "")} id="report-form">
      <div className="report-card-header">
        {readOnly ? (
          <>
            <h2>Your report</h2>
            <p>
              {viewing.reported_on ? `Sent on ${new Date(viewing.reported_on).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. ` : ""}
              This is what you sent. It can no longer be changed.
            </p>
          </>
        ) : (
          <>
            <h2>Report an Issue</h2>
            <p>
              Answer a few quick questions about what you can see. It takes under a
              minute.
            </p>
          </>
        )}
      </div>

      <div className="report-card-body">
        {readOnly ? (
          viewing.reopen_reason && (
            <div className="report-note" role="note">
              You said the earlier fix did not work: {viewing.reopen_reason}
            </div>
          )
        ) : (
          <div className="report-note">
            Before reporting, check if it's already in the{" "}
            <Link to={PATHS.campus.issues}>Campus issues</Link> list.
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) send();
          }}
          noValidate
        >
          {/* A submitted report is shown locked: every field is disabled. */}
          <fieldset className="report-fieldset" disabled={readOnly}>
          <Select
            id="rb"
            label="Building"
            value={form.building_id}
            onChange={(v) => set("building_id", v)}
            options={buildings.map((b) => ({
              id: b.building_id,
              label: b.name,
            }))}
          />

          {form.building_id && (
            <div className="form-group">
              <label htmlFor="rf">Where is the problem?</label>
              <input
                id="rf"
                type="text"
                inputMode="text"
                autoComplete="off"
                placeholder="Floor number (e.g. 3), or pick one below"
                value={form.floor}
                onChange={(e) => set("floor", e.target.value)}
              />
              {/* Quick picks in the page, not a <datalist>: Chrome draws a
                  datalist as its own pop-up bubble, which looks out of place. */}
              <div style={{ marginTop: 8 }}>
                <Choice
                  value={catalogue.floors.find((f) => f.label.toLowerCase() === form.floor.trim().toLowerCase())?.label}
                  onChange={(label) => set("floor", label)}
                  options={catalogue.floors.map((f) => ({ value: f.label, label: f.label }))}
                />
              </div>
              {form.floor.trim() && !floor && (
                <small style={{ color: "#b91c1c" }}>
                  Type a floor number (1 to {MAX_FLOOR}), or basement, ground, roof, outside, whole building.
                </small>
              )}
            </div>
          )}

          {floor && floor !== "whole_building" && (
            <div className="form-group">
              <label htmlFor="ra">Which place?</label>
              <Dropdown
                id="ra"
                value={placeValue}
                onChange={pickPlace}
                options={
                  floor === "outside"
                    ? (catalogue.parts.outside || []).map((p) => ({ value: p.id, label: p.label }))
                    : catalogue.areas.map((a) => {
                        const sub = catalogue.parts[a.id];
                        return sub
                          ? { group: a.label, options: sub.map((p) => ({ value: `${a.id}:${p.id}`, label: `${a.label}: ${p.label}` })) }
                          : { value: a.id, label: a.label };
                      })
                }
              />
              {(needsRoom || needsTypedPart) && (
                <input
                  id="rp"
                  type="text"
                  maxLength={60}
                  autoComplete="off"
                  aria-label={needsRoom ? "Room number" : "Describe the place"}
                  placeholder={needsRoom ? "Room number, e.g. 204" : "Describe the place"}
                  value={form.part}
                  onChange={(e) => set("part", e.target.value)}
                  style={{ marginTop: 8 }}
                />
              )}
            </div>
          )}

          {!readOnly && placeAnswered && nearby.length > 0 && (
            <div className="already-reported">
              <strong>Already reported here</strong>
              {nearby.map((t) => (
                <div className="already-row" key={t.id}>
                  <span>{t.summary}</span>
                  <button
                    type="button"
                    className="plus-one-btn"
                    disabled={t.mine}
                    onClick={() => onPlusOne(t.id)}
                  >
                    {t.mine ? "Added" : "+1 Same"}
                  </button>
                </div>
              ))}
              <small>
                Pressing +1 finishes your report. Nothing else to fill in.
              </small>
            </div>
          )}

          {placeAnswered && (
            <Select
              id="rt"
              label="What kind of problem?"
              value={form.issue_type_id}
              onChange={(v) => set("issue_type_id", v)}
              options={catalogue.issueTypes}
            />
          )}

          {issueType && (
            <Select
              id="ri"
              label={issueType.id === "waste" ? "What did you see" : "What's broken"}
              value={form.item_id}
              onChange={(v) => set("item_id", v)}
              options={[...items, { id: OTHER_ITEM, label: "Other (type)" }]}
            />
          )}

          {item?.alertsOfficer && (
            <div className="report-note" role="note">
              General Maintenance will be sent to deal with it, and the Sustainability Officer is told too, since this usually needs
              a longer-term fix. You'll hear what came of it.
            </div>
          )}

          {item && asksHowMany && (
            <div className="form-group">
              <label>How many?</label>
              <Choice
                value={form.how_many}
                onChange={(v) => set("how_many", v)}
                options={[
                  { value: "one", label: "One" },
                  { value: "some", label: "Some" },
                  { value: "all", label: "All here" },
                ]}
              />
            </div>
          )}

          {item && howManyDone && (
            <Select
              id="rw"
              label="What's happening"
              value={form.problem_id}
              onChange={(v) => set("problem_id", v)}
              options={item.problems}
            />
          )}

          {problem &&
            followUps.map((f) => (
              <div className="form-group" key={f.id}>
                <label>{f.question}</label>
                <Choice
                  value={form.answers[f.id]}
                  onChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      answers: { ...p.answers, [f.id]: v },
                    }))
                  }
                  options={f.options.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                />
              </div>
            ))}

          {isOther && (
            <>
              <div className="form-group">
                <label htmlFor="ro">Describe it in a few words</label>
                <input
                  id="ro"
                  type="text"
                  maxLength={60}
                  value={form.other_text}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, other_text: e.target.value }))
                  }
                />
              </div>
              <div className="form-group">
                <label>How bad is it?</label>
                <Choice
                  value={form.how_bad}
                  onChange={(v) => setForm((p) => ({ ...p, how_bad: v }))}
                  options={catalogue.howBad}
                />
              </div>
            </>
          )}

          {showDanger && (
            <div className="form-group">
              <label>Anyone in danger right now?</label>
              <Choice
                value={form.in_danger}
                onChange={(v) => setForm((p) => ({ ...p, in_danger: v }))}
                options={[
                  { value: false, label: "No" },
                  { value: true, label: "Yes" },
                ]}
              />
              {form.in_danger === true && (
                <div className="danger-banner">
                  Call campus security now. We will also treat this report as Critical.
                </div>
              )}
            </div>
          )}

          {showBefore && (
            <div className="form-group">
              <label>Happened here before this month? (optional)</label>
              <Choice
                value={form.happened_before}
                onChange={(v) => setForm((p) => ({ ...p, happened_before: v }))}
                options={yesNo}
              />
            </div>
          )}

          {showNotes && (
            <div className="form-group">
              <label htmlFor="rd">
                Anything else we should know? (optional)
              </label>
              <textarea
                id="rd"
                rows="3"
                maxLength={500}
                placeholder="e.g. happens every evening around 7 pm"
                value={form.description}
                onChange={(e) =>
                  setForm((p) => ({ ...p, description: e.target.value }))
                }
              />
            </div>
          )}

          {covers && (
            <div className="already-reported" role="alert">
              <strong>Is this the same problem?</strong>
              <div className="already-row">
                <span>{covers.summary}</span>
              </div>
              <div className="choice-grid">
                <button
                  type="button"
                  className="choice-btn"
                  disabled={submitting}
                  onClick={() => send({ same_as: covers.id })}
                >
                  Yes, same problem
                </button>
                <button
                  type="button"
                  className="choice-btn"
                  disabled={submitting}
                  onClick={() => send({ same_as: "new" })}
                >
                  No, a different one
                </button>
              </div>
            </div>
          )}

          </fieldset>

          {error && <div className="form-error">{error}</div>}

          {showNotes && <p className="report-summary">{summary}</p>}

          <div className="report-footer">
            <span className="reporting-as">{readOnly ? `Sent as ${email}` : `Reporting as ${email}`}</span>
            {readOnly ? (
              <button type="button" className="btn-submit" onClick={onNew}>
                New report
              </button>
            ) : (
              <button
                type="submit"
                className="btn-submit"
                disabled={!canSubmit || !!covers}
              >
                Submit report
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
