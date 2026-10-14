import { Link } from "react-router-dom";
import { PATHS } from "../../routes";

export default function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="hero-content">
        <h1>
          We audit.
          <br />
          We monitor.
          <br />
          You save.
        </h1>
        <p>
          EnerTrack partners with universities, campuses and corporate offices
          to cut energy costs. A certified auditor walks your site and tells you
          what to fix. Our platform then tracks what your consumption actually
          does, month by month, against the same month last year — so you can
          see whether it worked.
        </p>
        <p className="hero-lede">
          You pay a subscription for the service. Every rupee you save is yours.
        </p>
        <div className="hero-cta">
          <Link to={PATHS.registerOrganisation} className="btn-primary">
            Request an audit
          </Link>
          <a href="#engagement" className="btn-secondary">
            See how it works
          </a>
        </div>
        <p className="hero-note">
          Currently serving 2 client organisations across 3 campuses.
        </p>
      </div>
      <div className="hero-image">
        <img src="/assets/hero.png" alt="Modern Sustainable Campus" />
      </div>
    </header>
  );
}
