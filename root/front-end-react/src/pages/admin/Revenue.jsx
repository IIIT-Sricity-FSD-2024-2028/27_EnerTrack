/**
 * Revenue — /admin/revenue. Super Admin only, read-only.
 * Replaces js/system_admin/modules/revenueManager.js.
 *
 * Shows GET /platform-invoices/revenue-summary: the platform's own numbers
 * across every client. The most useful column is seat usage: a client at or
 * over its seat allowance is already paying extra, or about to, which makes
 * it the next sales conversation.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import AdminPage from "./AdminPage";
import { formatCurrency } from "./adminHelpers";

// The two rows of four numbers use the same grid
const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "16px",
};

export default function Revenue() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load the summary when the page opens. If it fails, summary stays null
  // and the page says so (as the original did).
  useEffect(() => {
    api
      .get("/platform-invoices/revenue-summary")
      .then((data) => setSummary(data))
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminPage
      subtitle="Platform revenue across every client. MRR reflects live contracts and current staff counts."
      requiredRole="Super Admin"
      loading={loading}
      toasts={[]}
    >
      {summary ? <RevenueReport summary={summary} /> : <NoSummary />}
    </AdminPage>
  );
}

/* ── Shown when the summary could not be loaded ── */

function NoSummary() {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Revenue</h2>
          <p>Could not load the platform revenue summary.</p>
        </div>
      </div>
      <div className="table-card">
        <div className="empty-state">
          This view aggregates across every tenant, so it is available to
          EnerTrack staff only. Sign in as Super Admin.
        </div>
      </div>
    </section>
  );
}

/* ── The report: tiles, collections, per organisation, per tier ── */

function RevenueReport({ summary }) {
  const collections = summary.collections;
  // Clients at 80% of their seat allowance or more
  const nearLimit = summary.by_organization.filter(
    (o) => o.seat_utilisation_pct !== null && o.seat_utilisation_pct >= 80,
  ).length;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <h2>Revenue</h2>
          <p>
            Across every client. MRR is computed from live contracts and current
            staff counts, so it is what the platform will bill next month rather
            than what it billed last.
          </p>
        </div>
      </div>

      {/* Headline numbers */}
      <div
        className="table-card"
        style={{ padding: "18px", marginBottom: "16px" }}
      >
        <div style={gridStyle}>
          <Tile
            label="Monthly recurring revenue"
            value={formatCurrency(summary.mrr)}
          />
          <Tile label="Annual run rate" value={formatCurrency(summary.arr)} />
          <Tile
            label="Billed to date"
            value={formatCurrency(summary.billed_to_date)}
          />
          <Tile
            label="At or near seat limit"
            value={String(nearLimit)}
            note="Clients at 80% of their allowance or above"
          />
        </div>
      </div>

      {/* Collections */}
      <div
        className="table-card"
        style={{ padding: "18px", marginBottom: "16px" }}
      >
        <h3 style={{ fontSize: "15px", marginBottom: "12px" }}>Collections</h3>
        <div style={gridStyle}>
          <Tile label="Paid" value={formatCurrency(collections.paid)} />
          <Tile label="Issued" value={formatCurrency(collections.issued)} />
          <Tile label="Overdue" value={formatCurrency(collections.overdue)} />
          <Tile label="Draft" value={formatCurrency(collections.draft)} />
        </div>
        {collections.overdue > 0 && (
          <p className="muted-cell" style={{ marginTop: "12px" }}>
            {formatCurrency(collections.overdue)} is past its due date.
          </p>
        )}
      </div>

      {/* Per organisation */}
      <div className="table-card" style={{ marginBottom: "16px" }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Status</th>
                <th>Tier</th>
                <th>Staff seats used</th>
                <th>Campuses</th>
                <th>Per month</th>
                <th>Billed to date</th>
                <th>Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_organization.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">No client organisations.</div>
                  </td>
                </tr>
              ) : (
                summary.by_organization.map((o) => (
                  <tr key={o.organization_id}>
                    <td>
                      <strong>{o.organization_name}</strong>
                    </td>
                    <td>
                      <span className={`badge ${o.status}`}>{o.status}</span>
                    </td>
                    <td>{o.plan_name ?? "—"}</td>
                    <td style={{ minWidth: "170px" }}>
                      <SeatBar org={o} />
                    </td>
                    <td>
                      {o.campuses_used}
                      {o.max_campuses === null
                        ? " / ∞"
                        : ` / ${o.max_campuses}`}
                    </td>
                    <td>{formatCurrency(o.monthly)}</td>
                    <td>{formatCurrency(o.billed_to_date)}</td>
                    <td>{formatCurrency(o.outstanding)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Per tier */}
      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Tier</th>
                <th>Clients</th>
                <th>MRR</th>
                <th>Annualised</th>
              </tr>
            </thead>
            <tbody>
              {summary.by_plan.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state">No tiers defined.</div>
                  </td>
                </tr>
              ) : (
                summary.by_plan.map((p) => (
                  <tr key={p.plan_id}>
                    <td>
                      <strong>{p.plan_name}</strong>
                    </td>
                    <td>{p.subscribers}</td>
                    <td>{formatCurrency(p.mrr)}</td>
                    <td>{formatCurrency(p.mrr * 12)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/* ── One number with its small grey label (and an optional note) ── */

function Tile({ label, value, note }) {
  return (
    <div>
      <div
        className="muted-cell"
        style={{
          textTransform: "uppercase",
          letterSpacing: ".04em",
          fontSize: "11px",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "24px", fontWeight: 700, marginTop: "6px" }}>
        {value}
      </div>
      {note && (
        <div className="muted-cell" style={{ marginTop: "4px" }}>
          {note}
        </div>
      )}
    </div>
  );
}

/* ── How full a client's seat allowance is ──
   Green below 80%, amber from 80%, red once they are over (paying extra). */

function SeatBar({ org }) {
  const pct = org.seat_utilisation_pct;
  if (pct === null) {
    return <span className="muted-cell">No contract</span>;
  }

  const over = org.seats_over_allowance > 0;
  let colour = "#15803d";
  if (pct >= 80) colour = "#b45309";
  if (over) colour = "#b42318";

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <div
          style={{
            flex: 1,
            height: "8px",
            background: "#eef1f4",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${Math.min(100, pct)}%`,
              height: "100%",
              background: colour,
            }}
          ></div>
        </div>
        <span style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
          {org.billable_staff}/{org.included_seats}
        </span>
      </div>
      {over && (
        <div className="muted-cell">
          {org.seats_over_allowance} seat(s) billed extra
        </div>
      )}
    </>
  );
}
