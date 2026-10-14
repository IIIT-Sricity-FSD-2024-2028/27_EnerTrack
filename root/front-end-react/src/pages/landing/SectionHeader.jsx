/**
 * SectionHeader — the title + intro paragraph that opens four of the landing
 * sections. The same three lines of markup were copied four times in the
 * original HTML; here it is one component.
 *
 * `title` is a prop. The paragraph text is passed as `children`: whatever you
 * write between <SectionHeader> and </SectionHeader> arrives as props.children.
 */
export default function SectionHeader({ title, children }) {
  return (
    <div className="cap-header">
      <h2 className="section-title">{title}</h2>
      <p>{children}</p>
    </div>
  );
}
