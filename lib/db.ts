import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

/**
 * NOTE:
 * - Local dev: persists at ./db/ar-copilot.db
 * - Serverless (e.g. Vercel): filesystem may be ephemeral/read-only; you can override via AR_COPILOT_DB_PATH.
 */
const DEFAULT_DB_PATH = path.join(process.cwd(), "db", "ar-copilot.db");

function resolveDbPath() {
  return process.env.AR_COPILOT_DB_PATH || DEFAULT_DB_PATH;
}

function ensureDirForFile(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function init(db: Database.Database) {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Waitlist
  db.exec(`
    create table if not exists waitlist_signups (
      id text primary key,
      email text not null unique,
      name text,
      invoice_volume text,
      current_tool text,
      pain text,
      source text,
      created_at text not null default (datetime('now'))
    );
  `);

  // Clients
  db.exec(`
    create table if not exists clients (
      id text primary key,
      name text not null,
      primary_contact_name text,
      primary_contact_email text,
      company_domain text,
      notes text,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );
  `);

  // Invoices
  db.exec(`
    create table if not exists invoices (
      id text primary key,
      client_id text,

      invoice_number text,
      description text,
      currency text not null default 'USD',
      amount_cents integer not null default 0,

      issue_date text,
      due_date text not null,
      paid_date text,

      status text not null default 'open',

      last_followup_at text,
      last_followup_stage text,

      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now')),

      foreign key (client_id) references clients(id) on delete set null
    );
    create index if not exists invoices_client_id_idx on invoices(client_id);
    create index if not exists invoices_status_due_idx on invoices(status, due_date);
  `);

  // Follow-up log
  db.exec(`
    create table if not exists follow_up_logs (
      id text primary key,
      invoice_id text not null,

      channel text not null default 'email',
      stage text,
      subject text,
      body text,
      sent_at text not null default (datetime('now')),
      notes text,

      foreign key (invoice_id) references invoices(id) on delete cascade
    );
    create index if not exists follow_up_logs_invoice_id_idx on follow_up_logs(invoice_id);
  `);
}

declare global {
  // eslint-disable-next-line no-var
  var __arCopilotDb: Database.Database | undefined;
}

export function getDb() {
  if (global.__arCopilotDb) return global.__arCopilotDb;

  const dbPath = resolveDbPath();
  ensureDirForFile(dbPath);

  const db = new Database(dbPath);
  init(db);

  global.__arCopilotDb = db;
  return db;
}
