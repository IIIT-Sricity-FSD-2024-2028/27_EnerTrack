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
import serviceRequestsReducer, {
  confirmFixed,
  fetchCampusIssues,
  fetchMyServiceRequests,
  plusOneServiceRequest,
  selectCampusIssues,
  selectMyServiceRequests,
  serviceCatalogueReducer,
  stillBroken,
  submitServiceReport,
} from "./serviceRequestsSlice";

function createTestStore() {
  return configureStore({
    reducer: combineReducers({
      serviceRequests: serviceRequestsReducer,
      serviceCatalogue: serviceCatalogueReducer,
    }),
  });
}

describe("serviceRequestsSlice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates both selectMyServiceRequests and selectCampusIssues when an entity changes", async () => {
    const store = createTestStore();
    const ticket = {
      id: "sr-1",
      status: "Reported",
      title: "Lights – Flickering",
      location: "Block A, floor 1",
      mine: false,
      can_respond: false,
    };

    api.get.mockResolvedValueOnce([ticket]);
    await store.dispatch(fetchCampusIssues());

    api.get.mockResolvedValueOnce([{ ...ticket, id: "sr-2", mine: true }]);
    await store.dispatch(fetchMyServiceRequests());

    expect(selectCampusIssues(store.getState()).map((t) => t.mine)).toEqual([false]);
    expect(selectMyServiceRequests(store.getState()).map((t) => t.id)).toEqual(["sr-2"]);

    // +1 on sr-1 updates entities in place and adds sr-1 to mineIds
    api.post.mockResolvedValueOnce({ ...ticket, mine: true });
    await store.dispatch(plusOneServiceRequest("sr-1"));

    expect(selectCampusIssues(store.getState())[0].mine).toBe(true);
    expect(selectMyServiceRequests(store.getState()).map((t) => t.id)).toEqual([
      "sr-2",
      "sr-1",
    ]);

    // confirmFixed updates the shared entity
    api.post.mockResolvedValueOnce({ ...ticket, mine: true, status: "Fixed", can_respond: false });
    await store.dispatch(confirmFixed("sr-1"));

    expect(selectCampusIssues(store.getState())[0].status).toBe("Fixed");
    expect(
      selectMyServiceRequests(store.getState()).find((t) => t.id === "sr-1").status,
    ).toBe("Fixed");
  });

  it("submitServiceReport preserves duplicate-found responses without mutating mineIds", async () => {
    const store = createTestStore();
    const coveredResponse = {
      outcome: "covered",
      covers: {
        id: "sr-cover",
        status: "Assigned",
        title: "AC – Not cooling",
        location: "Block B, whole floor",
        mine: false,
      },
    };
    api.post.mockResolvedValueOnce(coveredResponse);

    const res = await store.dispatch(submitServiceReport({ building_id: "b1" })).unwrap();

    expect(res).toEqual(coveredResponse);
    expect(selectMyServiceRequests(store.getState())).toEqual([]);
  });

  it("submitServiceReport upserts created ticket and adds to mineIds", async () => {
    const store = createTestStore();
    const createdResponse = {
      outcome: "created",
      ticket: {
        id: "sr-new",
        status: "Reported",
        title: "Tap – Leaking",
        location: "Block A, floor 2",
        mine: true,
      },
    };
    api.post.mockResolvedValueOnce(createdResponse);

    const res = await store.dispatch(submitServiceReport({ building_id: "b1" })).unwrap();

    expect(res).toEqual(createdResponse);
    expect(selectMyServiceRequests(store.getState()).map((t) => t.id)).toEqual([
      "sr-new",
    ]);
  });

  it("stillBroken upserts new ticket and marks old ticket can_respond: false", async () => {
    const store = createTestStore();
    api.get.mockResolvedValueOnce([
      {
        id: "sr-old",
        status: "Fixed",
        title: "Lights – Off",
        location: "Block A, floor 1",
        mine: true,
        can_respond: true,
      },
    ]);
    await store.dispatch(fetchMyServiceRequests());

    api.post.mockResolvedValueOnce({
      outcome: "created",
      ticket: {
        id: "sr-reopened",
        status: "Reported",
        title: "Lights – Off",
        location: "Block A, floor 1",
        mine: true,
        can_respond: false,
      },
    });
    await store.dispatch(stillBroken({ id: "sr-old", reason: "Still flickering" }));

    const mine = selectMyServiceRequests(store.getState());
    expect(mine.find((t) => t.id === "sr-old").can_respond).toBe(false);
    expect(mine.find((t) => t.id === "sr-reopened").status).toBe("Reported");
  });
});
