/**
 * notificationsSlice.js: the signed-in person's notifications (id:
 * notification_id). Owner: Person 2. Person 1 created the base for the
 * technician inbox (pages/technician-jr/DispatchInbox.jsx); the bell
 * (layout/NotificationBell.jsx) reads the same list.
 *
 * The list comes from GET /notifications/mine, not GET /notifications:
 * /mine is always the signed-in person's own, while for an Organization
 * Admin (and a Super Admin, who counts as one on the server)
 * /notifications returns everyone's in the organisation, which would put
 * other people's notifications in their bell. Marking read uses the
 * matching PATCH /notifications/mine/read.
 *
 *   fetchNotifications()        cached like any fetchAll; { force: true }
 *                               reloads (the bell polls with it)
 *   markAllNotificationsRead()  marks every row read at once, then saves; if
 *                               the save fails the list is re-read
 *   selectAllNotifications      newest first
 *   selectUnreadCount           how many are unread
 */
import { createSelector } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { createCrudSlice } from "../createCrudSlice";
import { addLoadCases, loadCondition } from "../loadState";

export const fetchNotifications = apiThunk(
  "notifications/fetchMine",
  async () => {
    const rows = await api.get("/notifications/mine");
    return Array.isArray(rows) ? rows : [];
  },
  { condition: loadCondition("notifications") },
);

export const markAllNotificationsRead = apiThunk(
  "notifications/markAllRead",
  async (_, { dispatch }) => {
    try {
      return await api.patch("/notifications/mine/read");
    } catch (err) {
      // The rows were already shown as read: put back what the server has.
      dispatch(fetchNotifications({ force: true }));
      throw err;
    }
  },
);

const notifications = createCrudSlice({
  name: "notifications",
  path: "/notifications",
  idKey: "notification_id",
  // Rows are kept in the server's order; selectAllNotifications sorts them.
  extraReducers: (builder, { adapter }) => {
    addLoadCases(builder, fetchNotifications, (state, { payload }) =>
      adapter.setAll(state, payload),
    );
    builder.addCase(markAllNotificationsRead.pending, (state) => {
      for (const id of state.ids) state.entities[id].is_read = true;
    });
  },
});

export const {
  selectStatus: selectNotificationsStatus,
  selectError: selectNotificationsError,
} = notifications.selectors;

/**
 * Newest first, by created_at (set by the server on every notification).
 * Rows created before that have none; the server lists those after the
 * dated ones in the order they were made, so between two undated rows (or
 * two made in the same millisecond) the later one in the list is the newer.
 */
export const selectAllNotifications = createSelector(
  [notifications.selectors.selectAll],
  (list) =>
    list
      .map((n, index) => ({ n, index }))
      .sort(
        (a, b) =>
          String(b.n.created_at ?? "").localeCompare(
            String(a.n.created_at ?? ""),
          ) || b.index - a.index,
      )
      .map(({ n }) => n),
);

export const selectUnreadCount = createSelector(
  [notifications.selectors.selectAll],
  (list) => list.filter((n) => !n.is_read).length,
);

export default notifications.reducer;
