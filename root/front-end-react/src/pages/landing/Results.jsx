import SectionHeader from "./SectionHeader";

export default function Results() {
  return (
    <section className="section results" id="results">
      <SectionHeader title="How we prove it, not promise it.">
        Every saving is checked the same way: this month against the same month
        a year earlier. No weather model to argue about and no baseline to
        negotiate — July is compared to July.
      </SectionHeader>

      {/* One real client's numbers from the seed data, not an invented
          industry average: the point is that the figure is checkable. */}
      <div className="proof-panel">
        <div className="proof-compare">
          <div className="proof-bar">
            <div className="proof-bar-row">
              <span className="proof-bar-label">Mar–Aug, last year</span>
              <span className="proof-bar-value">583,800 kWh</span>
            </div>
            <div className="proof-bar-track">
              <div className="proof-bar-fill proof-bar-fill--before" />
            </div>
          </div>
          <div className="proof-bar">
            <div className="proof-bar-row">
              <span className="proof-bar-label">Mar–Aug, this year</span>
              <span className="proof-bar-value">513,744 kWh</span>
            </div>
            <div className="proof-bar-track">
              <div className="proof-bar-fill proof-bar-fill--after" />
            </div>
          </div>
        </div>
        <div className="proof-result">
          <span className="proof-delta">−12%</span>
          <p>
            70,056 kWh less over six months — ₹5.95 lakh saved, against ₹2.34
            lakh of subscription over the same period.
          </p>
        </div>
      </div>
    </section>
  );
}
