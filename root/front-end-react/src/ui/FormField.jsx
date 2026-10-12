/**
 * FormField — one labelled input with its error message.
 *
 * It owns no state. The parent keeps the value and passes it down as a prop,
 * and passes onChange down so typing reports back up. That "value down,
 * change up" loop is what makes the input a controlled input.
 *
 * `adornment` is for extra UI that sits inside the input box (the password
 * eye). It is optional, so email fields simply leave it out.
 */
export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  maxLength,
  autoFocus,
  adornment,
}) {
  const input = (
    <input
      id={name}
      name={name}
      type={type}
      className={error ? "input input-invalid" : "input"}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      autoComplete={autoComplete}
      maxLength={maxLength}
      autoFocus={autoFocus}
    />
  );

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {adornment ? (
        <div className="password-wrap">
          {input}
          {adornment}
        </div>
      ) : (
        input
      )}
      {/* .field-error is display:none in the CSS, so show it only when there
          is something to say. */}
      {error && (
        <span className="field-error" style={{ display: "block" }}>
          {error}
        </span>
      )}
    </div>
  );
}
