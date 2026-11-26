import { combineReducers, configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/client", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    upload: vi.fn(),
    getBlobUrl: vi.fn(),
  },
}));

import api from "../../api/client";
import authReducer from "./authSlice";
import workOrdersReducer from "./workOrdersSlice";
import wastageReportsReducer, {
  normalizeWastageReport,
  raiseWorkOrderFromWastage,
  selectArchivedWastageReports,
  selectMyWastageReports,
  selectWastageAuditQueue,
  selectWastageReviewQueue,
  updateWastageReport,
} from "./wastageReportsSlice";

function createTestStore(preloadedWastage = [], user = { user_id: "u1", name: "Alice" }) {
  const entities = {};
  const ids = [];
  preloadedWastage.forEach((row) => {
    entities[row.wastage_report_id] = row;
    ids.push(row.wastage_report_id);
  });

  return configureStore({
    reducer: combineReducers({
      auth: authReducer,
      wastageReports: wastageReportsReducer,
      workOrders: workOrdersReducer,
    }),
    preloadedState: {
      auth: { user, impersonator: null },
      wastageReports: {
        ids,
        entities,
        status: "succeeded",
        refreshing: false,
        error: null,
      },
    },
  });
}

describe("wastageReportsSlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normalizeWastageReport maps backend row and resolves reporterName", () => {
    const raw = {
      wastage_report_id: "wr-1",
      type: "Energy",
      status: "Open",
      reporter_id: "u1",
      created_at: "2026-10-01T10:00:00.000Z",
      source_request_ids: ["sr-1"],
      details: {
        specificData: { building: "Block A" },
        priority: "High",
        comments: [{ author: "Alice", text: "Check lights" }],
      },
    };

    const mine = normalizeWastageReport(raw, { user_id: "u1", name: "Alice" });
    expect(mine.id).toBe("wr-1");
    expect(mine.reporterName).toBe("Alice");
    expect(mine.specificData).toEqual({ building: "Block A" });
    expect(mine.priority).toBe("High");
    expect(mine.sourceRequestIds).toEqual(["sr-1"]);

    const other = normalizeWastageReport(raw, { user_id: "u2", name: "Bob" });
    expect(other.reporterName).toBe("Unknown");
  });

  it("selectors partition reports into my, audit queue, review queue, and archive", () => {
    const rows = [
      {
        wastage_report_id: "wr-open",
        type: "Energy",
        status: "Open",
        reporter_id: "u1",
        created_at: "2026-10-01T10:00:00.000Z",
        details: {},
      },
      {
        wastage_report_id: "wr-fin-1",
        type: "Water",
        status: "Forwarded to Finance",
        reporter_id: "u2",
        created_at: "2026-10-02T10:00:00.000Z",
        details: {},
      },
      {
        wastage_report_id: "wr-fin-2",
        type: "Food",
        status: "Cost Impact Added",
        reporter_id: "u2",
        created_at: "2026-10-03T10:00:00.000Z",
        details: {},
      },
      {
        wastage_report_id: "wr-closed",
        type: "Energy",
        status: "Closed",
        reporter_id: "u1",
        created_at: "2026-10-04T10:00:00.000Z",
        details: { closedAt: "2026-10-05T10:00:00.000Z" },
      },
      {
        wastage_report_id: "wr-dismissed",
        type: "Emissions",
        status: "Dismissed",
        reporter_id: "u2",
        created_at: "2026-10-04T11:00:00.000Z",
        details: { dismissedAt: "2026-10-04T12:00:00.000Z" },
      },
    ];

    const store = createTestStore(rows);
    const state = store.getState();

    expect(selectMyWastageReports(state).map((r) => r.id)).toEqual([
      "wr-open",
      "wr-closed",
    ]);

    expect(selectWastageAuditQueue(state).map((r) => r.id)).toEqual([
      "wr-fin-2",
      "wr-fin-1",
      "wr-open",
    ]);

    expect(selectWastageReviewQueue(state).map((r) => r.id)).toEqual([
      "wr-fin-2",
      "wr-fin-1",
    ]);

    expect(selectArchivedWastageReports(state).map((r) => r.id)).toEqual([
      "wr-closed",
      "wr-dismissed",
    ]);
  });

  it("updateWastageReport merges details without dropping existing keys", async () => {
    const initial = {
      wastage_report_id: "wr-1",
      type: "Energy",
      status: "Forwarded to Finance",
      reporter_id: "u1",
      created_at: "2026-10-01T10:00:00.000Z",
      details: {
        remedy: { type: "spend", description: "Install LEDs", estimate: 5000 },
        specificData: { building: "Block A" },
      },
    };
    const store = createTestStore([initial]);
    const normalized = normalizeWastageReport(initial, { user_id: "u1", name: "Alice" });

    const serverSaved = {
      ...initial,
      status: "Cost Impact Added",
      details: {
        ...initial.details,
        costImpact: { estimatedLoss: 1000, remediationCost: 5000, projectedSavings: 2500 },
      },
    };
    api.patch.mockResolvedValueOnce(serverSaved);

    await store.dispatch(
      updateWastageReport({
        report: normalized,
        changes: {
          status: "Cost Impact Added",
          costImpact: { estimatedLoss: 1000, remediationCost: 5000, projectedSavings: 2500 },
        },
      }),
    );

    expect(api.patch).toHaveBeenCalledWith("/wastage-reports/wr-1", {
      status: "Cost Impact Added",
      details: {
        remedy: { type: "spend", description: "Install LEDs", estimate: 5000 },
        specificData: { building: "Block A" },
        costImpact: { estimatedLoss: 1000, remediationCost: 5000, projectedSavings: 2500 },
      },
    });
    expect(store.getState().wastageReports.entities["wr-1"].status).toBe("Cost Impact Added");
  });

  it("raiseWorkOrderFromWastage posts work-order and refreshes workOrders", async () => {
    const initial = {
      wastage_report_id: "wr-1",
      type: "Water",
      status: "Target Set",
      reporter_id: "u1",
      details: {},
    };
    const store = createTestStore([initial]);

    api.post.mockResolvedValueOnce({ ...initial, details: { workOrderId: "wo-1" } });
    api.get.mockResolvedValueOnce([{ work_order_id: "wo-1", status: "open" }]);

    await store.dispatch(raiseWorkOrderFromWastage("wr-1"));

    expect(api.post).toHaveBeenCalledWith("/wastage-reports/wr-1/work-order", {});
    expect(api.get).toHaveBeenCalledWith("/work-orders");
    expect(store.getState().workOrders.ids).toEqual(["wo-1"]);
  });
});
