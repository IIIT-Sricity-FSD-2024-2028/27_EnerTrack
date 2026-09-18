import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "src/legacy", "src/styles"]),

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
    // ── Merge-gate rule: the session belongs to AuthContext ──
    //
    // src/auth owns reading and writing the session, and src/api reads it to
    // build the x-role / x-org-id headers. Everywhere else goes through
    // useAuth(), so that a page cannot quietly hold a copy of the user that
    // drifts out of sync with the one the API client is sending.
    files: ["src/**/*.{js,jsx}"],
    ignores: ["src/auth/**", "src/api/**"],
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
            "Impersonation state belongs to AuthContext — use useAuth().impersonate / stopImpersonating.",
        },
      ],
    },
  },
]);
