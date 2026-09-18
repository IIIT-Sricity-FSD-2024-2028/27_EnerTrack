/**
 * context.js — the AuthContext object itself, alone in its own module.
 *
 * It lives apart from the provider because Vite's Fast Refresh only works on
 * a file that exports nothing but components. With the context exported from
 * AuthContext.jsx, every edit to the provider triggered a full page reload
 * and dropped the session mid-development.
 *
 * Nothing imports this directly except AuthContext.jsx and useAuth.js —
 * components use useAuth().
 */
import { createContext } from "react";

export const AuthContext = createContext(null);
