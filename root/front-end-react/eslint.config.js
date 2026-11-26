import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "src/styles"]),

  {
    files: ["**/*.{js,jsx}"],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // ── Merge-gate rule: all navigation goes through the router ──
      //
      // The old front end navigated with window.location.href in dozens of
      // places. Each one is a full page reload: it discards the router's
      // history, remounts every provider and wipes component state. This is
      // the rule most likely to be broken by muscle memory while porting a
      // page, so it fails the lint rather than waiting for review.
      //
      // Use <Link to="..."> or the useNavigate() hook instead.
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "location",
          message:
            "Navigate with <Link> or useNavigate() — window.location reloads the app and drops router state.",
        },
      ],
      "no-restricted-globals": [
        "error",
        {
          name: "location",
          message:
            "Navigate with <Link> or useNavigate() — location reloads the app and drops router state.",
        },
      ],
    },
  },

  {
    // ── Merge-gate rule: server data goes through the Redux store ──
    //
    // Pages, layout and shared UI read data with useSelector and change it
    // with dispatch(thunk). Only src/store (and src/api itself) may call the
    // API client. A direct api.get in a page makes a private copy of server
    // data that the rest of the app cannot see or refresh, and survives
    // sign-out. Named helpers (isNetworkError, pingBackend,
    // SESSION_EXPIRED_EVENT) are still fine to import.
    //
    // Need an endpoint? Add a thunk to its slice (see src/store/README.md).
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/store/**", "src/api/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/api/client", "**/api/client.js"],
              importNames: ["default"],
              message:
                "Don't call the API from here: dispatch a thunk from src/store/slices instead (see src/store/README.md).",
            },
          ],
        },
      ],
    },
  },

  {
    // ── Merge-gate rule: the session belongs to the auth slice ──
    //
    // store/slices/authSlice.js owns reading and writing the session, and
    // src/api reads it to send the sign-in token. Everywhere else goes through
    // useAuth(), so that a page cannot quietly hold a copy of the user that
    // drifts out of sync with the one the API client is sending.
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/auth/**", "src/api/**", "src/store/slices/authSlice.js"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value='currentUser']",
          message:
            "Read the session with useAuth(), not localStorage directly — src/auth owns it.",
        },
        {
          selector: "Literal[value='enertrack_impersonator']",
          message:
            "Impersonation state belongs to the auth slice — use useAuth().impersonate / stopImpersonating.",
        },
      ],
    },
  },
]);
