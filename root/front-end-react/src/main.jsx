import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store";
import App from "./App.jsx";
import BackendStatusBanner from "./ui/BackendStatusBanner.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <BackendStatusBanner />
      </BrowserRouter>
    </Provider>
  </StrictMode>,
);
