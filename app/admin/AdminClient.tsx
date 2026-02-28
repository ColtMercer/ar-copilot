"use client";

import { useEffect, useState } from "react";

type Signup = {
  id: string;
  email: string;
  name: string | null;
  invoice_volume: string | null;
  current_tool: string | null;
  pain: string | null;
  source: string | null;
  created_at: string;
};

type Invoice = {
  id: string;
  client_id: string | null;
  invoice_number: string | null;
  description: string | null;
  currency: string;
  amount_cents: number;
  status: string;
  due_date: string;
  created_at: string;
};

type Client = {
  id: string;
  name: string;
  primary_contact_email: string | null;
  created_at: string;
};

function fmt$(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

export default function AdminClient() {
  const [tab, setTab] = useState<"waitlist" | "invoices" | "clients">("waitlist");
  const [signups, setSignups] = useState<Signup[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);

  useEffect(() => {
    fetch("/api/waitlist?detail=1").then(r => r.json()).then(d => setSignups(d.signups || []));
    fetch("/api/invoices").then(r => r.json()).then(d => setInvoices(d.invoices || []));
    fetch("/api/clients").then(r => r.json()).then(d => setClients(d.clients || []));
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0b1220",
      color: "rgba(255,255,255,.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
      padding: 24,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>🎼 AR Copilot — Admin</h1>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.5)", fontSize: 14 }}>Internal dashboard</p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/" style={{ ...btnStyle, textDecoration: "none" }}>Landing</a>
            <a href="/dashboard" style={{ ...btnStyle, textDecoration: "none" }}>Dashboard</a>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <StatCard label="Waitlist Signups" value={String(signups.length)} />
          <StatCard label="Invoices" value={String(invoices.length)} />
          <StatCard label="Clients" value={String(clients.length)} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["waitlist", "invoices", "clients"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              ...pillStyle,
              background: tab === t ? "rgba(124,92,255,.3)" : "rgba(255,255,255,.06)",
              borderColor: tab === t ? "rgba(124,92,255,.6)" : "rgba(255,255,255,.14)",
            }}>{t.charAt(0).toUpperCase() + t.slice(1)} ({t === "waitlist" ? signups.length : t === "invoices" ? invoices.length : clients.length})</button>
          ))}
        </div>

        {/* Tables */}
        <div style={{ border: "1px solid rgba(255,255,255,.14)", borderRadius: 16, overflow: "hidden" }}>
          {tab === "waitlist" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,.04)", textAlign: "left" }}>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Volume</th>
                  <th style={thStyle}>Current Tool</th>
                  <th style={thStyle}>Pain Point</th>
                  <th style={thStyle}>Signed Up</th>
                </tr>
              </thead>
              <tbody>
                {signups.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,.4)" }}>
                    No signups yet. Share the landing page to start collecting leads.
                  </td></tr>
                )}
                {signups.map(s => (
                  <tr key={s.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td style={tdStyle}><strong>{s.email}</strong></td>
                    <td style={tdStyle}>{s.name || "—"}</td>
                    <td style={tdStyle}>{s.invoice_volume || "—"}</td>
                    <td style={tdStyle}>{s.current_tool || "—"}</td>
                    <td style={{ ...tdStyle, maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.pain || "—"}</td>
                    <td style={tdStyle}>{new Date(s.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "invoices" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,.04)", textAlign: "left" }}>
                  <th style={thStyle}>Invoice #</th>
                  <th style={thStyle}>Amount</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Due Date</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,.4)" }}>No invoices yet.</td></tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td style={tdStyle}>{inv.invoice_number || "—"}</td>
                    <td style={tdStyle}>{fmt$(inv.amount_cents, inv.currency)}</td>
                    <td style={tdStyle}>{inv.status}</td>
                    <td style={tdStyle}>{inv.due_date}</td>
                    <td style={tdStyle}>{new Date(inv.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {tab === "clients" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,.04)", textAlign: "left" }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Created</th>
                </tr>
              </thead>
              <tbody>
                {clients.length === 0 && (
                  <tr><td colSpan={3} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,.4)" }}>No clients yet.</td></tr>
                )}
                {clients.map(c => (
                  <tr key={c.id} style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
                    <td style={tdStyle}><strong>{c.name}</strong></td>
                    <td style={tdStyle}>{c.primary_contact_email || "—"}</td>
                    <td style={tdStyle}>{new Date(c.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: "1px solid rgba(255,255,255,.14)",
      background: "rgba(255,255,255,.04)",
      borderRadius: 16, padding: 16,
    }}>
      <div style={{ fontSize: 13, color: "rgba(255,255,255,.5)", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.92)", fontWeight: 600, cursor: "pointer", fontSize: 14,
  display: "inline-flex", alignItems: "center",
};
const pillStyle: React.CSSProperties = {
  padding: "6px 12px", borderRadius: 99, border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)", color: "rgba(255,255,255,.8)", cursor: "pointer", fontSize: 13,
};
const thStyle: React.CSSProperties = { padding: "10px 12px", color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px" };
