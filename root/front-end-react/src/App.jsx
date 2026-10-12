import { Navigate, Route, Routes } from "react-router-dom";
import FinanceRoutes from "./pages/finance/FinanceRoutes";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/finance/overview" replace />} />
      <Route path="/finance/*" element={<FinanceRoutes />} />
    </Routes>
  );
}
