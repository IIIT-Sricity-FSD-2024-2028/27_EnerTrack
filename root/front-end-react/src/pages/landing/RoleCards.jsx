import { Link } from "react-router-dom";
import { homeForRole } from "../../routes";

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
    role: "Campus Visitor", // stored role value
    title: "Occupant",
    points: [
      "Reports energy, water, emissions, and food wastage observations.",
      "Tracks report progress through the sustainability and finance workflow.",
      "Receives validation, dismissal, and delivery notifications in-app.",
      "Views archived outcomes with final impact and target summaries.",
    ],
  },
];

// Which of three looks a card gets:
//   "plain"  - nobody is signed in
//   "open"   - this is the signed-in user's own role (Super Admin: all of them)
//   "locked" - signed in, but as a different role
function cardState(user, cardRole) {
  if (!user) return "plain";
  // A Technician Administrator sees the Technician card as theirs.
  const effective =
    user.role === "Technician Administrator" ? "Technician" : user.role;
  return user.role === "Super Admin" || effective === cardRole
    ? "open"
    : "locked";
}

// Where an open card leads. The one card shared by two roles (Technician)
// goes to a different dashboard depending on who is signed in.
function cardTarget(user, cardRole) {
  const role =
    cardRole === "Technician" && user.role !== "Technician"
      ? "Technician Administrator"
      : cardRole;
  return homeForRole(role);
}

// One card. `title`, `points`, `state` and `to` arrive as props.
function RoleCard({ title, points, state, to }) {
  const content = (
    <>
      <h3>{title}</h3>
      <ul>
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </>
  );

  // Same content, three different wrappers.
  if (state === "open") {
    return (
      <Link to={to} className="role-card role-card--open">
        {content}
        <div className="role-card__badge">Go to Dashboard →</div>
      </Link>
    );
  }
  if (state === "locked") {
    return (
      <div className="role-card role-card-locked">
        {content}
        <div className="role-card__lock">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>Locked</span>
        </div>
      </div>
    );
  }
  return <div className="role-card">{content}</div>;
}

// `user` is null when signed out.
export default function RoleCards({ user }) {
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
        {ROLES.map((r) => {
          const state = cardState(user, r.role);
          return (
            <RoleCard
              key={r.role}
              title={r.title}
              points={r.points}
              state={state}
              to={state === "open" ? cardTarget(user, r.role) : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}
