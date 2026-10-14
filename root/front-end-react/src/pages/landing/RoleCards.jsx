// The five cards are data. RoleCards loops over this list and hands each entry
// to <RoleCard> as props, so the card markup is written once.
const ROLES = [
  {
    role: "Organization Admin",
    title: "Organisation Admin",
    points: [
      "Your organisation's first account and main point of contact.",
      "Approves EnerTrack's proposals and manages your subscription.",
      "Adds your staff and assigns them their roles.",
      "Oversees infrastructure setup across your campuses.",
    ],
  },
  {
    role: "Financial Analyst",
    title: "Financial Analyst",
    points: [
      "Calculates utility costs and financial ROI metrics.",
      "Generates precise budgetary reports (PDF/CSV).",
      "Evaluates financial impact of energy projects.",
      "Predictive trend analysis for investment decisions.",
    ],
  },
  {
    role: "Technician",
    title: "Technician",
    points: [
      "Executes technical maintenance and sensor calibration.",
      "Responds instantly to real-time anomaly alerts.",
      "Diagnoses equipment issues with FDD tools.",
      "Maintains hardware integrity across campus.",
    ],
  },
  {
    role: "Sustainability Officer",
    title: "Sustainability Officer",
    points: [
      "Strategy lead for campus-wide green initiatives.",
      "Monitors long-term environmental target compliance.",
      "Prepares global sustainability impact reports.",
      "Drives behavioral change through data visibility.",
    ],
  },
  {
    role: "Campus Visitor",
    title: "Campus Visitor",
    points: [
      "Reports energy, water, emissions, and food wastage observations.",
      "Tracks report progress through the sustainability and finance workflow.",
      "Receives validation, dismissal, and delivery notifications in-app.",
      "Views archived outcomes with final impact and target summaries.",
    ],
  },
];

// One card. `title` and `points` arrive as props from the parent.
function RoleCard({ title, points }) {
  return (
    <div className="role-card">
      <h3>{title}</h3>
      <ul>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}

export default function RoleCards() {
  return (
    <section className="section roles" id="roles">
      <h2 className="section-title">
        One login. The right dashboard, every time.
      </h2>
      <p className="roles-intro">
        Every account on your side is scoped to one role and nothing else. Sign
        in, and EnerTrack already knows whether you're approving a proposal,
        closing a work order, or reporting a leak.
      </p>

      <div className="roles-grid">
        {/* `key` lets React tell list items apart when the list changes. */}
        {ROLES.map((r) => (
          <RoleCard key={r.role} title={r.title} points={r.points} />
        ))}
      </div>
    </section>
  );
}
