/**
 * SubscriptionPage — /finance/subscription (was finance_subscription.html).
 *
 * Read-only view of what the organisation pays EnerTrack and what it has
 * saved. (Not the same as Utility Costs, which is the electricity bill.)
 * Four cards: plan, usage against allowances, savings, and invoices.
 */
import { useEffect, useState } from "react";
import api from "../../api/client";
import { useAuth } from "../../auth/useAuth";
import FinanceLayout from "./components/FinanceLayout";
import overviewCss from "../../styles/finance-analyst/finance_overview.css?inline";
import sharedCss from "../../styles/finance-analyst/finance_shared.css?inline";
import subscriptionCss from "../../styles/finance-analyst/finance_subscription.css?inline";

const ALLOWED = ["Economic Buyer", "Financial Analyst", "Organization Admin", "Super Admin"];

/** Rolling window the savings card compares over. */
const SAVINGS_FROM = "2026-03";
const SAVINGS_TO = "2026-08";

/* ── formatting helpers ── */
const money = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const num = (value) => new Intl.NumberFormat("en-IN").format(Math.round(Number(value || 0)));
function date(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function monthName(value) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return value ?? "—";
  const [y, m] = value.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}

/* ── the four cards ── */

function PlanCard({ subscription }) {
  const p = subscription.plan || {};
  return (
    <div className="sub-card">
      <div className="sub-card-head">
        <div>
          <h2>{p.name ?? "Your plan"}</h2>
          <p>{p.tagline ?? ""}</p>
        </div>
        <span className={`sub-badge ${subscription.status}`}>{subscription.status}</span>
      </div>
      <div className="sub-grid">
        <div>
          <span className="sub-k">Monthly fee</span>
          <span className="sub-v">{money(p.base_monthly_fee)}</span>
          <span className="sub-n">Covers everything up to your allowances</span>
        </div>
        <div>
          <span className="sub-k">Included staff</span>
          <span className="sub-v">{num(p.included_seats)} seats</span>
          <span className="sub-n">Then {money(p.price_per_extra_seat)} per extra staff account</span>
        </div>
        <div>
          <span className="sub-k">Campuses</span>
          <span className="sub-v">{p.max_campuses === null ? "Unlimited" : num(p.max_campuses)}</span>
          <span className="sub-n">Included in this tier</span>
        </div>
        <div>
          <span className="sub-k">Renews</span>
          <span className="sub-v">{date(subscription.renews_on)}</span>
          <span className="sub-n">Billed {subscription.billing_cycle}</span>
        </div>
      </div>
      {(p.features || []).length > 0 && (
        <ul className="sub-features">
          {p.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UsageCard({ subscription, staffCount, campusCount, visitorCount }) {
  const p = subscription.plan || {};
  const included = p.included_seats ?? 0;
  const over = Math.max(0, staffCount - included);
  const seatPct = included > 0 ? Math.min(100, (staffCount / included) * 100) : 0;
  const seatColour = over ? "#b42318" : seatPct >= 80 ? "#b45309" : "#15803d";
  const campusPct = p.max_campuses ? Math.min(100, (campusCount / p.max_campuses) * 100) : 8;

  return (
    <div className="sub-card">
      <h2>Your usage this month</h2>
      <p>What your bill is calculated from.</p>

      <div className="usage-row">
        <div className="usage-label">
          Staff accounts
          <small>{staffCount} of {included} included</small>
        </div>
        <div className="usage-track">
          <div className="usage-fill" style={{ width: `${seatPct}%`, background: seatColour }} />
        </div>
        <div className="usage-value">{over > 0 ? `${over} over` : `${included - staffCount} spare`}</div>
      </div>

      <div className="usage-row">
        <div className="usage-label">
          Campuses
          <small>{campusCount} of {p.max_campuses === null ? "unlimited" : p.max_campuses}</small>
        </div>
        <div className="usage-track">
          <div className="usage-fill" style={{ width: `${campusPct}%`, background: "#1e3a5f" }} />
        </div>
        <div className="usage-value">{campusCount}</div>
      </div>

      <table className="sub-table" style={{ marginTop: 20 }}>
        <tbody>
          <tr>
            <td>{p.name ?? "Tier"} monthly fee</td>
            <td className="r">{money(p.base_monthly_fee)}</td>
          </tr>
          {over > 0 && (
            <tr>
              <td>{over} additional staff seat{over === 1 ? "" : "s"} × {money(p.price_per_extra_seat)}</td>
              <td className="r">{money(over * p.price_per_extra_seat)}</td>
            </tr>
          )}
          <tr className="usage-total">
            <td>Before GST</td>
            <td className="r">{money((p.base_monthly_fee || 0) + over * (p.price_per_extra_seat || 0))}</td>
          </tr>
        </tbody>
      </table>

      <p className="claim-note">
        Your {visitorCount} Campus Visitor account{visitorCount === 1 ? "" : "s"}{" "}
        {visitorCount === 1 ? "does" : "do"} not count towards a seat. Anyone on campus can report a
        fault without adding to your bill — the people who spot problems first should never be a cost.
      </p>
    </div>
  );
}

function SavingsCard({ savings, invoices }) {
  const paid = invoices.filter((i) => i.status !== "draft").reduce((sum, i) => sum + i.total, 0);

  if (!savings || !savings.has_comparison) {
    return (
      <div className="sub-card">
        <h2>What you have saved</h2>
        <p>
          Not enough history yet to compare against the same months last year. This fills in once a
          full year of readings is on file.
        </p>
      </div>
    );
  }

  const improved = savings.saved_kwh > 0;
  return (
    <div className={improved ? "sub-card sub-card-good" : "sub-card"}>
      <h2>What you have saved</h2>
      <p>
        {monthName(savings.from)} to {monthName(savings.to)}, against the same months a year earlier.
        Comparing like months with like cancels the seasons, so what is left is the change your own
        team made.
      </p>
      <div className="sub-grid" style={{ marginTop: 16 }}>
        <div>
          <span className="sub-k">A year ago</span>
          <span className="sub-v">{num(savings.kwh_year_ago)} kWh</span>
          <span className="sub-n">Same months, {Number(savings.from.slice(0, 4)) - 1}</span>
        </div>
        <div>
          <span className="sub-k">This year</span>
          <span className="sub-v">{num(savings.kwh)} kWh</span>
          <span className="sub-n">{savings.months_compared} months measured</span>
        </div>
        <div>
          <span className="sub-k">Change</span>
          <span className={improved ? "sub-v pos" : "sub-v"}>{savings.change_pct}%</span>
          <span className="sub-n">
            {num(Math.abs(savings.saved_co2_kg))} kg CO₂ {improved ? "avoided" : "added"}
          </span>
        </div>
        <div>
          <span className="sub-k">{improved ? "Worth to you" : "Additional cost"}</span>
          <span className={improved ? "sub-v pos" : "sub-v"}>{money(Math.abs(savings.saved_amount))}</span>
          <span className="sub-n">At your own tariff</span>
        </div>
      </div>
      {improved ? (
        <p className="claim-note">
          You have paid EnerTrack <strong>{money(paid)}</strong> in total and saved{" "}
          <strong>{money(savings.saved_amount)}</strong> in energy over these months. We charge a
          subscription, not a share of your savings — every rupee of that is yours.
        </p>
      ) : (
        <p className="claim-note">
          Consumption is up on last year. Your audit recommendations are under Recommendations, and
          your account contact can walk through what is driving it.
        </p>
      )}
    </div>
  );
}

function InvoicesCard({ invoices }) {
  const rows = [...invoices].sort((a, b) => b.period.localeCompare(a.period));
  return (
    <div className="sub-card">
      <h2>Invoices from EnerTrack</h2>
      <p>Not to be confused with your utility bills, which are under Utility Costs.</p>
      <table className="sub-table">
        <thead>
          <tr>
            <th>Period</th>
            <th>What for</th>
            <th className="r">Before GST</th>
            <th className="r">GST</th>
            <th className="r">Total</th>
            <th>Status</th>
            <th>Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan="7" className="empty">No invoices yet.</td>
            </tr>
          ) : (
            rows.map((inv, index) => (
              <tr key={inv.platform_invoice_id || inv.id || index}>
                <td>{monthName(inv.period)}</td>
                <td className="n">
                  {(inv.line_items || []).map((l, i) => (
                    <div key={i}>{l.description} — {money(l.amount)}</div>
                  ))}
                </td>
                <td className="r">{money(inv.subtotal)}</td>
                <td className="r">{money(inv.tax_amount)}</td>
                <td className="r"><strong>{money(inv.total)}</strong></td>
                <td><span className={`sub-badge ${inv.status}`}>{inv.status}</span></td>
                <td>{date(inv.due_on)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ── the page ── */

export default function SubscriptionPage() {
  const { user } = useAuth();
  // status: "loading" | "error" | "ready"
  const [state, setState] = useState({ status: "loading" });
  const orgId = user.organization_id;

  useEffect(() => {
    if (!orgId) return; // EnerTrack staff have no organisation → nothing to load

    let cancelled = false; // ignore the result if the user leaves the page first
    async function load() {
      try {
        const subscription = await api.get(`/subscriptions/by-organization/${orgId}`);
        const [invoices, users, campuses, savings] = await Promise.all([
          api.get("/platform-invoices").catch(() => []),
          api.get("/users").catch(() => []),
          api.get("/campus").catch(() => []),
          api.get(`/organizations/${orgId}/savings?from=${SAVINGS_FROM}&to=${SAVINGS_TO}`).catch(() => null),
        ]);
        if (cancelled) return;
        const orgUsers = (Array.isArray(users) ? users : []).filter((u) => u.organization_id === orgId);
        setState({
          status: "ready",
          subscription,
          savings,
          invoices: Array.isArray(invoices) ? invoices : [],
          // Every user except a Campus Visitor takes a seat — the rule the backend bills on.
          staffCount: orgUsers.filter((u) => u.role !== "Campus Visitor").length,
          visitorCount: orgUsers.filter((u) => u.role === "Campus Visitor").length,
          campusCount: (Array.isArray(campuses) ? campuses : []).filter((c) => c.organization_id === orgId).length,
        });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error.message });
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  let body;
  if (!ALLOWED.includes(user.role)) {
    body = (
      <div className="sub-card">
        <h2>No access</h2>
        <p>Only a Financial Analyst or Organization Admin can view the subscription.</p>
      </div>
    );
  } else if (!orgId) {
    body = (
      <div className="sub-card">
        <h2>No organisation</h2>
        <p>This account belongs to EnerTrack rather than to a client, so it has no subscription of its own.</p>
      </div>
    );
  } else if (state.status === "loading") {
    body = <div className="sub" style={{ padding: "24px 0" }}>Loading your subscription…</div>;
  } else if (state.status === "error") {
    body = (
      <div className="sub-card">
        <h2>No active subscription</h2>
        <p>{state.message}</p>
      </div>
    );
  } else {
    body = (
      <>
        <PlanCard subscription={state.subscription} />
        <UsageCard
          subscription={state.subscription}
          staffCount={state.staffCount}
          campusCount={state.campusCount}
          visitorCount={state.visitorCount}
        />
        <SavingsCard savings={state.savings} invoices={state.invoices} />
        <InvoicesCard invoices={state.invoices} />
      </>
    );
  }

  return (
    <FinanceLayout styles={[overviewCss, sharedCss, subscriptionCss]}>
      <h1 className="welcome">Your EnerTrack subscription</h1>
      <div className="sub">
        What your organisation pays EnerTrack, and what it has saved. This is separate from Utility
        Costs, which is what you pay your electricity supplier.
      </div>
      <section aria-live="polite">{body}</section>
    </FinanceLayout>
  );
}
