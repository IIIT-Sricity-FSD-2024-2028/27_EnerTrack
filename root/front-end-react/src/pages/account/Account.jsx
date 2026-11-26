/**
 * Account.jsx — My account, for every signed-in role.
 *
 * Three cards, one job each: change your details, change your password,
 * delete your account. Each card keeps its own form state; this page only
 * hands each card `notify` (the shared useToast) as a prop so it can
 * report "saved" without knowing how toasts are drawn.
 *
 * It is the same page for every role. DashboardLayout puts the sidebar of the
 * person's own area around it.
 */
import { useToast } from "../../ui/useToast";
import DeleteCard from "./DeleteCard";
import DetailsCard from "./DetailsCard";
import PasswordCard from "./PasswordCard";

import "../../styles/shared/tech_shared.css";
import "./account.css";

export default function Account() {
  const showToast = useToast();

  return (
    <div className="account-page">
      <header className="page-header">
        <h1>My account</h1>
        <p>
          Update your details, change your password, or delete your account.
        </p>
      </header>

      {/* Details and password side by side; delete runs full width below. */}
      <div className="account-columns">
        <DetailsCard notify={showToast} />
        <PasswordCard notify={showToast} />
      </div>
      <DeleteCard />

    </div>
  );
}
