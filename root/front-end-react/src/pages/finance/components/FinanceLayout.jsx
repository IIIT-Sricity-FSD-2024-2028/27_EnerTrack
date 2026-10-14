/**
 * FinanceLayout — the content area shared by all five Financial Analyst
 * pages: the page's own stylesheets and the scrolling content container.
 *
 * The sidebar and the Sign Out bar are NOT drawn here. App.jsx already wraps
 * every finance route in the shared DashboardLayout (src/layout), which draws
 * them for every role — drawing our own as well showed two sidebars.
 *
 * Why styles are passed in: each original HTML page linked a DIFFERENT
 * stylesheet, and those files reuse class names (.card, .bar, .metrics,
 * .badge) with different looks. Importing them all globally would make
 * them overwrite each other, so each page hands over its own CSS text and
 * it is rendered in a <style> tag only while that page is on screen.
 */
import "../../../styles/finance-analyst/finance_port.css";

export default function FinanceLayout({ styles, children }) {
  return (
    <>
      {styles.map((css, index) => (
        <style key={index}>{css}</style>
      ))}

      {/* fa-page marks a finance page, so finance_port.css can fit it into
          the shared layout and undo the global sign-in/landing rules. */}
      <div className="content fa-page">
        <div className="container">{children}</div>
      </div>
    </>
  );
}
