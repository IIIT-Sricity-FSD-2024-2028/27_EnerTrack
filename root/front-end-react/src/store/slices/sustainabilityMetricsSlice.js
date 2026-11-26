import { createSlice } from "@reduxjs/toolkit";
import api from "../../api/client";
import { apiThunk } from "../apiThunk";
import { loadInitial } from "../loadState";

const PATH = "/sustainability-metrics/summary";
const selectMetrics = (state) => state.sustainabilityMetrics;
const queryKey = ({ from, to, granularity }) => `${from}|${to}|${granularity}`;

/** Load the Overview totals once, with an explicit refresh option. */
export const fetchMetricsSummary = apiThunk(
  "sustainabilityMetrics/fetchSummary",
  async () => ({ data: await api.get(PATH), updatedAt: Date.now() }),
  {
    condition: (arg, { getState }) => {
      const { status, refreshing } = selectMetrics(getState()).summaryStatus;
      return status !== "loading" && !refreshing && (arg?.force || status !== "succeeded");
    },
  },
);

/** Cache each chart range independently, including its building breakdown. */
export const fetchMetricsSeries = apiThunk(
  "sustainabilityMetrics/fetchSeries",
  async ({ from, to, granularity }) => {
    const query = new URLSearchParams({ from, to, granularity, groupBy: "building" });
    return { data: await api.get(`${PATH}?${query}`), updatedAt: Date.now() };
  },
  {
    condition: (config, { getState }) => {
      const load = selectMetricsSeriesStatus(getState(), config);
      return load.status !== "loading" && !load.refreshing &&
        (config.force || load.status !== "succeeded");
    },
  },
);

const metrics = createSlice({
  name: "sustainabilityMetrics",
  initialState: { summary: null, summaryStatus: loadInitial, series: {}, seriesStatus: {} },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMetricsSummary.pending, (state, { meta }) => {
        state.summaryStatus = startLoad(state.summaryStatus, meta.requestId);
      })
      .addCase(fetchMetricsSummary.fulfilled, (state, { payload, meta }) => {
        if (state.summaryStatus.requestId !== meta.requestId) return;
        state.summary = payload.data;
        state.summaryStatus = { ...loadInitial, status: "succeeded", updatedAt: payload.updatedAt };
      })
      .addCase(fetchMetricsSummary.rejected, (state, { error, meta }) => {
        if (state.summaryStatus.requestId !== meta.requestId) return;
        state.summaryStatus = failLoad(state.summaryStatus, error);
      })
      .addCase(fetchMetricsSeries.pending, (state, { meta }) => {
        const key = queryKey(meta.arg);
        state.seriesStatus[key] = startLoad(state.seriesStatus[key] ?? loadInitial, meta.requestId);
      })
      .addCase(fetchMetricsSeries.fulfilled, (state, { payload, meta }) => {
        const key = queryKey(meta.arg);
        if (state.seriesStatus[key]?.requestId !== meta.requestId) return;
        state.series[key] = payload.data;
        state.seriesStatus[key] = { ...loadInitial, status: "succeeded", updatedAt: payload.updatedAt };
      })
      .addCase(fetchMetricsSeries.rejected, (state, { error, meta }) => {
        const key = queryKey(meta.arg);
        if (state.seriesStatus[key]?.requestId !== meta.requestId) return;
        state.seriesStatus[key] = failLoad(state.seriesStatus[key], error);
      });
  },
});

/** Keep the last successful result visible while refreshing a cached query. */
function startLoad(previous, requestId) {
  const refreshing = previous.status === "succeeded";
  return { ...previous, status: refreshing ? "succeeded" : "loading", refreshing, error: null, requestId };
}

/** Track the error without discarding a previously cached response. */
function failLoad(previous, error) {
  return {
    ...previous,
    status: previous.refreshing ? "succeeded" : "failed",
    refreshing: false,
    requestId: null,
    error: error.message,
  };
}

export const selectMetricsSummary = (state) => selectMetrics(state).summary;
export const selectMetricsSummaryStatus = (state) => selectMetrics(state).summaryStatus;
export const selectMetricsSeries = (state, config) => selectMetrics(state).series[queryKey(config)];
export const selectMetricsSeriesStatus = (state, config) =>
  selectMetrics(state).seriesStatus[queryKey(config)] ?? loadInitial;

export default metrics.reducer;
