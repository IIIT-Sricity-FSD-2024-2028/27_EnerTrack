/**
 * InfrastructureManager — Campus → Building → Department → Meter.
 *
 * Ported from front-end/js/system_admin/modules/infrastructureManager.js.
 *
 * Shared by two pages:
 *
 *   <InfrastructureManager orgId={audit.organization_id} />   auditor
 *   <InfrastructureManager />                                 admin
 *
 * With an orgId it only shows that one client's records, and everything it
 * creates belongs to that client — a Certified Energy Auditor has no
 * organisation of their own for the backend to scope by. Without one it
 * shows whatever the backend returns, plus an Organisation filter for a
 * Super Admin (an Organization Admin only ever sees their own organisation).
 *
 * `onChange` (optional) is called after every save or delete, so the page
 * around it can refresh anything that depends on buildings or meters.
 */
import { useEffect, useState } from "react";
import api from "../../../api/client";
import { useAuth } from "../../../auth/useAuth";
import Modal from "../../technician/components/Modal";
import ToastStack from "../../technician/components/ToastStack";
import { useToast } from "../../technician/components/useToast";

import CampusPanel from "./CampusPanel";
import BuildingPanel from "./BuildingPanel";
import MeterPanel from "./MeterPanel";
import CampusModal from "./CampusModal";
import BuildingModal from "./BuildingModal";
import DepartmentModal from "./DepartmentModal";
import MeterModal from "./MeterModal";
import UploadReadingsModal from "./UploadReadingsModal";
import { API_PATH } from "./infraConstants";

import "../../../styles/shared/infrastructure_shared.css";

// Same key the old admin page used, so a saved filter carries over.
const ORG_FILTER_KEY = "admin_infraOrgFilter";

function loadOrgFilter() {
  try {
    return localStorage.getItem(ORG_FILTER_KEY) || "";
  } catch {
    return "";
  }
}

/**
 * Gets all four lists (and the organisation names). Only fetches — it
 * does not touch React state, so it lives outside the component.
 */
async function fetchInfrastructure(orgId) {
  const [campuses, buildings, departments, meters, orgs] = await Promise.all([
    api.get("/campus"),
    api.get("/buildings"),
    api.get("/departments"),
    api.get("/meters"),
    api.get("/organizations").catch(() => []),
  ]);

  /** Keep only this client's records when an orgId is given. */
  function forOrg(list) {
    if (!orgId) {
      return list || [];
    }
    return (list || []).filter((r) => r.organization_id === orgId);
  }

  return {
    campuses: forOrg(campuses),
    buildings: forOrg(buildings),
    departments: forOrg(departments),
    meters: forOrg(meters),
    orgs: orgs || [],
  };
}

export default function InfrastructureManager({ orgId, onChange }) {
  const { toasts, showToast } = useToast();
  const { role } = useAuth();
  // Only EnerTrack staff see more than one organisation, so only they need
  // to filter by it. Gating the filter itself (not just the dropdown) also
  // stops a value saved during a Super Admin session hiding an Org Admin's
  // campuses after "Act as".
  const canFilterOrgs = !orgId && role === "Super Admin";

  const [campuses, setCampuses] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [meters, setMeters] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedCampusId, setSelectedCampusId] = useState(null);
  const [selectedBuildingId, setSelectedBuildingId] = useState(null);
  const [orgFilter, setOrgFilter] = useState(loadOrgFilter);

  // Which popup is open, e.g. { kind: "building", item: null } to add a
  // building, { kind: "meter", item: meter } to edit one, or
  // { kind: "delete", type: "campus", item: campus }. null = none.
  const [popup, setPopup] = useState(null);

  function loadData() {
    return fetchInfrastructure(orgId)
      .then((data) => {
        setError("");
        setCampuses(data.campuses);
        setBuildings(data.buildings);
        setDepartments(data.departments);
        setMeters(data.meters);
        setOrgs(data.orgs);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }

  // Load once when the manager opens. A different orgId never reaches a
  // manager that is already open: the Audits page gives each client its
  // own manager with key={organization_id}.
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** After any save or delete: close the popup and reload everything. */
  function afterChange() {
    setPopup(null);
    loadData();
    if (onChange) {
      onChange();
    }
  }

  function handleOrgFilterChange(value) {
    setOrgFilter(value);
    try {
      localStorage.setItem(ORG_FILTER_KEY, value);
    } catch {
      // Storage blocked: the filter just will not be remembered.
    }
    // The old selection may belong to another organisation.
    setSelectedCampusId(null);
    setSelectedBuildingId(null);
  }

  function selectCampus(id) {
    setSelectedCampusId(id);
    setSelectedBuildingId(null);
  }

  function orgName(id) {
    if (!id) {
      return "EnerTrack (staff)";
    }
    const org = orgs.find((o) => o.organization_id === id);
    if (org) {
      return org.name;
    }
    return id;
  }

  // ── Delete ───────────────────────────────────────────
  function idOf(type, item) {
    if (type === "campus") return item.campus_id;
    if (type === "building") return item.building_id;
    if (type === "department") return item.department_id;
    return item.meter_id;
  }

  function handleDelete() {
    const { type, item } = popup;
    api
      .delete(API_PATH[type] + "/" + idOf(type, item))
      .then(() => {
        showToast("Deleted.", "success");
        afterChange();
      })
      .catch((err) => {
        showToast(err.message, "error");
      });
  }

  /** "2 building(s), 1 department(s), 3 meter(s) will also be removed." */
  function deleteNote(type, item) {
    if (type === "campus") {
      const ids = buildings
        .filter((b) => b.campus_id === item.campus_id)
        .map((b) => b.building_id);
      const deptCount = departments.filter((d) =>
        ids.includes(d.building_id),
      ).length;
      const meterCount = meters.filter((m) =>
        ids.includes(m.building_id),
      ).length;
      return (
        ids.length +
        " building(s), " +
        deptCount +
        " department(s), " +
        meterCount +
        " meter(s) will also be removed."
      );
    }
    if (type === "building") {
      const deptCount = departments.filter(
        (d) => d.building_id === item.building_id,
      ).length;
      const meterCount = meters.filter(
        (m) => m.building_id === item.building_id,
      ).length;
      return (
        deptCount +
        " department(s) and " +
        meterCount +
        " meter(s) will also be removed."
      );
    }
    return "";
  }

  // ── What is selected ─────────────────────────────────
  // Only a Super Admin on the admin page filters by organisation; the
  // auditor page is already limited to one.
  let visibleCampuses = campuses;
  if (canFilterOrgs && orgFilter) {
    visibleCampuses = campuses.filter((c) => c.organization_id === orgFilter);
  }

  // The chosen campus if it is still there, else the first one.
  let campus = visibleCampuses.find((c) => c.campus_id === selectedCampusId);
  if (!campus) {
    campus = visibleCampuses[0] || null;
  }

  let campusBuildings = [];
  if (campus) {
    campusBuildings = buildings.filter((b) => b.campus_id === campus.campus_id);
  }

  // The chosen building if it is in this campus, else the first one.
  let building = campusBuildings.find(
    (b) => b.building_id === selectedBuildingId,
  );
  if (!building) {
    building = campusBuildings[0] || null;
  }

  let buildingMeters = [];
  if (building) {
    buildingMeters = meters.filter(
      (m) => m.building_id === building.building_id,
    );
  }

  // ── Render ───────────────────────────────────────────
  if (loading) {
    return <p className="muted">Loading…</p>;
  }
  if (error) {
    return (
      <div>
        <p className="muted">Could not load infrastructure: {error}</p>
        <button type="button" className="btn-dark" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="infra-layout">
      <CampusPanel
        campuses={visibleCampuses}
        buildings={buildings}
        selectedId={campus ? campus.campus_id : null}
        onSelect={selectCampus}
        onEdit={(kind, item) => setPopup({ kind: kind, item: item })}
        onDelete={(type, item) => setPopup({ kind: "delete", type, item })}
        orgName={orgName}
        showOrgFilter={canFilterOrgs}
        orgs={orgs}
        orgFilter={orgFilter}
        onOrgFilterChange={handleOrgFilterChange}
      />

      <div className="infra-bottom">
        <BuildingPanel
          campus={campus}
          buildings={campusBuildings}
          departments={departments}
          meters={meters}
          selectedId={building ? building.building_id : null}
          onSelect={setSelectedBuildingId}
          onEdit={(kind, item) => setPopup({ kind: kind, item: item })}
          onDelete={(type, item) => setPopup({ kind: "delete", type, item })}
        />
        <MeterPanel
          building={building}
          meters={buildingMeters}
          onEdit={(kind, item) => setPopup({ kind: kind, item: item })}
          onDelete={(type, item) => setPopup({ kind: "delete", type, item })}
          onUpload={() => setPopup({ kind: "upload" })}
        />
      </div>

      {/* ── Popups: at most one is open ── */}

      {popup && popup.kind === "campus" && (
        <CampusModal
          campus={popup.item}
          buildings={buildings}
          orgId={orgId}
          onSaved={(saved) => {
            // Select a newly added campus so its panels show straight away.
            if (!popup.item && saved) {
              selectCampus(saved.campus_id);
            }
            afterChange();
          }}
          onClose={() => setPopup(null)}
          showToast={showToast}
        />
      )}

      {popup && popup.kind === "building" && (
        <BuildingModal
          building={popup.item}
          campuses={visibleCampuses}
          buildings={buildings}
          departments={departments}
          selectedCampusId={campus ? campus.campus_id : null}
          orgId={orgId}
          onSaved={(saved) => {
            if (!popup.item && saved) {
              setSelectedBuildingId(saved.building_id);
            }
            afterChange();
          }}
          onClose={() => setPopup(null)}
          showToast={showToast}
        />
      )}

      {popup && popup.kind === "department" && (
        <DepartmentModal
          department={popup.item}
          buildings={campusBuildings}
          departments={departments}
          selectedBuildingId={building ? building.building_id : null}
          orgId={orgId}
          onSaved={afterChange}
          onClose={() => setPopup(null)}
          showToast={showToast}
        />
      )}

      {popup && popup.kind === "meter" && (
        <MeterModal
          meter={popup.item}
          buildingId={building ? building.building_id : null}
          allMeters={meters}
          orgId={orgId}
          onSaved={afterChange}
          onClose={() => setPopup(null)}
          showToast={showToast}
        />
      )}

      {popup && popup.kind === "upload" && (
        <UploadReadingsModal
          onClose={() => setPopup(null)}
          showToast={showToast}
        />
      )}

      {popup && popup.kind === "delete" && (
        <Modal
          title={"Delete " + popup.type}
          confirmLabel="Delete"
          danger={true}
          onConfirm={handleDelete}
          onCancel={() => setPopup(null)}
        >
          <p>
            Delete <strong>{popup.item.name || popup.item.meter_code}</strong>?
          </p>
          <p className="delete-note">{deleteNote(popup.type, popup.item)}</p>
        </Modal>
      )}

      <ToastStack toasts={toasts} />
    </section>
  );
}
