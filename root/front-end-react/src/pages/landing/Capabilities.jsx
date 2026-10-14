import SectionHeader from "./SectionHeader";

// `icon` holds JSX (the inside of an <svg>), which is allowed: JSX is just a
// value, so it can sit in an object like a string or a number.
const CAPABILITIES = [
  {
    title: "Live monitoring",
    text: "Every meter reports in continuously. See consumption change in real time, building by building.",
    icon: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
  },
  {
    title: "Faults become work orders",
    text: "An anomaly doesn't just raise an alert — it opens a work order for a technician automatically. Nobody re-keys anything.",
    icon: (
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    ),
  },
  {
    title: "Cost and carbon, broken down",
    text: "Utility cost and emissions tracked by building, by month, by system — so you know exactly where the next upgrade should go.",
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
      </>
    ),
  },
  {
    title: "One dashboard per role",
    text: "Admins, finance, sustainability, technicians and visitors each see only what their own role needs.",
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: "Recommendations tracked to done",
    text: "Every finding from the audit carries a status — proposed, accepted, implemented — so nothing recommended is quietly forgotten.",
    icon: (
      <>
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </>
    ),
  },
  {
    title: "Free for anyone on campus",
    text: "A Campus Visitor account costs nothing. Anyone who spots a leak or a fault can report it in seconds.",
    icon: (
      <>
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
        <circle cx="12" cy="10" r="3" />
      </>
    ),
  },
];

export default function Capabilities() {
  return (
    <section className="section capabilities" id="capabilities">
      <SectionHeader title="What's running once you're live.">
        The audit tells you what to fix. This is what happens every day after
        that.
      </SectionHeader>

      <div className="cap-grid">
        {CAPABILITIES.map((cap) => (
          <div className="cap-card" key={cap.title}>
            <div className="cap-icon">
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
                {cap.icon}
              </svg>
            </div>
            <h4>{cap.title}</h4>
            <p>{cap.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
