/**
 * NewWorkOrderForm — "New Work Order Setup": pick a type, fill in the
 * asset, priority, technician and whether a cost estimate is needed.
 *
 * It owns the fields while they are being filled in and hands the result to
 * the page with onCreate(values). onCreate returns true if the work order
 * was created, and only then is the form cleared.
 *
 * `request` is the service request being turned into a work order, or null.
 * The page renders this with key={request id or "blank"}, so clicking
 * "Create Work Order" on a request builds a fresh form pre-filled from it.
 *
 * Ported from wireTypeSelector() / triageRequest() / wireNewWOForm() in
 * js/technician/workOrdersPage.js.
 */
import { useState } from "react";
import { assignableUsers } from "../techUtils";

const TYPES = [
  {
    value: "emergency",
    title: "Emergency",
    text: "Immediate response for critical equipment issues and urgent repairs.",
  },
  {
    value: "scheduled",
    title: "Scheduled",
    text: "Planned maintenance window with assigned technician and review notes.",
  },
  {
    value: "preventive",
    title: "Preventive",
    text: "Routine follow-up work to prevent repeat alerts and reduce downtime.",
  },
];

/** What to put in the Asset box when coming from a service request. */
function assetFromRequest(request) {
  if (!request) {
    return "";
  }
  return request.description || request.issue_type || request.category || "";
}

/** The priority to start with: the request's, if it is one we offer. */
function priorityFromRequest(request) {
  if (!request || !request.priority) {
    return "medium";
  }
  const p = request.priority.toLowerCase();
  if (p === "critical" || p === "high") {
    return "high";
  }
  if (p === "low") {
    return "low";
  }
  return "medium";
}

export default function NewWorkOrderForm({ users, request, busy, onCreate }) {
  const [type, setType] = useState("scheduled");
  const [asset, setAsset] = useState(assetFromRequest(request));
  const [priority, setPriority] = useState(priorityFromRequest(request));
  const [techId, setTechId] = useState("");
  const [estimateRequired, setEstimateRequired] = useState("no");

  const complete = asset.trim() !== "" && techId !== "";

  async function handleSubmit(event) {
    // A <form> submit normally reloads the whole page. Stop that — we send
    // the data ourselves.
    event.preventDefault();
    if (!complete) {
      return;
    }

    const ok = await onCreate({
      type: type,
      asset: asset.trim(),
      priority: priority,
      techId: techId,
      estimateRequired: estimateRequired === "yes",
    });

    if (ok) {
      setType("scheduled");
      setAsset("");
      setPriority("medium");
      setTechId("");
      setEstimateRequired("no");
    }
  }

  return (
    <div className="card">
      <h2>New Work Order Setup</h2>
      {request && (
        <p className="sub mt-10">
          Creating a work order for service request{" "}
          <strong>{request.service_request_id}</strong>.
        </p>
      )}

      {/* Type picker: three clickable cards, one active. */}
      <div className="type-selector mt-14 mb-16">
        {TYPES.map((option) => {
          let optionClass = "option wo-type-option";
          if (option.value === type) {
            optionClass += " active";
          }
          return (
            <div
              key={option.value}
              className={optionClass}
              onClick={() => setType(option.value)}
            >
              <h3>{option.title}</h3>
              <p>{option.text}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid2">
          <div className="card no-margin">
            <div className="field">
              <label htmlFor="woInputAsset">Selected Asset</label>
              <input
                id="woInputAsset"
                type="text"
                placeholder="e.g. Compressor C-12"
                value={asset}
                onChange={(event) => setAsset(event.target.value)}
              />
            </div>
          </div>

          <div className="card no-margin">
            <div className="field">
              <label htmlFor="woInputPriority">Assign Priority</label>
              <select
                id="woInputPriority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="woInputTech">Assign Technician</label>
              <select
                id="woInputTech"
                value={techId}
                onChange={(event) => setTechId(event.target.value)}
              >
                <option value="">— Select —</option>
                {assignableUsers(users).map((tech) => (
                  <option key={tech.user_id} value={tech.user_id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="woInputEstimate">Cost Estimate Required</label>
              <select
                id="woInputEstimate"
                value={estimateRequired}
                onChange={(event) => setEstimateRequired(event.target.value)}
              >
                <option value="no">Not Required</option>
                <option value="yes">Yes, Needs Estimate</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-actions">
          {!complete && (
            <small className="sub">
              Fill in the asset and pick a technician.
            </small>
          )}
          <button
            type="submit"
            className="btn btn-dark"
            disabled={busy || !complete}
          >
            Create Work Order
          </button>
        </div>
      </form>
    </div>
  );
}
