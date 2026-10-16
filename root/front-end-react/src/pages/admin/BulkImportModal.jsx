/**
 * BulkImportModal — create many accounts at once (a class, a department).
 *
 * Administrators create every account, which is only workable for hundreds of
 * students and faculty if they can do it in one go. Three steps:
 *   1. paste rows or choose a .csv file    (name, email, phone, role)
 *   2. preview: every row is checked with the same rules as the single form
 *   3. result: the issued credentials, with a download for handing them out
 *
 * The server generates each password and never sends it again, so step 3 is
 * the only chance to save the credentials.
 *
 * Props:
 *   emailDomain  the organisation's required mail domain, or "" for none
 *   existing     users already in the organisation, to catch repeated emails
 *   onClose      closes the popup
 *   onDone       called once after accounts were created (reload the list)
 */
import { useRef, useState } from "react";
import api from "../../api/client";
import { emailOnDomain, validators } from "../auth/validators";
import Modal from "./Modal";
import { PLATFORM_SIDE_ROLES, TECHNICIAN_ROLES, USER_ROLES, formatLabel } from "./adminHelpers";

// Roles that need no per-person detail. Technicians need a specialization,
// which the single "Add User" form asks for.
const BULK_ROLES = USER_ROLES.filter(
  (role) =>
    role !== "Organization Admin" &&
    !PLATFORM_SIDE_ROLES.includes(role) &&
    !TECHNICIAN_ROLES.includes(role),
);
const DEFAULT_ROLE = "Campus Visitor";
const MAX_ROWS = 500;
const COLUMNS = ["name", "email", "phone", "role"];

/** Splits one CSV/TSV line, honouring "quoted, values". */
function splitLine(line, delimiter) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      cells.push(cell.trim());
      cell = "";
    } else cell += ch;
  }
  cells.push(cell.trim());
  return cells;
}

/** Text -> [{ name, email, phone, role }]. A header row is optional. */
function parseRows(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const table = lines.map((l) => splitLine(l, delimiter));

  let order = COLUMNS;
  const first = table[0].map((c) => c.toLowerCase());
  if (first.includes("email")) {
    order = first;
    table.shift();
  }
  return table.map((cells) => {
    const row = Object.fromEntries(COLUMNS.map((c) => [c, ""]));
    order.forEach((column, i) => {
      if (COLUMNS.includes(column)) row[column] = cells[i] ?? "";
    });
    return row;
  });
}

/** Adds { errors } to each row. Same rules as the single-user form. */
function checkRows(rows, emailDomain, existingEmails) {
  const seen = new Set(existingEmails);
  return rows.map((raw) => {
    const row = {
      ...raw,
      email: raw.email.trim().toLowerCase(),
      role:
        // A role can be typed as stored ("Campus Visitor") or as shown ("Occupant")
        BULK_ROLES.find((r) =>
          [r, formatLabel(r)].some((name) => name.toLowerCase() === raw.role.trim().toLowerCase()),
        ) ??
        (raw.role.trim() === "" ? DEFAULT_ROLE : raw.role.trim()),
    };
    const errors = [];
    const nameError = validators.name(row.name);
    if (nameError) errors.push(nameError);
    const emailError = emailOnDomain(row.email, emailDomain);
    if (emailError) errors.push(emailError);
    else if (seen.has(row.email)) errors.push("Email is already used.");
    const phoneError = validators.optionalPhone(row.phone);
    if (phoneError) errors.push(phoneError);
    if (!BULK_ROLES.includes(row.role))
      errors.push(`Role must be one of: ${BULK_ROLES.join(", ")}.`);
    if (!emailError) seen.add(row.email);
    return { ...row, errors };
  });
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCredentials(results) {
  const lines = [
    ["name", "email", "role", "temporary_password", "status"],
    ...results.map((r) => [
      r.name,
      r.email,
      r.role,
      r.ok ? r.password : "",
      r.ok ? "created" : r.error,
    ]),
  ].map((cells) => cells.map(csvCell).join(","));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "enertrack-credentials.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function BulkImportModal({
  emailDomain,
  existing,
  onClose,
  onDone,
}) {
  const [step, setStep] = useState("input"); // "input" | "preview" | "result"
  const [text, setText] = useState("");
  const [rows, setRows] = useState([]);
  const [results, setResults] = useState([]);
  const [problem, setProblem] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);

  const validRows = rows.filter((r) => r.errors.length === 0);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      setProblem("Choose a .csv file.");
      return;
    }
    if (file.size > 1_000_000) {
      setProblem("That file is too large (1 MB maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result || ""));
      setProblem("");
    };
    reader.readAsText(file);
  }

  function handlePreview() {
    const parsed = parseRows(text);
    if (parsed.length === 0) {
      setProblem("Add at least one row first.");
      return;
    }
    if (parsed.length > MAX_ROWS) {
      setProblem(`Import at most ${MAX_ROWS} people at a time.`);
      return;
    }
    setProblem("");
    setRows(
      checkRows(
        parsed,
        emailDomain,
        existing.map((u) => u.email.toLowerCase()),
      ),
    );
    setStep("preview");
  }

  async function handleCreate() {
    setSubmitting(true);
    setProblem("");
    try {
      const response = await api.post("/users/bulk", {
        users: validRows.map(({ name, email, phone, role }) => ({
          name,
          email,
          role,
          ...(phone.trim() ? { phone: phone.trim() } : {}),
        })),
      });
      setResults(Array.isArray(response) ? response : []);
      setStep("result");
      onDone();
    } catch (err) {
      setProblem(err.message || "Could not create the accounts.");
    } finally {
      setSubmitting(false);
    }
  }

  const created = results.filter((r) => r.ok).length;

  if (step === "result") {
    return (
      <Modal
        wide
        title="Import finished"
        confirmLabel="Download credentials"
        cancelLabel="Close"
        onConfirm={() => downloadCredentials(results)}
        onClose={onClose}
      >
        <p>
          <strong>{created}</strong> of {results.length} accounts created.
          Download the credentials now: the passwords are not shown again.
          Everyone must choose their own password at first sign-in.
        </p>
        <ResultTable results={results} />
      </Modal>
    );
  }

  if (step === "preview") {
    return (
      <Modal
        wide
        title="Check the rows"
        confirmLabel={
          submitting ? "Creating…" : `Create ${validRows.length} account(s)`
        }
        cancelLabel="Back"
        confirmDisabled={validRows.length === 0 || submitting}
        onConfirm={handleCreate}
        onClose={() => setStep("input")}
      >
        <p>
          {validRows.length} of {rows.length} rows are ready.
          {validRows.length < rows.length &&
            " Rows with problems are skipped; fix them and import again."}
        </p>
        {problem && <span className="field-error" style={{ display: "block" }}>{problem}</span>}
        <div className="table-scroll" style={{ maxHeight: "50vh" }}>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{row.name || "-"}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.phone || "-"}</td>
                  <td>{formatLabel(row.role)}</td>
                  <td style={{ color: row.errors.length ? "#b42318" : "#067647" }}>
                    {row.errors.length ? row.errors.join(" ") : "Ready"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      wide
      title="Import people"
      confirmLabel="Preview"
      onConfirm={handlePreview}
      onClose={onClose}
    >
      <p>
        One person per line: <strong>name, email, phone, role</strong>. Phone is
        optional and role defaults to {formatLabel(DEFAULT_ROLE)}. Allowed roles:{" "}
        {BULK_ROLES.map(formatLabel).join(", ")}. Add technicians one at a time (they need a
        specialization).
      </p>
      {emailDomain && (
        <p className="muted-cell">
          Every email must end in @{emailDomain}.
        </p>
      )}
      <div className="form-field full" style={{ marginTop: "12px" }}>
        <label htmlFor="bulkText">Paste rows or choose a file</label>
        <textarea
          id="bulkText"
          rows={9}
          spellCheck={false}
          placeholder={`name,email,phone,role\nAsha Rao,asha.rao@${emailDomain || "example.edu"},9876543210,Occupant`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: "13px" }}
        />
      </div>
      <div style={{ margin: "10px 0 14px" }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.tsv,.txt,text/csv"
          onChange={handleFile}
        />
      </div>
      {problem && <span className="field-error" style={{ display: "block" }}>{problem}</span>}
    </Modal>
  );
}

function ResultTable({ results }) {
  return (
    <div className="table-scroll" style={{ maxHeight: "50vh", marginTop: "12px" }}>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Temporary password</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.row}>
              <td>{r.row}</td>
              <td>{r.name}</td>
              <td>{r.email}</td>
              <td>{formatLabel(r.role)}</td>
              <td style={{ fontFamily: "ui-monospace, Consolas, monospace" }}>
                {r.ok ? r.password : "-"}
              </td>
              <td style={{ color: r.ok ? "#067647" : "#b42318" }}>
                {r.ok ? "Created" : r.error}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
