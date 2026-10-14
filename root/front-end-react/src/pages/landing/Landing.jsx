/**
 * Landing — the public home page. It only composes the sections; each one is
 * its own component in this folder.
 *
 * The wrapper class matters: landing.css is written to apply only inside
 * .landing-page, so loading it does not restyle any other page.
 */
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
  return (
    <div className="landing-page">
      <Navbar />
      <Hero />
      <About />
      <RoleCards />
      <Stages />
      <Pricing />
      <Capabilities />
      <Results />
      <Footer />
    </div>
  );
}
