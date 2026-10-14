/**
 * Landing — the public home page. It only composes the sections; each one is
 * its own component in this folder.
 *
 * The wrapper class matters: landing.css is written to apply only inside
 * .landing-page, so loading it does not restyle any other page.
 */
import { useAuth } from "../../auth/useAuth";
import "../../styles/landing/landing.css";
import Navbar from "./Navbar";
import Hero from "./Hero";
import About from "./About";
import RoleCards from "./RoleCards";
import Stages from "./Stages";
import Pricing from "./Pricing";
import Capabilities from "./Capabilities";
import Results from "./Results";
import Footer from "./Footer";

export default function Landing() {
  // The one place this page reads the session. Everything below receives what
  // it needs as props, so those components stay simple and easy to test.
  const { user, logout } = useAuth();

  return (
    <div className="landing-page">
      <Navbar user={user} onSignOut={logout} />
      <Hero user={user} />
      <About />
      <RoleCards user={user} />
      <Stages />
      <Pricing />
      <Capabilities />
      <Results />
      <Footer />
    </div>
  );
}
