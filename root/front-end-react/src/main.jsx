import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext.jsx";
import App from "./App.jsx";
import BackendStatusBanner from "./ui/BackendStatusBanner.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <BackendStatusBanner />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
