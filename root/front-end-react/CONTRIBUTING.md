# EnerTrack front end — React port

This folder replaces `root/front-end`, which is now **frozen**. Do not fix bugs
there; anything fixed in the old folder has to be fixed twice. It stays in the
repo because it is the reference you read while porting your pages, and the
fallback if something goes wrong on evaluation day.

## Setup

```bash
cd root/front-end-react
npm install
cp .env.example .env
npm run dev
```

The backend must be running separately on port 3000:

```bash
cd root/backend
npm run start:dev
```

`.env` is git-ignored, so copy it from `.env.example` after cloning — `VITE_API_BASE` in it points at the backend. (If you forget, `client.js` falls back to `http://localhost:3000/api` anyway.) CORS on the backend is already open to
all origins with `x-role` and `x-org-id` allowed, so no dev proxy is needed.

## What is already built

| Path | What it is |
| --- | --- |
| `src/api/client.js` | The old `js/shared/api.js`, ported. Two lines changed: the base URL reads from `.env`, and it exports instead of setting `window.api`. Use `api.get/post/patch/put/delete/upload/getBlobUrl` exactly as before. |
| `src/auth/context.js` | The context object, alone, so Fast Refresh works. |
| `src/auth/AuthContext.jsx` | Owns the session. `login`, `logout`, `adoptSession`, `impersonate`, `stopImpersonating`. Writes `localStorage` first, then state — `client.js` reads `localStorage` on every request to build headers. |
| `src/auth/useAuth.js` | `const { user, role, login, logout } = useAuth()`. The only way a page touches the session. |
| `src/legacy/` | `universalDB.js`, `mockData.js`, `notifications.js`, `sensorSimulator.js`, copied unchanged. Already ES modules. Import them where your page used them before. |
| `src/styles/` | All 25 stylesheets, copied unchanged. Import the one your page needs at the top of your route component. |
| `public/assets/` | All 80 images. Reference them as `/assets/logo_technician.png` — absolute from the web root, no `../../`. |

Not built yet: `src/layout/` (the shell), `src/ui/` (shared components),
`src/pages/` (everything). Those come next.

## Who owns what

Each person owns one folder under `src/pages/` and nothing else.

| Owner | Folder | Pages |
| --- | --- | --- |
| Husaam | `pages/landing`, `pages/auth` + all of `src/layout`, `src/ui`, `src/auth`, `src/api` | landing, sign-in, sign-up, register-organisation, 404 |
| Vijaya Teja | `pages/sustainability` | overview, monitoring, initiatives, report, archives |
| Viksa | `pages/finance` | overview, costs, reports, subscription, archives |
| Aadithya | `pages/admin`, `pages/campus` | users, infrastructure, organizations, plans, proposals, revenue, dashboard, wastage |
| Chirag | `pages/technician`, `pages/technician-jr`, `pages/auditor` | overview, alerts, maintenance, work-orders, jr overview, jr work-orders, auditor overview, auditor audits |

## Routes

Role segment first, page second, so role guards wrap a whole branch instead of
being repeated on 27 routes.

```
/                                 landing
/sign-in
/sign-up
/register-organisation
/admin/users | infrastructure | organizations | plans | proposals | revenue
/finance/overview | costs | reports | subscription | archives
/sustainability/overview | monitoring | initiatives | report | archives
/technician/overview | alerts | maintenance | work-orders
/technician-jr/overview | work-orders
/auditor/overview | audits
/campus/dashboard | wastage | archives
*                                 404
```

## Branches

One branch per page, off `main`:

```
feat/react-<role>-<page>
```

for example `feat/react-technician-work-orders`. A branch that touches two
roles' folders will be sent back — that rule is what keeps five people out of
each other's way.

## The four rules a pull request has to pass

1. **One page per PR.** If the diff spans two roles' folders, it is split.
2. **Nothing outside your folder.** `src/ui`, `src/layout`, `src/auth` and
   `src/api` belong to Husaam. If your page needs a shared component changed,
   raise it as a separate request — do not edit it in your branch.
3. **Works with the backend running and with it stopped.** `client.js` already
   produces *"Cannot reach server. Is the backend running on port 3000?"* — that
   path has to survive the port. It is what the demo does if the port is busy.
4. **`npm run lint` passes.** Two of these rules are enforced by it, below.

## What the linter will stop you doing

**`window.location` is banned.** Every navigation is `<Link to="...">` or
`useNavigate()`. The old code navigated with `window.location.href` in dozens of
places; each one is a full page reload that discards router history, remounts
every provider and wipes component state. This is the rule most likely to be
broken by muscle memory, so it fails the lint rather than waiting for review.

**The strings `currentUser` and `enertrack_impersonator` are banned** outside
`src/auth` and `src/api`. Read the session with `useAuth()`. A page holding its
own copy of the user drifts out of sync with the one the API client is putting
in the `x-role` header, and the bug that produces is very hard to see.

## Known debt, stated deliberately

`src/legacy/universalDB.js` is a 1,100-line client-side store over
`localStorage` that predates the backend. It is ported as-is and still backs the
four finance modules (`energyCosts`, `invoices`, `reports`, `activity`) and the
archive pages. Finishing that migration is a backend-integration task, not a
React task, and folding it into this port would put roughly 2,100 extra lines on
one person. It is debt we are choosing, not debt we missed.

Likewise, `x-role` is a client-supplied header with no token — anyone with
devtools can edit the session and become a Super Admin. That is true of the
current app too; the backend's own Swagger text says so at
`users.controller.ts:40`. What changed is that the session now lives in one
module, so adding a real token later means changing `AuthContext` and
`client.js` and nothing else.
