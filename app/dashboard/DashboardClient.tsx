"use client";

import { useEffect, useState, useCallback } from "react";

type DashboardProps = {
  plan: "free" | "starter" | "studio";
  planStatus: "active" | "canceled" | "past_due";
  starterPriceId: string;
  studioPriceId: string;
};

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

type ClientSettings = {
  client_id: string;
  tone: "friendly" | "neutral" | "firm";
  include_payment_methods: boolean;
  include_late_fee: boolean;
  late_fee_text: string | null;
  payment_link: string | null;
  signature_name: string | null;
  signature_company: string | null;
  signature_phone: string | null;
  signature_email: string | null;
  updated_at: string | null;
};

type ChaseItem = {
  invoice_id: string;
  client_id: string | null;
  client_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  invoice_number: string | null;
  amount_cents: number;
  currency: string;
  due_date: string;
  days_overdue: number;
  days_since_followup: number | null;
  last_followup_stage: string | null;
  recommended_stage: "pre_due" | "day_1" | "day_7" | "day_14" | "final";
  client_tone: "friendly" | "neutral" | "firm" | string;
  payment_link?: string | null;
  signature_name?: string | null;
  signature_company?: string | null;
  signature_phone?: string | null;
  signature_email?: string | null;
  include_late_fee?: boolean;
  late_fee_text?: string | null;
};

type Template = {
  id: string;
  name: string;
  tone: string;
  stage: string;
  subject: string;
  body: string;
};

type FollowupEvent = {
  id: string;
  invoice_id: string;
  channel: string;
  stage: string | null;
  subject: string | null;
  body: string | null;
  sent_at: string;
  notes: string | null;
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

function addDays(ymd: string, days: number) {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function renderTemplate(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, key) => {
    const k = String(key || "").trim();
    return vars[k] ?? "";
  });
}

function stageLabel(stage: ChaseItem["recommended_stage"]) {
  switch (stage) {
    case "pre_due":
      return "Pre-due (3 days)";
    case "day_1":
      return "1-3 days overdue";
    case "day_7":
      return "7-10 days overdue";
    case "day_14":
      return "14-17 days overdue";
    case "final":
      return "Final (21+ days)";
  }
}

function stageFromDays(days: number): ChaseItem["recommended_stage"] {
  // Mirrors the chase-list spec windows.
  if (days === -3) return "pre_due";
  if (days >= 1 && days <= 3) return "day_1";
  if (days >= 7 && days <= 10) return "day_7";
  if (days >= 14 && days <= 17) return "day_14";
  if (days >= 21) return "final";
  // Fallbacks:
  if (days < 0) return "pre_due";
  if (days < 7) return "day_1";
  if (days < 14) return "day_7";
  if (days < 21) return "day_14";
  return "final";
}

export default function DashboardClient({
  plan,
  planStatus,
  starterPriceId,
  studioPriceId,
}: DashboardProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Record<string, Client>>({});
  const [chaseList, setChaseList] = useState<ChaseItem[]>([]);
  const [billingError, setBillingError] = useState<{
    error: string;
    plan?: string;
    limit?: number;
    open_invoices?: number;
  } | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [billingBusy, setBillingBusy] = useState(false);

  // Invoice detail modal state
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
  const [activeFollowups, setActiveFollowups] = useState<FollowupEvent[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [draftStage, setDraftStage] = useState<ChaseItem["recommended_stage"]>("day_1");
  const [draftTone, setDraftTone] = useState<string>("friendly");
  const [draftSubject, setDraftSubject] = useState<string>("");
  const [draftBody, setDraftBody] = useState<string>("");

  const [activeClientSettings, setActiveClientSettings] = useState<ClientSettings | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsSavedAt, setSettingsSavedAt] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [invRes, cliRes, chaseRes] = await Promise.all([
      fetch("/api/invoices").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/chase-list").then((r) => r.json()),
    ]);
    const limitError =
      invRes?.error === "invoice_limit_exceeded"
        ? invRes
        : chaseRes?.error === "invoice_limit_exceeded"
          ? chaseRes
          : null;
    setBillingError(limitError);
    setInvoices(invRes.invoices || []);
    const map: Record<string, Client> = {};
    for (const c of cliRes.clients || []) map[c.id] = c;
    setClients(map);
    setChaseList(chaseRes.chase_list || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = invoices.filter((i) => i.status === "open");
  const overdue = open.filter((i) => daysOverdue(i.due_date) > 0);
  const needFollowUp = overdue.filter((i) => {
    if (!i.last_followup_at) return true;
    const daysSince = Math.floor((Date.now() - new Date(i.last_followup_at).getTime()) / 86400000);
    return daysSince >= 3;
  });

  const openTotal = open.reduce((s, i) => s + i.amount_cents, 0);
  const overdueTotal = overdue.reduce((s, i) => s + i.amount_cents, 0);

  const filtered =
    filter === "all"
      ? invoices
      : filter === "open"
        ? open
        : filter === "overdue"
          ? overdue
          : filter === "chase"
            ? needFollowUp
            : invoices.filter((i) => i.status === filter);

  const getTemplate = useCallback(async (stage: string, tone: string): Promise<Template | null> => {
    const url = `/api/templates?stage=${encodeURIComponent(stage)}&tone=${encodeURIComponent(tone)}`;
    const res = await fetch(url).then((r) => r.json());
    const t = (res.templates || [])[0];
    return t || null;
  }, []);

  const varsForChaseItem = useCallback((item: ChaseItem) => {
    const contactName = (item.contact_name || "").trim() || (item.client_name || "").trim() || "there";

    return {
      "client.name": (item.client_name || "").trim(),
      "client.contact_name": contactName,
      "invoice.number": (item.invoice_number || "").trim(),
      "invoice.amount": fmt$(item.amount_cents, item.currency),
      "invoice.due_date": item.due_date,
      "invoice.days_overdue": String(item.days_overdue),
      "invoice.due_date_plus_3": addDays(item.due_date, 3),
      "payment.link": (item.payment_link || "").trim(),
      "signature.name": (item.signature_name || "").trim(),
      "signature.company": (item.signature_company || "").trim(),
      "signature.phone": (item.signature_phone || "").trim(),
      "signature.email": (item.signature_email || "").trim(),
    };
  }, []);

  const varsForInvoice = useCallback(
    (inv: Invoice) => {
      const client = inv.client_id ? clients[inv.client_id] : null;
      const contactName =
        (client?.primary_contact_name || "").trim() || (client?.name || "").trim() || "there";
      const days = daysOverdue(inv.due_date);
      const s = activeClientSettings;

      return {
        "client.name": (client?.name || "").trim(),
        "client.contact_name": contactName,
        "invoice.number": (inv.invoice_number || "").trim(),
        "invoice.amount": fmt$(inv.amount_cents, inv.currency),
        "invoice.due_date": inv.due_date,
        "invoice.days_overdue": String(days),
        "invoice.due_date_plus_3": addDays(inv.due_date, 3),
        "payment.link": (s?.payment_link || "").trim(),
        "signature.name": (s?.signature_name || "").trim(),
        "signature.company": (s?.signature_company || "").trim(),
        "signature.phone": (s?.signature_phone || "").trim(),
        "signature.email": (s?.signature_email || "").trim(),
      };
    },
    [activeClientSettings, clients]
  );

  const copyEmail = useCallback(
    async (item: ChaseItem) => {
      setBusyId(item.invoice_id + ":copy");
      try {
        const template = await getTemplate(item.recommended_stage, item.client_tone || "friendly");
        if (!template) {
          alert(`No template found for stage=${item.recommended_stage} tone=${item.client_tone}`);
          return;
        }

        const vars = varsForChaseItem(item);
        const subject = renderTemplate(template.subject, vars);
        const body = renderTemplate(template.body, vars);
        const combined = `Subject: ${subject}\n\n${body}`;

        await navigator.clipboard.writeText(combined);
      } finally {
        setBusyId(null);
      }
    },
    [getTemplate, varsForChaseItem]
  );

  const markSent = useCallback(
    async (item: ChaseItem) => {
      setBusyId(item.invoice_id + ":sent");
      try {
        const template = await getTemplate(item.recommended_stage, item.client_tone || "friendly");
        const vars = varsForChaseItem(item);
        const subject = template ? renderTemplate(template.subject, vars) : null;
        const body = template ? renderTemplate(template.body, vars) : null;

        await fetch(`/api/followups`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            invoice_id: item.invoice_id,
            stage: item.recommended_stage,
            channel: "email",
            subject,
            body,
          }),
        });
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [getTemplate, load, varsForChaseItem]
  );

  const openInvoiceDetails = useCallback(
    async (inv: Invoice) => {
      setActiveInvoice(inv);
      setActiveClientSettings(null);
      setSettingsSavedAt(null);

      const days = daysOverdue(inv.due_date);
      setDraftStage(stageFromDays(days));
      setDraftTone("friendly");
      setDraftSubject("");
      setDraftBody("");
      setActiveFollowups([]);

      // Load followup timeline
      try {
        const res = await fetch(`/api/followups?invoice_id=${encodeURIComponent(inv.id)}`).then((r) => r.json());
        setActiveFollowups(res.followups || []);
      } catch {
        // leave empty
      }

      // Load client settings (default tone + signature/payment link)
      if (inv.client_id) {
        try {
          const res = await fetch(`/api/client-settings?client_id=${encodeURIComponent(inv.client_id)}`).then((r) => r.json());
          if (res?.settings) {
            setActiveClientSettings(res.settings);
            if (res.settings.tone) setDraftTone(res.settings.tone);
          }
        } catch {
          // leave empty
        }
      }
    },
    []
  );

  const closeInvoiceDetails = useCallback(() => {
    setActiveInvoice(null);
    setActiveFollowups([]);
    setActiveClientSettings(null);
    setSettingsBusy(false);
    setSettingsSavedAt(null);
    setDraftSubject("");
    setDraftBody("");
  }, []);

  const patchActiveClientSettings = useCallback((patch: Partial<ClientSettings>) => {
    setActiveClientSettings((s) => (s ? { ...s, ...patch } : s));
  }, []);

  const saveActiveClientSettings = useCallback(async () => {
    if (!activeClientSettings) return;

    setSettingsBusy(true);
    try {
      const payload = {
        client_id: activeClientSettings.client_id,
        tone: activeClientSettings.tone,
        include_payment_methods: activeClientSettings.include_payment_methods,
        include_late_fee: activeClientSettings.include_late_fee,
        late_fee_text: activeClientSettings.late_fee_text,
        payment_link: activeClientSettings.payment_link,
        signature_name: activeClientSettings.signature_name,
        signature_company: activeClientSettings.signature_company,
        signature_phone: activeClientSettings.signature_phone,
        signature_email: activeClientSettings.signature_email,
      };

      const res = await fetch("/api/client-settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (!res?.ok) {
        alert(res?.error || "Failed to save client settings");
        return;
      }

      if (res?.settings) setActiveClientSettings(res.settings);
      setSettingsSavedAt(Date.now());
    } finally {
      setSettingsBusy(false);
    }
  }, [activeClientSettings]);

  const loadDraftFromTemplate = useCallback(async () => {
    if (!activeInvoice) return;

    setDetailBusy(true);
    try {
      const template = await getTemplate(draftStage, draftTone);
      if (!template) {
        alert(`No template found for stage=${draftStage} tone=${draftTone}`);
        return;
      }

      const vars = varsForInvoice(activeInvoice);
      setDraftSubject(renderTemplate(template.subject, vars));
      setDraftBody(renderTemplate(template.body, vars));
    } finally {
      setDetailBusy(false);
    }
  }, [activeInvoice, draftStage, draftTone, getTemplate, varsForInvoice]);

  const copyDraft = useCallback(async () => {
    const combined = `Subject: ${draftSubject}\n\n${draftBody}`;
    await navigator.clipboard.writeText(combined);
  }, [draftBody, draftSubject]);

  const markDraftSent = useCallback(async () => {
    if (!activeInvoice) return;

    setDetailBusy(true);
    try {
      await fetch(`/api/followups`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoice_id: activeInvoice.id,
          stage: draftStage,
          channel: "email",
          subject: draftSubject || null,
          body: draftBody || null,
        }),
      });

      // Refresh modal timeline + dashboard.
      const res = await fetch(`/api/followups?invoice_id=${encodeURIComponent(activeInvoice.id)}`).then((r) => r.json());
      setActiveFollowups(res.followups || []);
      await load();
    } finally {
      setDetailBusy(false);
    }
  }, [activeInvoice, draftBody, draftStage, draftSubject, load]);

  const startCheckout = useCallback(async (priceId: string) => {
    if (!priceId || billingBusy) return;
    setBillingBusy(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceId }),
      });
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy]);

  const openPortal = useCallback(async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      if (res.status === 401) {
        window.location.href = "/api/auth/login";
        return;
      }
      const data = await res.json();
      if (data?.url) window.location.href = data.url;
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b1220",
        color: "rgba(255,255,255,.92)",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        padding: "24px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h1 style={{ margin: 0, fontSize: 28 }}>AR Copilot Dashboard</h1>
              <span
                style={{
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,.2)",
                  background: plan === "free" ? "rgba(255,255,255,.08)" : "rgba(124,92,255,.20)",
                  color: "rgba(255,255,255,.9)",
                  textTransform: "capitalize",
                }}
              >
                {plan} {plan !== "free" ? `(${planStatus})` : ""}
              </span>
            </div>
            <p style={{ margin: "4px 0 0", color: "rgba(255,255,255,.6)", fontSize: 14 }}>
              Today&apos;s chase list & invoice tracker
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {plan === "free" ? (
              <button onClick={() => startCheckout(starterPriceId)} style={btnStyle} disabled={billingBusy}>
                {billingBusy ? "Redirecting..." : "Upgrade"}
              </button>
            ) : (
              <button onClick={openPortal} style={btnStyle} disabled={billingBusy}>
                {billingBusy ? "Redirecting..." : "Manage subscription"}
              </button>
            )}
            <button onClick={() => { setShowAdd(!showAdd); setShowAddClient(false); setShowCsvImport(false); }} style={btnStyle}>
              {showAdd ? "Cancel" : "+ Invoice"}
            </button>
            <button onClick={() => { setShowAddClient(!showAddClient); setShowAdd(false); setShowCsvImport(false); }} style={btnStyle}>
              {showAddClient ? "Cancel" : "+ Client"}
            </button>
            <button onClick={() => { setShowCsvImport(!showCsvImport); setShowAdd(false); setShowAddClient(false); }} style={btnStyle}>
              {showCsvImport ? "Cancel" : "CSV Import"}
            </button>
            <a href="/" style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              ← Home
            </a>
            <a href="/api/auth/logout" style={{ ...btnStyle, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
              Sign out
            </a>
          </div>
        </div>

        {/* KPIs */}
        {billingError ? (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid rgba(255,69,58,.4)",
              background: "rgba(255,69,58,.12)",
              color: "rgba(255,255,255,.9)",
              fontSize: 13,
            }}
          >
            Invoice limit exceeded for the {(billingError.plan || "free")} plan ({billingError.open_invoices} open).
            Upgrade to add more.
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
          <KPI label="Open" value={fmt$(openTotal)} sub={`${open.length} invoices`} />
          <KPI label="Overdue" value={fmt$(overdueTotal)} sub={`${overdue.length} invoices`} color="#ff453a" />
          <KPI
            label="Need follow-up today"
            value={String(chaseList.length)}
            sub="based on stage windows + cadence"
            color="#ffcc00"
          />
        </div>

        {/* Chase list */}
        <div
          style={{
            border: "1px solid rgba(255,255,255,.14)",
            background: "rgba(255,255,255,.04)",
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Today’s chase list</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                Copy the suggested email, then click “Mark sent” to keep your cadence.
              </div>
            </div>
            <button
              onClick={() => load()}
              style={{
                ...smallBtn,
                background: "rgba(255,255,255,.10)",
                color: "rgba(255,255,255,.9)",
              }}
            >
              Refresh
            </button>
          </div>

          {chaseList.length === 0 ? (
            <div style={{ padding: 10, color: "rgba(255,255,255,.5)", fontSize: 13 }}>
              Nothing needs a follow-up today.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {chaseList.map((item) => (
                <div
                  key={item.invoice_id}
                  style={{
                    border: "1px solid rgba(255,255,255,.10)",
                    background: "rgba(0,0,0,.18)",
                    borderRadius: 14,
                    padding: 12,
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1fr 1fr",
                    gap: 10,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{item.client_name || "—"}</div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 2 }}>
                      Invoice {item.invoice_number || "—"} • due {item.due_date} •{" "}
                      {item.days_overdue >= 0
                        ? `${item.days_overdue}d overdue`
                        : `due in ${Math.abs(item.days_overdue)}d`}
                    </div>
                  </div>

                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>Stage</div>
                    <div style={{ fontWeight: 700 }}>{stageLabel(item.recommended_stage)}</div>
                  </div>

                  <div style={{ fontSize: 13 }}>
                    <div style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>Amount</div>
                    <div style={{ fontWeight: 700 }}>{fmt$(item.amount_cents, item.currency)}</div>
                  </div>

                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button
                      onClick={() => copyEmail(item)}
                      disabled={busyId === item.invoice_id + ":copy" || busyId === item.invoice_id + ":sent"}
                      style={{
                        ...smallBtn,
                        background: "rgba(124,92,255,.18)",
                        color: "rgba(255,255,255,.92)",
                        opacity: busyId ? 0.8 : 1,
                      }}
                    >
                      {busyId === item.invoice_id + ":copy" ? "Copying…" : "Copy email"}
                    </button>
                    <button
                      onClick={() => markSent(item)}
                      disabled={busyId === item.invoice_id + ":copy" || busyId === item.invoice_id + ":sent"}
                      style={{
                        ...smallBtn,
                        background: "rgba(48,209,88,.15)",
                        color: "#30d158",
                        opacity: busyId ? 0.8 : 1,
                      }}
                    >
                      {busyId === item.invoice_id + ":sent" ? "Saving…" : "Mark sent"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAdd && (
          <AddInvoiceForm
            clients={clients}
            onDone={() => {
              setShowAdd(false);
              load();
            }}
          />
        )}

        {showAddClient && (
          <AddClientForm
            onDone={() => {
              setShowAddClient(false);
              load();
            }}
          />
        )}

        {showCsvImport && (
          <CsvImportForm
            clients={clients}
            onDone={() => {
              setShowCsvImport(false);
              load();
            }}
          />
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[
            ["all", "All"],
            ["chase", `Chase list (legacy) (${needFollowUp.length})`],
            ["open", "Open"],
            ["overdue", "Overdue"],
            ["paid", "Paid"],
            ["disputed", "Disputed"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              style={{
                ...pillStyle,
                background: filter === key ? "rgba(124,92,255,.3)" : "rgba(255,255,255,.06)",
                borderColor: filter === key ? "rgba(124,92,255,.6)" : "rgba(255,255,255,.14)",
              }}
            >
              {label}
            </button>
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
                <tr>
                  <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "rgba(255,255,255,.4)" }}>
                    No invoices yet. Add one to get started.
                  </td>
                </tr>
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
                      <span
                        style={{
                          padding: "3px 8px",
                          borderRadius: 99,
                          fontSize: 12,
                          background:
                            inv.status === "paid"
                              ? "rgba(48,209,88,.2)"
                              : inv.status === "open"
                                ? "rgba(124,92,255,.2)"
                                : "rgba(255,69,58,.2)",
                          color: inv.status === "paid" ? "#30d158" : inv.status === "open" ? "#7c5cff" : "#ff453a",
                        }}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {inv.status === "open" && days > 0 ? (
                        <span style={{ color: badge.color, fontWeight: 600 }}>
                          {days}d — {badge.label}
                        </span>
                      ) : inv.status === "open" && days <= 0 ? (
                        <span style={{ color: "rgba(255,255,255,.4)" }}>Due in {Math.abs(days)}d</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => openInvoiceDetails(inv)}
                          style={{ ...smallBtn, background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.9)" }}
                        >
                          Details
                        </button>
                        {inv.status === "open" && (
                          <button
                            onClick={async () => {
                              await fetch(`/api/invoices`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({
                                  id: inv.id,
                                  status: "paid",
                                  paid_date: new Date().toISOString().slice(0, 10),
                                }),
                              });
                              load();
                            }}
                            style={{ ...smallBtn, background: "rgba(48,209,88,.15)", color: "#30d158" }}
                          >
                            Mark Paid
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {activeInvoice && (
        <InvoiceDetailModal
          invoice={activeInvoice}
          client={activeInvoice.client_id ? clients[activeInvoice.client_id] : null}
          clientSettings={activeClientSettings}
          settingsBusy={settingsBusy}
          settingsSavedAt={settingsSavedAt}
          onChangeClientSettings={patchActiveClientSettings}
          onSaveClientSettings={saveActiveClientSettings}
          followups={activeFollowups}
          draftStage={draftStage}
          draftTone={draftTone}
          draftSubject={draftSubject}
          draftBody={draftBody}
          busy={detailBusy}
          onClose={closeInvoiceDetails}
          onChangeStage={setDraftStage}
          onChangeTone={setDraftTone}
          onChangeSubject={setDraftSubject}
          onChangeBody={setDraftBody}
          onLoadTemplate={loadDraftFromTemplate}
          onCopy={copyDraft}
          onMarkSent={markDraftSent}
        />
      )}
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  return (
    <div
      style={{
        border: "1px solid rgba(255,255,255,.14)",
        background: "rgba(255,255,255,.04)",
        borderRadius: 16,
        padding: 16,
      }}
    >
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
    <form
      onSubmit={submit}
      style={{
        border: "1px solid rgba(124,92,255,.3)",
        borderRadius: 16,
        padding: 20,
        background: "rgba(124,92,255,.06)",
        marginBottom: 20,
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
      }}
    >
      <div>
        <label style={labelStyle}>Client</label>
        <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={inputStyle}>
          <option value="">Select...</option>
          {Object.values(clients).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label style={labelStyle}>Invoice #</label>
        <input
          value={form.invoice_number}
          onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
          style={inputStyle}
          placeholder="INV-001"
        />
      </div>
      <div>
        <label style={labelStyle}>Amount ($)</label>
        <input
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={inputStyle}
          placeholder="1500.00"
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Due Date</label>
        <input
          type="date"
          value={form.due_date}
          onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          style={inputStyle}
          required
        />
      </div>
      <div>
        <label style={labelStyle}>Description</label>
        <input
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={inputStyle}
          placeholder="Web redesign"
        />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          type="submit"
          style={{ ...btnStyle, background: "linear-gradient(135deg, rgba(124,92,255,.95), rgba(24,214,255,.72))" }}
        >
          Add Invoice
        </button>
      </div>
    </form>
  );
}

function InvoiceDetailModal(props: {
  invoice: Invoice;
  client: Client | null;
  clientSettings: ClientSettings | null;
  settingsBusy: boolean;
  settingsSavedAt: number | null;
  onChangeClientSettings: (patch: Partial<ClientSettings>) => void;
  onSaveClientSettings: () => Promise<void>;
  followups: FollowupEvent[];
  draftStage: ChaseItem["recommended_stage"];
  draftTone: string;
  draftSubject: string;
  draftBody: string;
  busy: boolean;
  onClose: () => void;
  onChangeStage: (v: ChaseItem["recommended_stage"]) => void;
  onChangeTone: (v: string) => void;
  onChangeSubject: (v: string) => void;
  onChangeBody: (v: string) => void;
  onLoadTemplate: () => Promise<void>;
  onCopy: () => Promise<void>;
  onMarkSent: () => Promise<void>;
}) {
  const inv = props.invoice;
  const client = props.client;
  const days = daysOverdue(inv.due_date);

  return (
    <div
      onClick={props.onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.55)",
        display: "grid",
        placeItems: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "calc(100vh - 40px)",
          overflow: "auto",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,.16)",
          background: "#0f1930",
          boxShadow: "0 20px 60px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ padding: 18, borderBottom: "1px solid rgba(255,255,255,.10)", display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>Invoice details</div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginTop: 4 }}>
              {client?.name || "—"} • {inv.invoice_number || "—"} • {fmt$(inv.amount_cents, inv.currency)} • due {inv.due_date}{" "}
              {inv.status === "open" ? (days >= 0 ? `• ${days}d overdue` : `• due in ${Math.abs(days)}d`) : `• ${inv.status}`}
            </div>
          </div>
          <button onClick={props.onClose} style={{ ...smallBtn, background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.9)", height: 34 }}>
            Close
          </button>
        </div>

        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {/* Composer */}
          <div style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 14, background: "rgba(255,255,255,.03)" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Compose follow-up</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <div style={labelStyle}>Stage</div>
                <select
                  value={props.draftStage}
                  onChange={(e) => props.onChangeStage(e.target.value as ChaseItem["recommended_stage"])}
                  style={inputStyle}
                  disabled={props.busy}
                >
                  <option value="pre_due">pre_due (3 days before due)</option>
                  <option value="day_1">day_1 (1-3 days overdue)</option>
                  <option value="day_7">day_7 (7-10 days overdue)</option>
                  <option value="day_14">day_14 (14-17 days overdue)</option>
                  <option value="final">final (21+ days overdue)</option>
                </select>
              </div>
              <div>
                <div style={labelStyle}>Tone</div>
                <select value={props.draftTone} onChange={(e) => props.onChangeTone(e.target.value)} style={inputStyle} disabled={props.busy}>
                  <option value="friendly">friendly</option>
                  <option value="neutral">neutral</option>
                  <option value="firm">firm</option>
                </select>
              </div>
            {props.clientSettings && (
              <div style={{ gridColumn: "1 / -1", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 10, marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>Client defaults</div>
                  {props.settingsSavedAt && (
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)" }}>
                      Saved {new Date(props.settingsSavedAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                  <div>
                    <div style={labelStyle}>Default tone</div>
                    <select
                      value={props.clientSettings.tone}
                      onChange={(e) => {
                        const tone = e.target.value as ClientSettings["tone"];
                        props.onChangeClientSettings({ tone });
                        props.onChangeTone(tone);
                      }}
                      style={inputStyle}
                      disabled={props.settingsBusy}
                    >
                      <option value="friendly">friendly</option>
                      <option value="neutral">neutral</option>
                      <option value="firm">firm</option>
                    </select>
                  </div>

                  <div>
                    <div style={labelStyle}>Payment link</div>
                    <input
                      value={props.clientSettings.payment_link || ""}
                      onChange={(e) => props.onChangeClientSettings({ payment_link: e.target.value })}
                      style={inputStyle}
                      disabled={props.settingsBusy}
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <div style={labelStyle}>Signature name</div>
                    <input
                      value={props.clientSettings.signature_name || ""}
                      onChange={(e) => props.onChangeClientSettings({ signature_name: e.target.value })}
                      style={inputStyle}
                      disabled={props.settingsBusy}
                      placeholder="Colt"
                    />
                  </div>

                  <div>
                    <div style={labelStyle}>Signature email</div>
                    <input
                      value={props.clientSettings.signature_email || ""}
                      onChange={(e) => props.onChangeClientSettings({ signature_email: e.target.value })}
                      style={inputStyle}
                      disabled={props.settingsBusy}
                      placeholder="colt@..."
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button
                    onClick={props.onSaveClientSettings}
                    disabled={props.settingsBusy || props.busy}
                    style={{ ...smallBtn, background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.92)" }}
                  >
                    {props.settingsBusy ? "Saving…" : "Save defaults"}
                  </button>
                </div>
              </div>
            )}

            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <button
                onClick={props.onLoadTemplate}
                disabled={props.busy}
                style={{ ...smallBtn, background: "rgba(124,92,255,.18)", color: "rgba(255,255,255,.92)" }}
              >
                {props.busy ? "Loading…" : "Load template"}
              </button>
              <button
                onClick={props.onCopy}
                disabled={props.busy || !props.draftSubject || !props.draftBody}
                style={{ ...smallBtn, background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.92)" }}
              >
                Copy email
              </button>
              <button
                onClick={props.onMarkSent}
                disabled={props.busy || !props.draftSubject || !props.draftBody}
                style={{ ...smallBtn, background: "rgba(48,209,88,.15)", color: "#30d158" }}
              >
                Mark sent
              </button>
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={labelStyle}>Subject</div>
              <input value={props.draftSubject} onChange={(e) => props.onChangeSubject(e.target.value)} style={inputStyle} disabled={props.busy} />
            </div>

            <div>
              <div style={labelStyle}>Body</div>
              <textarea
                value={props.draftBody}
                onChange={(e) => props.onChangeBody(e.target.value)}
                style={{ ...inputStyle, minHeight: 220, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12, lineHeight: 1.4 }}
                disabled={props.busy}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,.45)" }}>
                Tip: edit before copying. “Mark sent” saves the exact subject/body to the follow-up timeline.
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ border: "1px solid rgba(255,255,255,.10)", borderRadius: 16, padding: 14, background: "rgba(255,255,255,.03)" }}>
            <div style={{ fontWeight: 800, marginBottom: 10 }}>Follow-up timeline</div>

            {props.followups.length === 0 ? (
              <div style={{ color: "rgba(255,255,255,.55)", fontSize: 13, padding: 10 }}>
                No follow-ups logged yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {props.followups.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      border: "1px solid rgba(255,255,255,.10)",
                      borderRadius: 14,
                      padding: 12,
                      background: "rgba(0,0,0,.18)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>
                        {f.stage || "(no stage)"} • {f.channel}
                      </div>
                      <div style={{ color: "rgba(255,255,255,.45)", fontSize: 12 }}>{new Date(f.sent_at).toLocaleString()}</div>
                    </div>
                    {f.subject && (
                      <div style={{ marginTop: 6, fontSize: 13, color: "rgba(255,255,255,.8)" }}>
                        <span style={{ color: "rgba(255,255,255,.45)", marginRight: 6 }}>Subject:</span>
                        {f.subject}
                      </div>
                    )}
                    {f.body && (
                      <pre
                        style={{
                          marginTop: 8,
                          whiteSpace: "pre-wrap",
                          fontSize: 12,
                          color: "rgba(255,255,255,.72)",
                          background: "rgba(255,255,255,.04)",
                          border: "1px solid rgba(255,255,255,.08)",
                          padding: 10,
                          borderRadius: 12,
                          overflow: "hidden",
                        }}
                      >
                        {f.body}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,.45)" }}>
              {props.clientSettings
                ? "Templates in this modal use your saved signature + payment link (Client defaults)."
                : "Tip: add client defaults (signature/payment link) to avoid blank template variables."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddClientForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({ name: "", contact_name: "", contact_email: "", company_domain: "", notes: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          primary_contact_name: form.contact_name.trim() || undefined,
          primary_contact_email: form.contact_email.trim() || undefined,
          company_domain: form.company_domain.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{
      border: "1px solid rgba(24,214,255,.3)", borderRadius: 16, padding: 20,
      background: "rgba(24,214,255,.06)", marginBottom: 20,
      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
    }}>
      <div>
        <label style={labelStyle}>Company / Client Name *</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} placeholder="Acme Corp" required />
      </div>
      <div>
        <label style={labelStyle}>Contact Name</label>
        <input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} style={inputStyle} placeholder="Jane Smith" />
      </div>
      <div>
        <label style={labelStyle}>Contact Email</label>
        <input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} style={inputStyle} placeholder="jane@acme.com" />
      </div>
      <div>
        <label style={labelStyle}>Domain</label>
        <input value={form.company_domain} onChange={(e) => setForm({ ...form, company_domain: e.target.value })} style={inputStyle} placeholder="acme.com" />
      </div>
      <div>
        <label style={labelStyle}>Notes</label>
        <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={inputStyle} placeholder="Net 30, AP contact is..." />
      </div>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button type="submit" disabled={busy} style={{ ...btnStyle, background: "linear-gradient(135deg, rgba(24,214,255,.85), rgba(124,92,255,.72))" }}>
          {busy ? "Adding..." : "Add Client"}
        </button>
      </div>
    </form>
  );
}

function CsvImportForm({ clients, onDone }: { clients: Record<string, Client>; onDone: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState<Array<Record<string, string>>>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const parseCsv = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"));
    return lines.slice(1).map(line => {
      const vals = line.split(",").map(v => v.trim().replace(/^\"|\"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = vals[i] || ""; });
      return row;
    }).filter(r => r.due_date || r.amount || r.client);
  };

  const handleParse = () => {
    const rows = parseCsv(csvText);
    setPreview(rows);
    setResult(null);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setCsvText(text);
      setPreview(parseCsv(text));
      setResult(null);
    };
    reader.readAsText(file);
  };

  const doImport = async () => {
    setImporting(true);
    let created = 0;
    let errors = 0;

    // Build client name → id map
    const clientMap: Record<string, string> = {};
    for (const c of Object.values(clients)) {
      clientMap[c.name.toLowerCase()] = c.id;
    }

    for (const row of preview) {
      try {
        // Try to match client by name
        const clientName = (row.client || row.client_name || row.company || "").trim();
        let clientId = clientName ? clientMap[clientName.toLowerCase()] : undefined;

        // Auto-create client if not found
        if (clientName && !clientId) {
          const res = await fetch("/api/clients", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ name: clientName, primary_contact_email: row.email || row.contact_email || undefined }),
          }).then(r => r.json());
          if (res.ok && res.client) {
            clientId = res.client.id as string;
            clientMap[clientName.toLowerCase()] = clientId as string;
          }
        }

        const amountStr = (row.amount || row.amount_cents || "0").replace(/[$,]/g, "");
        const amountCents = row.amount_cents ? parseInt(amountStr) : Math.round(parseFloat(amountStr) * 100);

        await fetch("/api/invoices", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            client_id: clientId || undefined,
            invoice_number: row.invoice_number || row.invoice || row.number || undefined,
            description: row.description || row.desc || undefined,
            amount_cents: amountCents || 0,
            due_date: row.due_date || row.due || new Date().toISOString().slice(0, 10),
            issue_date: row.issue_date || row.issued || undefined,
          }),
        });
        created++;
      } catch {
        errors++;
      }
    }

    setResult(`Imported ${created} invoices${errors ? `, ${errors} errors` : ""}.`);
    setImporting(false);
    if (created > 0) setTimeout(() => onDone(), 1500);
  };

  return (
    <div style={{
      border: "1px solid rgba(48,209,88,.3)", borderRadius: 16, padding: 20,
      background: "rgba(48,209,88,.06)", marginBottom: 20,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>CSV Invoice Import</div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.55)", marginBottom: 12 }}>
        Expected columns: <code>client, invoice_number, amount, due_date</code> (optional: description, issue_date, email). Clients are auto-created if not found.
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <input type="file" accept=".csv,.txt" onChange={handleFile} style={{ fontSize: 13 }} />
        <span style={{ color: "rgba(255,255,255,.4)", fontSize: 12 }}>or paste below</span>
      </div>

      <textarea
        value={csvText}
        onChange={(e) => setCsvText(e.target.value)}
        placeholder={`client,invoice_number,amount,due_date\nAcme Corp,INV-001,1500.00,2026-03-01\nWidgetCo,INV-002,750.00,2026-02-15`}
        style={{ ...inputStyle, minHeight: 100, fontFamily: "monospace", fontSize: 12, marginBottom: 10 }}
      />

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={handleParse} style={{ ...smallBtn, background: "rgba(255,255,255,.10)", color: "rgba(255,255,255,.92)" }}>
          Preview
        </button>
        {preview.length > 0 && (
          <button onClick={doImport} disabled={importing} style={{ ...smallBtn, background: "rgba(48,209,88,.20)", color: "#30d158" }}>
            {importing ? "Importing..." : `Import ${preview.length} invoices`}
          </button>
        )}
        {result && <span style={{ fontSize: 13, color: "#30d158" }}>{result}</span>}
      </div>

      {preview.length > 0 && (
        <div style={{ marginTop: 12, border: "1px solid rgba(255,255,255,.10)", borderRadius: 12, overflow: "hidden", maxHeight: 200, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,.04)" }}>
                {Object.keys(preview[0]).map(k => <th key={k} style={{ ...thStyle, fontSize: 11 }}>{k}</th>)}
              </tr>
            </thead>
            <tbody>
              {preview.slice(0, 10).map((row, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,.06)" }}>
                  {Object.values(row).map((v, j) => <td key={j} style={{ ...tdStyle, fontSize: 12 }}>{v}</td>)}
                </tr>
              ))}
              {preview.length > 10 && (
                <tr><td colSpan={Object.keys(preview[0]).length} style={{ padding: 8, textAlign: "center", color: "rgba(255,255,255,.4)", fontSize: 11 }}>
                  ...and {preview.length - 10} more rows
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.92)",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
};
const pillStyle: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 99,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(255,255,255,.06)",
  color: "rgba(255,255,255,.8)",
  cursor: "pointer",
  fontSize: 13,
};
const thStyle: React.CSSProperties = { padding: "10px 12px", color: "rgba(255,255,255,.5)", fontSize: 12, fontWeight: 600 };
const tdStyle: React.CSSProperties = { padding: "10px 12px" };
const smallBtn: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.14)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(0,0,0,.26)",
  color: "rgba(255,255,255,.92)",
  outline: "none",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "rgba(255,255,255,.5)", display: "block", marginBottom: 4 };
