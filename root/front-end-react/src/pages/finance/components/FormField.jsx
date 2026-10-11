/**
 * FormField — one labelled input inside a modal form.
 * Shows the red error text under the input, like showFieldError() did.
 *
 *   <FormField label="Vendor *" error={errors.vendor}>
 *     <input value={form.vendor} onChange={...} />
 *   </FormField>
 */
export default function FormField({ label, error, children }) {
  return (
    <div className={error ? "fm-group has-error" : "fm-group"}>
      <label>{label}</label>
      {children}
      {error && <span className="field-error-msg">{error}</span>}
    </div>
  );
}
