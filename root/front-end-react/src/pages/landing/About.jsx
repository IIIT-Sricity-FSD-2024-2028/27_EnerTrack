export default function About() {
  return (
    <section className="section about" id="about">
      <div className="about-grid">
        <div className="about-text">
          <h2 className="section-title">
            Not software you install. A partner you hire.
          </h2>
          <p>
            Most institutions already know they waste energy. What they lack is
            someone qualified to find the savings, and a way to tell afterwards
            whether anything actually changed.
          </p>
          <p>
            EnerTrack provides both. Our certified energy auditors visit your
            site and write up what to fix, each measure with its cost, its
            saving and its payback. Our platform then tracks consumption month
            by month and reports it against the same month a year earlier. Your
            own facilities team carries out the fixes, because they know your
            buildings better than we do.
          </p>
          <p>
            We charge a subscription for that, not a share of what you save. You
            keep all of it.
          </p>
        </div>
        <div className="about-image">
          <img
            src="/assets/logo5.jpeg"
            alt="A hand holding a small globe with a plant sprouting from it"
          />
        </div>
      </div>
    </section>
  );
}
