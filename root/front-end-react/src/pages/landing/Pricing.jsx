import SectionHeader from "./SectionHeader";

export default function Pricing() {
  return (
    <section className="section pricing" id="pricing">
      <SectionHeader title="One subscription. No share of your savings.">
        Every tier includes the audit, the platform and the reporting. What
        separates them is the size of the estate and the size of the team: more
        campuses and more staff means more people getting value out of it, so it
        costs more.
      </SectionHeader>

      {/* The live plan cards are added in Phase 5c (fetched from the API). */}

      <p className="pricing-note">
        A Campus Visitor account is always free. Anyone on campus can report a
        fault or a leak without adding to your bill — the people who spot
        problems first should never be a line item.
      </p>
    </section>
  );
}
