/**
 * loadState.js: the loading fields every data slice carries, and the
 * reducer cases that keep them right. Used by createCrudSlice and
 * createResourceSlice; slices never set these fields by hand.
 *
 *   status      "idle"      nothing loaded yet (also after sign-out)
 *               "loading"   first load running, no data to show yet
 *               "succeeded" data is there (stays so while it refreshes)
 *               "failed"    first load failed, no data to show
 *   refreshing  true while a reload runs on top of data already shown
 *   error       message of the last failed load, or null
 *
 * So a page shows a spinner only on `status === "loading"`, and a 30-second
 * poll never blanks a list that is already on screen.
 */

export const loadInitial = { status: "idle", refreshing: false, error: null };

/**
 * Thunk `condition`: skip a load that is not needed.
 *   fetchX()                 loads once; later calls do nothing
 *   fetchX({ force: true })  always reloads (polling, Refresh, after a change)
 */
export function loadCondition(name) {
  return (arg, { getState }) => {
    if (arg?.force) return true;
    const { status, refreshing } = getState()[name];
    return !(status === "loading" || refreshing || status === "succeeded");
  };
}

/** Adds pending / fulfilled / rejected cases for a load thunk. */
export function addLoadCases(builder, thunk, onFulfilled) {
  builder
    .addCase(thunk.pending, (state) => {
      if (state.status === "succeeded") state.refreshing = true;
      else state.status = "loading";
    })
    .addCase(thunk.fulfilled, (state, action) => {
      onFulfilled(state, action);
      state.status = "succeeded";
      state.refreshing = false;
      state.error = null;
    })
    .addCase(thunk.rejected, (state, { error, meta }) => {
      if (meta.condition) return; // skipped, not failed
      state.refreshing = false;
      state.error = error.message;
      if (state.status !== "succeeded") state.status = "failed";
    });
}
