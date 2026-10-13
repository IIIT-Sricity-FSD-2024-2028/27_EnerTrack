/**
 * FinanceRoutes — every /finance/* route of the Financial Analyst section.
 *
 *   /finance/overview      OverviewPage
 *   /finance/reports       ReportsPage       (Financial Reports & Impact)
 *   /finance/costs         CostsPage         (Utility Costs)
 *   /finance/subscription  SubscriptionPage
 *   /finance/archives      ArchivesPage
 *
 * The API needs a signed-in user (their role is sent with every request),
 * so a sign-in card is shown until there is one.
 */
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../../auth/useAuth";
import SignInCard from "./components/SignInCard";
import ToastProvider from "./components/ToastProvider";
import ArchivesPage from "./ArchivesPage";
import CostsPage from "./CostsPage";
import OverviewPage from "./OverviewPage";
import ReportsPage from "./ReportsPage";
import SubscriptionPage from "./SubscriptionPage";
import "../../styles/finance-analyst/finance_port.css";

export default function FinanceRoutes() {
  const { user } = useAuth();

  return (
    <ToastProvider>
      {!user ? (
        <SignInCard />
      ) : (
        <Routes>
          <Route index element={<Navigate to="overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="costs" element={<CostsPage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="archives" element={<ArchivesPage />} />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Routes>
      )}
    </ToastProvider>
  );
}
