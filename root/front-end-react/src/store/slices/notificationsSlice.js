/**
 * notificationsSlice.js: /notifications (id: notification_id).
 * Owner: Person 2. Person 1 created the base because the technician inbox
 * needed it first; Person 2 adds markAllNotificationsRead and moves
 * layout/NotificationBell.jsx onto it.
 *
 * The backend sends oldest first; selectAllNotifications is newest first.
 */
import { createSelector } from "@reduxjs/toolkit";
import { createCrudSlice } from "../createCrudSlice";

const notifications = createCrudSlice({
  name: "notifications",
  path: "/notifications",
  idKey: "notification_id",
});

export const {
  fetchAll: fetchNotifications,
  update: updateNotification,
  remove: removeNotification,
} = notifications.thunks;

export const {
  selectStatus: selectNotificationsStatus,
  selectError: selectNotificationsError,
} = notifications.selectors;

/** Newest first. */
export const selectAllNotifications = createSelector(
  [notifications.selectors.selectAll],
  (list) => [...list].reverse(),
);

export const selectUnreadCount = createSelector(
  [notifications.selectors.selectAll],
  (list) => list.filter((n) => !n.is_read).length,
);

export default notifications.reducer;
