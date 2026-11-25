/**
 * FoodLogCard — "Log food waste", for General Maintenance only.
 *
 * When they clear a cafeteria's or mess's food-waste bins they weigh what is
 * in them and log it here (POST /food-waste-logs). That weigh-in is to food
 * what a meter reading is to electricity: the Sustainability Officer sees
 * the trend as a waste signal and checks food targets against it.
 *
 * Shown only when the technician's team (from GET /dispatch/availability)
 * is "general".
 */
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import api from "../../api/client";
import { selectAvailability } from "../../store/slices/dispatchSlice";

const MEALS = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "other", label: "Whole day / other" },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function FoodLogCard() {
  const availability = useSelector(selectAvailability);
  const isGeneral = availability?.team === "general";

  const [places, setPlaces] = useState([]);
  const [form, setForm] = useState({ location: "", kg: "", meal: "lunch", date: today() });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { text, error }

  useEffect(() => {
    if (!isGeneral) return undefined;
    let live = true;
    // The places already logged, so the same name is used every time.
    api
      .get("/food-waste-logs/summary")
      .then((rows) => live && setPlaces((Array.isArray(rows) ? rows : []).map((r) => r.location)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isGeneral]);

  if (!isGeneral) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    const kg = Number(form.kg);
    if (form.location.trim().length < 2) return setMessage({ text: "Say where the bins were.", error: true });
    if (!(kg > 0)) return setMessage({ text: "Enter the weight in kg.", error: true });
    if (form.date > today()) return setMessage({ text: "The date can't be in the future.", error: true });
    setBusy(true);
    try {
      const saved = await api.post("/food-waste-logs", { location: form.location.trim(), kg, meal: form.meal, date: form.date });
      setMessage({ text: `Logged ${saved.kg} kg at ${saved.location}.` });
      setForm((f) => ({ ...f, kg: "" }));
      if (!places.includes(saved.location)) setPlaces((p) => [...p, saved.location]);
    } catch (err) {
      setMessage({ text: err.message, error: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card food-log">
      <div className="feed-header">
        <div>
          <h2>Log food waste</h2>
          <small>Weigh the food-waste bins when you clear them. The Sustainability Officer uses these figures.</small>
        </div>
      </div>
      <form className="food-log-form" onSubmit={submit} noValidate>
        <label>
          Where
          <input list="food-log-places" type="text" maxLength={100} value={form.location} onChange={set("location")} placeholder="e.g. North Campus Cafeteria" />
          <datalist id="food-log-places">
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label>
          Weight (kg)
          <input type="number" min="0.1" step="0.1" value={form.kg} onChange={set("kg")} />
        </label>
        <label>
          Meal
          <select value={form.meal} onChange={set("meal")}>
            {MEALS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Day
          <input type="date" max={today()} value={form.date} onChange={set("date")} />
        </label>
        <div className="food-log-actions">
          <button type="submit" className="btn btn-dark" disabled={busy}>
            {busy ? "Saving…" : "Log it"}
          </button>
        </div>
      </form>
      {message && (
        <p className={message.error ? "food-log-msg is-error" : "food-log-msg"} role={message.error ? "alert" : "status"}>
          {message.text}
        </p>
      )}
    </div>
  );
}
