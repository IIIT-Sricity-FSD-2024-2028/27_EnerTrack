/**
 * FinanceLayout — the frame shared by all five Financial Analyst pages:
 * the page's own stylesheets, the sidebar and the scrolling content area.
 *
 * Why styles are passed in: each original HTML page linked a DIFFERENT
 * stylesheet, and those files reuse class names (.card, .bar, .metrics,
 * .badge) with different looks. Importing them all globally would make
 * them overwrite each other, so each page hands over its own CSS text and
 * it is rendered in a <style> tag only while that page is on screen.
 */
import { useState } from "react";
import { useAuth } from "../../../auth/useAuth";
import ProfilePopup from "./ProfilePopup";
import Sidebar from "./Sidebar";

export default function FinanceLayout({ styles, children }) {
  const { user } = useAuth();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <>
      {styles.map((css, index) => (
        <style key={index}>{css}</style>
      ))}

      <div style={{ display: "flex", width: "100%" }}>
        <Sidebar user={user} onProfileClick={() => setShowProfile(true)} />
        <div className="content">
          <div className="container">{children}</div>
        </div>
      </div>

      {showProfile && <ProfilePopup onClose={() => setShowProfile(false)} />}
    </>
  );
}
