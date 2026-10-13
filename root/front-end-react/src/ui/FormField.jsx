/**
 * FormField — one labelled input (or dropdown) with its error message.
 *
 * It owns no state. The parent keeps the value and passes it down as a prop,
 * and passes onChange down so typing reports back up. That "value down,
 * change up" loop is what makes the input a controlled input.
 *
 * `adornment` is for extra UI that sits inside the input box (the password
 * eye). It is optional, so email fields simply leave it out.
 *
 * Passing `options` turns the field into a <select>. Each option is
 * { value, label }; `placeholder` is the unselectable first row.
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
  options,
}) {
  const className = error ? "input input-invalid" : "input";

  let control;
  if (options) {
    control = (
      <div className="select-wrap">
        <select
          id={name}
          name={name}
          className={`${className} select`}
          value={value}
          onChange={onChange}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="chevron">▾</span>
      </div>
    );
  } else {
    const input = (
      <input
        id={name}
        name={name}
        type={type}
        className={className}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        autoFocus={autoFocus}
      />
    );
    control = adornment ? (
      <div className="password-wrap">
        {input}
        {adornment}
      </div>
    ) : (
      input
    );
  }

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {control}
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
