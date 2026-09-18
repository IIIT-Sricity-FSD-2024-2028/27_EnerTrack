# Admin pages — shared pieces needed (for Husaam)

Written while porting `/admin/users`. The page works without these, using
page-local markup with the old `system_admin_overview.css` classes; each
item below replaces one of those local stand-ins once it exists.

## Modal

Used by Add User, Edit User, Delete User, Act as.

- Props: `title`, `confirmLabel`, `cancelLabel` (default "Cancel"),
  `danger` (red confirm button), `onConfirm`, `onClose`, `children` (body).
- Closes on Escape, backdrop click and Cancel.
- Old markup/classes: `.modal-overlay > .modal-card > .modal-header /
.modal-body / .modal-actions` (see `utils/ui.js` `openModal`).
- Stand-in today: `ModalShell` inside `admin/users/UserModals.jsx`.

## Toast

- `showToast(message, type)` with type `info | success | warning | error`,
  auto-dismiss after 3s, stacked bottom-right.
- Old classes: `.toast-stack`, `.toast.success|warning|error`.
- Should be app-wide (a provider), so a toast survives navigation — e.g.
  after "Act as" redirects to another dashboard.
- Stand-in today: `toasts` state in `admin/Users.jsx`.

## Data table

- Columns with an optional right-aligned actions column, a scroll wrapper,
  an empty-state row spanning all columns.
- Old classes: `.table-card > .table-scroll > table`, `.actions-col`,
  `.row-actions`, `.muted-cell`, `.empty-state`.

## Loading spinner

- The "Loading from backend…" spinner from `adminLayout.js`.

## Sidebar (admin area)

Things the old admin sidebar did that the shared one does not yet:

- Icons per link (the SVGs in `system_admin_overview.html`).
- Role-gated links: Organisations, Pricing Plans, Revenue only for
  **Super Admin**; EnerTrack Proposal only for **Organization Admin**.
- Profile card at the bottom (logo, user name, role).
- Area driven by the signed-in role instead of hardcoded "technician".

## Route guard

- `/admin/*` should require Organization Admin or Super Admin, and the
  Super-Admin-only pages should bounce everyone else to `/admin/users`
  (what `PLATFORM_ONLY_TABS` did in `adminLayout.js`).
