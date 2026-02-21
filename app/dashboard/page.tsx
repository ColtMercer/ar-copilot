"use client";

import { useEffect, useState, useCallback } from "react";

type Invoice = {
  id: string;
  client_id: string | null;
  invoice_number: string | null;
  description: string | null;
  currency: string;
  amount_cents: number;
  issue_date: string | null;
  due_date: string;
  paid_date: string | null;
  status: string;
  last_followup_at: string | null;
  last_followup_stage: string | null;
  created_at: string;
  updated_at: string;
};

type Client = {
  id: string;
  name: string;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
};

function fmt$(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

function daysOverdue(dueDate: string) {
  const now = new Date();
  const due = new Date(dueDate + "T00:00:00");
  return Math.floor((now.getTime() - due.getTime()) / 86400000);
}

function stageBadge(days: number) {
  if (days < 0) return { label: "Due soon", color: "#7c5cff" };
  if (days <= 3) return { label: "1-3 days", color: "#ffcc00" };
  if (days <= 10) return { label: "7+ days", color: "#ff9500" };
  if (days <= 17) return { label: "14+ days", color: "#ff453a" };
  return { label: "Final notice", color: "#ff2d55" };
}

export default function Dashboard() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const [invRes, cliRes] = await Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
    ]);
    setInvoices(invRes.invoices || []);
    const map: Record<string, Client> = {};
    for (const c of cliRes.clients || []) map[c.id] = c;
    setClients(map);
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = invoices.filter((i) => i.status === "open");
  const overdue = open.filter((i) => daysOverdue(i.due_date) > 0);
  const needFollowUp = overdue.filter((i) => {
    if (!i.last_followup_at) return true;
    const daysSince = Math.floor((Date.now() - new Date(i.last_followup_at).getTime()) / 86400000);
    return daysSince >= 3;
  });

  const openTotal = open.reduce((s, i) => s + i.amount_cents, 0);
  const overdueTotal = overdue.reduce((s, i) => s + i.amount_cents, 0);

  const filtered = filter === "all" ? invoices
    : filter === "open" ? open
    : filter === "overdue" ? overdue
    : filter === "chase" ? needFollowUp
    : invoices.filter((i) => i.status === filter);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1220",
      color: "rgba(255,255,255,.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      padding: "24px",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>AR Copilot Dashboard</h1>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.6)", fontSize: 14 }}>Today&apos;s chase list & invoice tracker</p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setShowAdd(!showAdd)} style={btnStyle}>{showAdd ? "Cancel" : "+ Add Invoice"}</button>
            <a href="/" style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>← Home</a>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <KPI label="Open" value={fmt$(openTotal)} sub={`${open.length} invoices`} />
          <KPI label="Overdue" value={fmt$(overdueTotal)} sub={`${overdue.length} invoices`} color="#ff453a" />
          <KPI label="Need follow-up today" value={String(needFollowUp.length)} sub="based on cadence rules" color="#ffcc00" />
        </div>

        {showAdd && <AddInvoiceForm clients={clients} onDone={() => { setShowAdd(false); load(); }} />}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["chase", `Chase list (${needFollowUp.length})`],
            ["open", "Open"],
            ["overdue", "Overdue"],
            ["paid", "Paid"],
            ["disputed", "Disputed"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)}
              style={{
                ...pillStyle,
                background: filter === key ? "rgba(124,92,255,.3)" : "rgba(255,255,255,.06)",
                borderColor: filter === key ? "rgba(124,92,255,.6)" : "rgba(255,255,255,.14)",
              }}>{label}</button>
          ))}
        </div>

        {/* Table */}
        <div style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.04)", textAlign: "left" }}>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Invoice #</th>
                <th style={thStyle}>Amount</th>
                <th style={thStyle}>Due</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Days Overdue</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,.4)" }}>
                  No invoices yet. Add one to get started.
                </td></tr>
              )}
              {filtered.map((inv) => {
                const days = daysOverdue(inv.due_date);
                const badge = stageBadge(days);
                const client = inv.client_id ? clients[inv.client_id] : null;
                return (
                  <tr key={inv.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td style={tdStyle}>{client?.name || "—"}</td>
                    <td style={tdStyle}>{inv.invoice_number || "—"}</td>
                    <td style={tdStyle}>{fmt$(inv.amount_cents, inv.currency)}</td>
                    <td style={tdStyle}>{inv.due_date}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 99, fontSize: 12,
                        background: inv.status === "paid" ? "rgba(48,209,88,.2)" : inv.status === "open" ? "rgba(124,92,255,.2)" : "rgba(255,69,58,.2)",
                        color: inv.status === "paid" ? "#30d158" : inv.status === "open" ? "#7c5cff" : "#ff453a",
                      }}>{inv.status}</span>
                    </td>
                    <td style={tdStyle}>
                      {inv.status === "open" && days > 0 ? (
                        <span style={{ color: badge.color, fontWeight: 600 }}>{days}d — {badge.label}</span>
                      ) : inv.status === "open" && days <= 0 ? (
                        <span style={{ color: "rgba(255,255,255,.4)" }}>Due in {Math.abs(days)}d</span>
                      ) : "—"}
                    </td>
                    <td style={tdStyle}>
                      {inv.status === "open" && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button onClick={async () => {
                            await fetch(`/api/invoices`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: inv.id, status: "paid", paid_date: new Date().toISOString().slice(0, 10) }) });
                            load();
                          }} style={{ ...smallBtn, background: "rgba(48,209,88,.15)", color: "#30d158" }}>Mark Paid</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,.14)",
      background: "rgba(255,255,255,.04)",
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || "rgba(255,255,255,.92)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.4)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function AddInvoiceForm({ clients, onDone }: { clients: Record<string, Client>; onDone: () => void }) {
  const [form, setForm] = useState({ client_id: "", invoice_number: "", amount: "", due_date: "", description: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: form.client_id || undefined,
        invoice_number: form.invoice_number || undefined,
        description: form.description || undefined,
        amount_cents: Math.round(parseFloat(form.amount || "0") * 100),
        due_date: form.due_date,
      }),
    });
    onDone();
  };

  return (
    <form onSubmit={submit} style={{
      border: "1px solid rgba(124,92,255,.3)", borderRadius: 16, padding: 20,
      background: "rgba(124,92,255,.06)", marginBottom: 20,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
    }}>
      <div>
        <label style={labelStyle}>Client</label>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={inputStyle}>
          <option value="">Select...</option>
          {Object.values(clients).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Invoice #</label>
        <input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} style={inputStyle} placeholder="INV-001" />
      </div>
      <div>
        <label style={labelStyle}>Amount ($)</label>
        <input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle} placeholder="1500.00" required />
      </div>
      <div>
        <label style={labelStyle}>Due Date</label>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={inputStyle} required />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={inputStyle} placeholder="Web redesign" />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button type="submit" style={{ ...btnStyle, background: "linear-gradient(135deg, rgba(124,92,255,.95), rgba(24,214,255,.72))" }}>Add Invoice</button>
      </div>
    </form>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.92)", fontWeight: 600, cursor: "pointer", fontSize: 14,
};
const pillStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 99, border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 13,
};
const thStyle: React.CSSProperties = { padding: "10px 12px", color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px" };
const smallBtn: React.CSSProperties = { padding: "4px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(0,0,0,.26)", color: "rgba(255,255,255,.92)", outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,.5)", display: "block", marginBottom: 4 };
