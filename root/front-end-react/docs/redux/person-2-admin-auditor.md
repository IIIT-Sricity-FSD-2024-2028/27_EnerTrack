# Person 2: Admin + Auditor

Start after `feat/redux-foundation` is on `main`. Read `src/store/README.md` first.

**You own:** `subscriptionPlansSlice`, `subscriptionsSlice`,
`platformInvoicesSlice`, `auditRequestsSlice`, `energyAuditsSlice`,
`notificationsSlice`.
**You use (Person 1's):** `usersSlice`, `organizationsSlice`, `campusSlice`,
`buildingsSlice`, `departmentsSlice`, `metersSlice`.

---

## PR 1: `feat/redux-admin-users-orgs` (shared slices only, no new slices)
The slices already exist. This PR only switches the pages over.

| Page | Today | Change to |
|---|---|---|
| `admin/Users.jsx` | `api.get("/users")`, `api.get("/organizations")`, `api.post/patch/delete("/users…")`, then `reloadUsers()` | `fetchUsers()`, `fetchOrganizations()` on mount; `createUser(payload)`, `updateUser({ id: editing.user_id, changes: payload })`, `removeUser(id)`. **Delete `reloadUsers`**: the slice updates in place. Keep the self-edit `adoptSession(...)`. |
| `admin/UserFormModal.jsx` | `api.post("/users/generate-password")` | `dispatch(generatePassword()).unwrap()` → `{ password }` |
| `admin/BulkImportModal.jsx` | `api.post("/users/bulk", { users })` | `dispatch(bulkCreateUsers(rows)).unwrap()` → results array (the user list reloads itself) |
| `admin/Organizations.jsx` | `api.get` orgs/campus/users + CRUD on `/organizations` | `fetchOrganizations/fetchCampuses/fetchUsers`, `createOrganization`, `updateOrganization({ id, changes })`, `removeOrganization(id)`. After deleting an org, `fetchUsers({ force: true })` (the server deletes its users too). |
| `auditor/infrastructure/InfrastructureManager.jsx` + `CampusModal`, `BuildingModal`, `DepartmentModal`, `MeterModal` | `api.get` ×5, `api.post/patch` per modal | `fetchCampuses/Buildings/Departments/Meters/Organizations`; modals dispatch `createX` / `updateX({ id, changes })`. Remove the "reload everything after save" code. |

The `key={user.user_id}` trick in `Users.jsx` can stay: it is harmless, and
`resetData` already clears the list on act-as.

## PR 2: `feat/redux-admin-billing`
| Slice | Path / id | CRUD used | Extra thunks |
|---|---|---|---|
| `subscriptionPlansSlice` | `/subscription-plans`, `plan_id` | fetchAll, create, update, remove | `fetchPublicPlans()` → GET `/subscription-plans/public`, stored in `state.subscriptionPlans.publicPlans` (the landing page has no session) |
| `subscriptionsSlice` | `/subscriptions`, `subscription_id` | fetchAll | `fetchSubscriptionByOrg(orgId)` → GET `/subscriptions/by-organization/:orgId` (upsert) + selector `selectSubscriptionByOrg(state, orgId)` |
| `platformInvoicesSlice` | `/platform-invoices`, `platform_invoice_id` | fetchAll | `fetchRevenueSummary()` → GET `/platform-invoices/revenue-summary`, stored in `state.platformInvoices.revenueSummary` |

Pages:
- `admin/Plans.jsx`: plans + subscriptions (subscriber counts become a
  `createSelector`). The toggle-active PATCH is just `updatePlan`.
- `admin/Revenue.jsx`: `fetchRevenueSummary`, then read `revenueSummary`.
- `landing/Pricing.jsx`: `fetchPublicPlans`.
- `finance/Subscription.jsx`: `fetchSubscriptionByOrg(orgId)`,
  `fetchPlatformInvoices()`, `fetchUsers()`, `fetchCampuses()`,
  `fetchOrganizationSavings({ orgId, from, to })` (Person 1's, already
  there) → `selectOrganizationSavings(state, orgId)`.

## PR 3: `feat/redux-audits`
| Slice | Path / id | Extra thunks |
|---|---|---|
| `auditRequestsSlice` | `/audit-requests`, `request_id` | `decideAuditRequest({ id, kind: "approve" \| "deny", body })` → PATCH `/audit-requests/:id/:kind`, upsert. Approval creates an org + admin, so then dispatch `fetchOrganizations({force:true})` and `fetchUsers({force:true})`. |
| `energyAuditsSlice` | `/energy-audits`, `audit_id` | `requestAudit(note)` POST `/energy-audits/request`; `addFinding({ auditId, body })` POST `/:id/findings`; `updateFinding({ auditId, findingId, changes })` PATCH `/:id/findings/:findingId`; `submitProposal({ auditId, body })` POST `/:id/proposal`; `answerProposal({ auditId, action, note })` PATCH `/:id/proposal/{accept\|request-changes\|decline}`. Notes/status changes are plain `updateEnergyAudit({ id, changes })`. |

If a findings or proposal endpoint answers with the whole audit, upsert it. If
it answers with only the finding, `fetchEnergyAudit(auditId)` (fetchOne)
afterwards. Check the response in the Network tab and write down in the slice
header which case applies.

After `answerProposal(accept)`, also dispatch `fetchSubscriptions({force:true})`
and `fetchOrganizations({force:true})`: accepting creates a subscription and
activates the organisation.

Pages: `admin/Registrations.jsx`, `admin/Proposals.jsx`, `auditor/Overview.jsx`
(+ `overview/*`), `auditor/Audits.jsx` + `audits/FindingModal`, `NotesCard`,
`ProposalCard`, `StatusCard`.
Engagement lists, counts and "outstanding" tables become selectors in
`energyAuditsSlice` (move the logic from `auditor/auditorUtils.js` and
`overview/impact.js` there, or call those helpers inside `createSelector`).

## PR 4: `feat/redux-notifications` (after `feat/auto-dispatch` merges)
| Slice | Path / id | Extra thunks |
|---|---|---|
| `notificationsSlice` | `/notifications`, `notification_id`, `sortComparer` newest first | `markAllNotificationsRead()` PATCH `/notifications/read-all` → set every `is_read: true` in the reducer |

- `layout/NotificationBell.jsx`: `setInterval(() => dispatch(fetchNotifications({ force: true })), 30000)`.
  Unread count = `selectUnreadCount` selector. Keep `open` / `fresh` as local UI state.
- `technician-jr/DispatchInbox.jsx` reads the same slice. Tell Person 1 the
  selector names.

## Acceptance checks (with the backend running)
- Super Admin: users list, add / edit / delete / bulk import, act-as and back;
  organisations CRUD; plans CRUD + toggle; revenue; registrations approve / deny;
  proposals request + answer.
- Organization Admin: own users only; bulk import.
- Auditor: overview, audits, findings add / edit, proposal submit; infrastructure
  CRUD for campus / building / department / meter.
- Landing pricing loads while signed out.
- `grep -rn "api/client" src/pages/admin src/pages/auditor src/pages/landing src/layout/NotificationBell.jsx` → nothing.
