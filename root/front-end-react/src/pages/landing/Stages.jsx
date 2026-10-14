import SectionHeader from "./SectionHeader";

const STAGES = [
  {
    num: "01",
    title: "Audit and site visit",
    text: "A certified energy auditor walks your campus, records what metering you already have, and writes up where the savings are — each measure with its cost, its saving, and its payback.",
  },
  {
    num: "02",
    title: "Subscribe",
    text: "Pick the tier that fits your estate and your team. Your organisation, buildings and meters are set up, and your people get their dashboards.",
  },
  {
    num: "03",
    title: "Monitor",
    text: "Consumption, cost and carbon tracked continuously. Anomaly alerts reach your technicians, and faults become work orders without anyone rekeying anything.",
  },
  {
    num: "04",
    title: "Improve, and see it",
    text: "Your team carries out the recommendations. Each month we show you consumption against the same month a year earlier, so the effect is measured rather than asserted.",
  },
];

export default function Stages() {
  return (
    <section className="section engagement" id="engagement">
      <SectionHeader title="Four stages, and no surprises.">
        One price, agreed before anything starts. What changes over time is what
        you learn about your own buildings.
      </SectionHeader>

      <div className="stage-grid stage-grid-4">
        {STAGES.map((stage) => (
          <div className="stage-card" key={stage.num}>
            <span className="stage-num">{stage.num}</span>
            <h4>{stage.title}</h4>
            <p>{stage.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
