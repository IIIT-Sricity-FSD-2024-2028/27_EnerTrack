/**
 * useAuth — the only way components read or change the session.
 *
 * Kept in its own file rather than exported from AuthContext.jsx so that file
 * exports nothing but components. Mixing a hook and a component in one module
 * breaks Vite's Fast Refresh (and trips eslint-plugin-react-refresh), which
 * means edits to the provider would do a full page reload and drop your
 * session mid-development.
 */
import { useContext } from "react";
import { AuthContext } from "./context";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Fires the moment someone renders a page outside <AuthProvider>, with a
    // message that says what to do — far better than the undefined-property
    // crash you would otherwise get several components deeper.
    throw new Error("useAuth must be used inside <AuthProvider>.");
  }
  return ctx;
}
