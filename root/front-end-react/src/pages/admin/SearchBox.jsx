/**
 * SearchBox — the search field above the admin tables.
 *
 * Controlled by its page (value down, onChange up). type="search" gives the
 * browser's own clear (x) button and the Escape-to-clear shortcut.
 */
export default function SearchBox({ id, label, value, onChange, placeholder }) {
  return (
    <div className="form-field" style={{ marginBottom: 0, flex: "1 1 260px" }}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        maxLength={100}
      />
    </div>
  );
}
