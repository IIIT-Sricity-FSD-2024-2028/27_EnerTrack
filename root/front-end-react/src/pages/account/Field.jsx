/**
 * Field — one labelled input with its error message, for the My account cards.
 *
 * It owns no state. The parent keeps the value and passes it down as a prop,
 * and passes onChange down so typing reports back up (a controlled input).
 * `name` says which value the input edits; `id` links the label to the input
 * and must be unique on the page, so it is its own prop (it defaults to
 * `name`). Anything else an <input> understands (maxLength, autoComplete,
 * readOnly, placeholder) is passed straight through with ...inputProps.
 *
 *   <Field label="Name" name="name" value={v.name} onChange={fn} error={e.name} />
 */
export default function Field({
  label,
  name,
  id = name,
  type = "text",
  value,
  onChange,
  error,
  ...inputProps
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        {...inputProps}
      />
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}
