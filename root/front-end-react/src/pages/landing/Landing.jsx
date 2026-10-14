/**
 * Landing — the public home page. It only composes the sections; each one is
 * its own component in this folder.
 *
 * The wrapper class matters: landing.css is written to apply only inside
 * .landing-page, so loading it does not restyle any other page.
 */
import { useEffect, useRef, useState } from "react";
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

  // The navbar gets a shadow once the page is scrolled a little. The state
  // lives here, not in Navbar, because the thing being scrolled is this page's
  // wrapper; Navbar just receives the result as a prop.
  const pageRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  // Side effect: listen to scrolling on the wrapper. This is the wrapper, not
  // `window`, because landing.css makes the wrapper the scroll box.
  useEffect(() => {
    const page = pageRef.current;
    function handleScroll() {
      setScrolled(page.scrollTop > 40);
    }
    page.addEventListener("scroll", handleScroll);

    // Cleanup: remove the listener when the page unmounts.
    return () => page.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="landing-page" ref={pageRef}>
      <Navbar user={user} onSignOut={logout} scrolled={scrolled} />
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
