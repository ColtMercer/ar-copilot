import { Pool } from "pg";

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER || "opus",
  password: process.env.PGPASSWORD || "opus_dev",
  database: process.env.PGDATABASE || "ar_copilot",
});

let initialized = false;

export async function getDb() {
  if (!initialized) {
    await initSchema();
    initialized = true;
  }
  return pool;
}

async function initSchema() {
  // Create the database if it doesn't exist (connect to default db first)
  const bootstrapPool = new Pool({
    host: process.env.PGHOST || "localhost",
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || "opus",
    password: process.env.PGPASSWORD || "opus_dev",
    database: process.env.PGDATABASE_BOOTSTRAP || "opus_dev",
  });

  try {
    const dbName = process.env.PGDATABASE || "ar_copilot";
    const res = await bootstrapPool.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (res.rowCount === 0) {
      await bootstrapPool.query(`CREATE DATABASE ${dbName}`);
    }
  } catch {
    // might fail if DB already exists or permissions — that's fine
  } finally {
    await bootstrapPool.end();
  }

  // Now run migrations on the actual DB
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;


    CREATE TABLE IF NOT EXISTS waitlist_signups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      invoice_volume TEXT,
      current_tool TEXT,
      pain TEXT,
      source TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS clients (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      primary_contact_name TEXT,
      primary_contact_email TEXT,
      company_domain TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS client_settings (
      client_id UUID PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
      tone TEXT NOT NULL DEFAULT 'friendly' CHECK (tone IN ('friendly','neutral','firm')),
      include_payment_methods BOOLEAN NOT NULL DEFAULT true,
      include_late_fee BOOLEAN NOT NULL DEFAULT false,
      late_fee_text TEXT,
      payment_link TEXT,
      signature_name TEXT,
      signature_company TEXT,
      signature_phone TEXT,
      signature_email TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    ALTER TABLE client_settings ADD COLUMN IF NOT EXISTS payment_link TEXT;

    CREATE TABLE IF NOT EXISTS invoices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
      invoice_number TEXT,
      description TEXT,
      currency TEXT NOT NULL DEFAULT 'USD',
      amount_cents INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
      issue_date DATE,
      due_date DATE NOT NULL,
      paid_date DATE,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','disputed','written_off')),
      last_followup_at TIMESTAMPTZ,
      last_followup_stage TEXT CHECK (last_followup_stage IN ('pre_due','day_1','day_7','day_14','final')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS invoices_client_id_idx ON invoices(client_id);
    CREATE INDEX IF NOT EXISTS invoices_status_due_idx ON invoices(status, due_date);

    CREATE TABLE IF NOT EXISTS followup_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      channel TEXT NOT NULL DEFAULT 'email' CHECK (channel IN ('email','phone','sms','other')),
      stage TEXT CHECK (stage IN ('pre_due','day_1','day_7','day_14','final')),
      subject TEXT,
      body TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      notes TEXT
    );

    CREATE INDEX IF NOT EXISTS followup_events_invoice_id_idx ON followup_events(invoice_id);

    CREATE TABLE IF NOT EXISTS templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      tone TEXT NOT NULL DEFAULT 'friendly' CHECK (tone IN ('friendly','neutral','firm')),
      stage TEXT NOT NULL CHECK (stage IN ('pre_due','day_1','day_7','day_14','final')),
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS templates_stage_tone_idx ON templates(stage, tone);
  `);

  // Seed system templates if empty
  const tmplCount = await pool.query("SELECT count(*) FROM templates WHERE is_system = true");
  if (parseInt(tmplCount.rows[0].count) === 0) {
    await seedTemplates();
  }
}

async function seedTemplates() {
  const templates = [
    { name: "Friendly Pre-Due", tone: "friendly", stage: "pre_due",
      subject: "Quick heads-up — Invoice {{invoice.number}} due in 3 days",
      body: "Hi {{client.contact_name}},\n\nJust a friendly reminder that Invoice {{invoice.number}} for {{invoice.amount}} is due on {{invoice.due_date}}.\n\nIf it's already in process, great — no action needed!\n\nThanks,\n{{signature.name}}" },
    { name: "Friendly Day 1", tone: "friendly", stage: "day_1",
      subject: "Quick check — Invoice {{invoice.number}}",
      body: "Hi {{client.contact_name}},\n\nJust checking in — Invoice {{invoice.number}} for {{invoice.amount}} was due {{invoice.due_date}}. Can you confirm it's in process and share an ETA for payment?\n\nThanks,\n{{signature.name}}" },
    { name: "Firm Day 1", tone: "firm", stage: "day_1",
      subject: "Invoice {{invoice.number}} — now past due",
      body: "Hi {{client.contact_name}},\n\nInvoice {{invoice.number}} for {{invoice.amount}} was due {{invoice.due_date}} and is now past due. Please arrange payment at your earliest convenience.\n\nRegards,\n{{signature.name}}" },
    { name: "Friendly Day 7", tone: "friendly", stage: "day_7",
      subject: "Following up — Invoice {{invoice.number}} ({{invoice.days_overdue}} days overdue)",
      body: "Hi {{client.contact_name}},\n\nI wanted to follow up on Invoice {{invoice.number}} ({{invoice.amount}}), which is now {{invoice.days_overdue}} days past due.\n\nIs there anything holding this up? Happy to help resolve any billing questions.\n\nBest,\n{{signature.name}}" },
    { name: "Firm Day 7", tone: "firm", stage: "day_7",
      subject: "Action needed — Invoice {{invoice.number}} is past due",
      body: "Hi {{client.contact_name}},\n\nInvoice {{invoice.number}} ({{invoice.amount}}) is now {{invoice.days_overdue}} days past due. Please confirm the payment date by EOD today so we can keep the project schedule on track.\n\nIf there's a billing issue, reply here and I'll resolve it quickly.\n\n— {{signature.name}}" },
    { name: "Friendly Day 14", tone: "friendly", stage: "day_14",
      subject: "Invoice {{invoice.number}} — 2 weeks overdue",
      body: "Hi {{client.contact_name}},\n\nI'm reaching out again about Invoice {{invoice.number}} ({{invoice.amount}}), now {{invoice.days_overdue}} days overdue. I understand things get busy, but I'd appreciate an update on when I can expect payment.\n\nPlease let me know if there's anything I can do on my end.\n\nThanks,\n{{signature.name}}" },
    { name: "Firm Day 14", tone: "firm", stage: "day_14",
      subject: "Urgent — Invoice {{invoice.number}} remains unpaid",
      body: "Hi {{client.contact_name}},\n\nInvoice {{invoice.number}} ({{invoice.amount}}) is {{invoice.days_overdue}} days past due with no response to previous follow-ups.\n\nPlease arrange payment within 3 business days. If there is a dispute, let me know immediately so we can resolve it.\n\n— {{signature.name}}" },
    { name: "Final Notice", tone: "firm", stage: "final",
      subject: "Final notice — Invoice {{invoice.number}}",
      body: "Hi {{client.contact_name}},\n\nInvoice {{invoice.number}} ({{invoice.amount}}) remains unpaid {{invoice.days_overdue}} days past due.\n\nPlease arrange payment by {{invoice.due_date_plus_3}}. If payment isn't received by then, we'll pause work and move this to our collections process.\n\nThanks,\n{{signature.name}}" },
  ];

  for (const t of templates) {
    await pool.query(
      `INSERT INTO templates (name, tone, stage, subject, body, is_system) VALUES ($1, $2, $3, $4, $5, true)`,
      [t.name, t.tone, t.stage, t.subject, t.body]
    );
  }
}
