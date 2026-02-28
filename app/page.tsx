import { getSession } from "@/lib/auth";

type PageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function Home({ searchParams }: PageProps) {
  const waitlistSuccess = searchParams?.waitlist === "1";
  const session = await getSession();
  const isAuthed = Boolean(session?.user?.sub);

  return (
    <>
      <style>{`
        :root {
          --bg: #0b1220;
          --panel: rgba(255,255,255,.06);
          --panel2: rgba(255,255,255,.09);
          --text: rgba(255,255,255,.92);
          --muted: rgba(255,255,255,.72);
          --muted2: rgba(255,255,255,.58);
          --border: rgba(255,255,255,.14);
          --accent: #7c5cff;
          --accent2: #18d6ff;
          --good: #30d158;
          --warn: #ffcc00;
          --bad: #ff453a;
          --shadow: 0 14px 50px rgba(0,0,0,.42);
          --radius: 16px;
          --radius2: 22px;
          --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
          --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji";
        }

        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body {
          margin: 0;
          color: var(--text);
          font-family: var(--sans);
          background:
            radial-gradient(1200px 600px at 20% 10%, rgba(124,92,255,.26), transparent 60%),
            radial-gradient(900px 500px at 85% 20%, rgba(24,214,255,.18), transparent 60%),
            radial-gradient(800px 500px at 50% 90%, rgba(48,209,88,.10), transparent 60%),
            var(--bg);
        }

        a { color: rgba(255,255,255,.9); text-decoration: none; }
        a:hover { text-decoration: underline; }

        .wrap { max-width: 1080px; margin: 0 auto; padding: 28px 18px 64px; }

        header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 8px 2px 18px;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          letter-spacing: .2px;
        }

        .logo {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(124,92,255,.95), rgba(24,214,255,.75));
          box-shadow: 0 10px 30px rgba(124,92,255,.18);
          border: 1px solid rgba(255,255,255,.16);
        }

        .nav {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,.03);
          padding: 8px 12px;
          border-radius: 999px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(255,255,255,.06);
          color: var(--text);
          font-weight: 650;
          cursor: pointer;
        }

        .btn.primary {
          background: linear-gradient(135deg, rgba(124,92,255,.95), rgba(24,214,255,.72));
          border: 1px solid rgba(255,255,255,.22);
          box-shadow: 0 14px 46px rgba(124,92,255,.20);
        }

        .btn.primary:hover { filter: brightness(1.03); }

        .hero {
          display: grid;
          grid-template-columns: 1.1fr .9fr;
          gap: 22px;
          align-items: start;
          margin-top: 6px;
        }

        @media (max-width: 900px) {
          .hero { grid-template-columns: 1fr; }
        }

        .card {
          border: 1px solid var(--border);
          background: var(--panel);
          border-radius: var(--radius2);
          box-shadow: var(--shadow);
          padding: 18px;
        }

        .hero h1 {
          font-size: clamp(32px, 3.8vw, 48px);
          margin: 10px 0 10px;
          letter-spacing: -0.7px;
          line-height: 1.04;
        }

        .sub {
          color: var(--muted);
          font-size: 16px;
          line-height: 1.55;
          margin: 0 0 16px;
          max-width: 56ch;
        }

        .value-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 14px;
        }

        @media (max-width: 900px) {
          .value-grid { grid-template-columns: 1fr; }
        }

        .mini {
          border: 1px solid rgba(255,255,255,.14);
          background: rgba(255,255,255,.04);
          border-radius: var(--radius);
          padding: 12px;
        }

        .mini .k { font-size: 13px; color: var(--muted2); margin-bottom: 8px; }
        .mini .v { font-size: 14px; color: var(--text); }

        .section {
          margin-top: 22px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 900px) {
          .section { grid-template-columns: 1fr; }
        }

        h2 {
          margin: 0 0 10px;
          font-size: 22px;
          letter-spacing: -0.2px;
        }

        p { margin: 0 0 10px; color: var(--muted); line-height: 1.6; }

        ul { margin: 10px 0 0 18px; color: var(--muted); line-height: 1.6; }

        .kbd {
          font-family: var(--mono);
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(0,0,0,.22);
          color: rgba(255,255,255,.85);
          display: inline-block;
        }

        .quote {
          border-left: 3px solid rgba(124,92,255,.9);
          padding: 10px 12px;
          margin-top: 8px;
          background: rgba(0,0,0,.16);
          border-radius: 12px;
          color: rgba(255,255,255,.82);
        }

        form { display: grid; gap: 10px; }

        label { font-size: 13px; color: var(--muted2); }

        input, select, textarea {
          width: 100%;
          background: rgba(0,0,0,.26);
          border: 1px solid rgba(255,255,255,.16);
          color: var(--text);
          padding: 12px;
          border-radius: 12px;
          outline: none;
        }

        input::placeholder, textarea::placeholder { color: rgba(255,255,255,.45); }

        .row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 560px) { .row { grid-template-columns: 1fr; } }

        .fine { font-size: 12px; color: var(--muted2); line-height: 1.5; }

        .pricing {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-top: 10px;
        }
        @media (max-width: 900px) { .pricing { grid-template-columns: 1fr; } }

        .price {
          border: 1px solid rgba(255,255,255,.16);
          background: rgba(255,255,255,.04);
          border-radius: 18px;
          padding: 14px;
          position: relative;
          overflow: hidden;
        }

        .price h3 { margin: 0 0 4px; font-size: 16px; }
        .price .amt { font-size: 28px; margin: 8px 0 6px; font-weight: 750; }
        .price .tag { font-size: 12px; color: var(--muted2); }

        .badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,.18);
          background: rgba(124,92,255,.22);
          color: rgba(255,255,255,.92);
        }

        details {
          border: 1px solid rgba(255,255,255,.14);
          border-radius: 16px;
          padding: 12px;
          background: rgba(255,255,255,.03);
        }

        details summary {
          cursor: pointer;
          font-weight: 650;
          color: rgba(255,255,255,.88);
        }

        footer {
          margin-top: 28px;
          padding-top: 16px;
          border-top: 1px solid rgba(255,255,255,.10);
          color: var(--muted2);
          font-size: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          justify-content: space-between;
        }
      `}</style>

      <div className="wrap">
        <header>
          <div className="brand">
            <div className="logo" aria-hidden="true" />
            <div>
              <div style={{ fontSize: 14, lineHeight: 1 }}>AR Copilot</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--muted2)",
                  marginTop: 4,
                }}
              >
                past-due invoice follow‑ups
              </div>
            </div>
          </div>
          <nav className="nav">
            <span className="pill">Built for freelancers + small agencies</span>
            <a className="btn" href="#how">
              How it works
            </a>
            <a className="btn" href="#pricing">
              Pricing
            </a>
            {isAuthed ? (
              <a className="btn" href="/dashboard">
                Dashboard
              </a>
            ) : (
              <a className="btn" href="/api/auth/login">
                Sign In
              </a>
            )}
            <a className="btn primary" href="#waitlist">
              Join waitlist
            </a>
          </nav>
        </header>

        <main className="hero">
          <section className="card">
            <div className="pill" style={{ display: "inline-flex", marginBottom: 10 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 99,
                  background: "var(--good)",
                }}
              />
              Turn “I should follow up…” into a daily 5‑minute routine
            </div>

            <h1>
              Get paid faster{" "}
              <span style={{ color: "rgba(124,92,255,.98)" }}>
                without being awkward
              </span>
              .
            </h1>
            <p className="sub">
              AR Copilot tracks overdue invoices and generates the right follow‑up
              message for the stage you’re in—friendly, firm, and professional.
              No CRM bloat. No integrations required to start.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <a className="btn primary" href="#waitlist">
                Join the waitlist
              </a>
              <a className="btn" href="#templates">
                See message examples
              </a>
              <span className="pill" title="MVP focus">
                MVP: copy‑paste follow‑ups + send log
              </span>
            </div>

            <div className="value-grid">
              <div className="mini">
                <div className="k">You get</div>
                <div className="v">
                  <strong>Today’s chase list</strong> so you never wonder who to
                  nudge.
                </div>
              </div>
              <div className="mini">
                <div className="k">You avoid</div>
                <div className="v">The “sorry to bother you” vibe that invites delays.</div>
              </div>
              <div className="mini">
                <div className="k">You keep</div>
                <div className="v">
                  A <strong>send log</strong> so you can stay consistent (and
                  calm).
                </div>
              </div>
            </div>
          </section>

          <aside className="card" id="waitlist">
            <h2>Join the waitlist</h2>
            <p>
              Be first in line for the beta. Tell us your invoice volume so we
              price it right.
            </p>

            {waitlistSuccess ? (
              <div className="pill" style={{ marginBottom: 10, borderColor: "rgba(48,209,88,.45)" }}>
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 99,
                    background: "var(--good)",
                  }}
                />
                You’re on the list — we’ll email you when beta opens.
              </div>
            ) : null}

            <form method="post" action="/api/waitlist">
              <div className="row">
                <div>
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    placeholder="Your name"
                    autoComplete="name"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@studio.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="row">
                <div>
                  <label htmlFor="volume">How many invoices do you manage per month?</label>
                  <select id="volume" name="invoice_volume" required defaultValue="">
                    <option value="">Select…</option>
                    <option>1–5</option>
                    <option>6–15</option>
                    <option>16–30</option>
                    <option>31–75</option>
                    <option>76+</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="stack">Where do you track invoices today?</label>
                  <select id="stack" name="current_tool" required defaultValue="">
                    <option value="">Select…</option>
                    <option>Spreadsheet</option>
                    <option>QuickBooks</option>
                    <option>Xero</option>
                    <option>FreshBooks</option>
                    <option>Wave</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="pain">Biggest pain point (optional)</label>
                <textarea
                  id="pain"
                  name="pain"
                  rows={3}
                  placeholder="e.g., I forget to follow up until it’s way late…"
                />
              </div>

              <input type="hidden" name="source" value="landing_v1" />

              <button className="btn primary" type="submit">
                Request beta access
              </button>
              <div className="fine">
                No spam. One email when beta opens. If you’re willing to do a
                15‑minute interview, mention it in the pain box.
              </div>
            </form>
          </aside>
        </main>

        <section className="section" id="how">
          <div className="card">
            <h2>How it works (MVP)</h2>
            <p>
              <strong>1) Add invoices</strong> (manual, or CSV import). Track due
              date + last follow‑up.
            </p>
            <p>
              <strong>2) Open your chase list</strong>. AR Copilot tells you who
              needs a follow‑up today and why.
            </p>
            <p>
              <strong>3) Copy the message</strong> (subject + body). Send it
              however you already send email.
            </p>
            <p>
              <strong>4) Click “Mark sent”</strong>. You stay consistent without
              keeping mental notes.
            </p>
            <ul>
              <li>Choose a tone: friendly / firm</li>
              <li>Optional late fee wording toggle</li>
              <li>Remind them of payment methods + link</li>
            </ul>
          </div>

          <div className="card" id="templates">
            <h2>Message examples</h2>
            <p>These are short on purpose. You’re not begging—you’re running a business.</p>

            <div className="quote">
              <div className="kbd">1 day overdue</div>
              <div style={{ marginTop: 8 }}>
                <strong>Subject:</strong> Quick check — Invoice #1843
                <br />
                <br />
                Hi {"{{ClientName}}"},
                <br />
                Just checking in—Invoice #1843 for ${"{{Amount}}"} was due {"{{DueDate}}"}. Can you confirm it’s in process and share an ETA for payment?
                <br />
                <br />
                Thanks,
                <br />
                {"{{YourName}}"}
              </div>
            </div>

            <div className="quote" style={{ marginTop: 10, borderLeftColor: "rgba(255,204,0,.9)" }}>
              <div className="kbd">7 days overdue (firm)</div>
              <div style={{ marginTop: 8 }}>
                <strong>Subject:</strong> Action needed — Invoice #1843 is past due
                <br />
                <br />
                Hi {"{{ClientName}}"},
                <br />
                Invoice #1843 (${"{{Amount}}"}) is now 7 days past due. Please confirm the payment date by EOD today so we can keep the project schedule on track.
                <br />
                <br />
                If there’s a billing issue, reply here and I’ll resolve it quickly.
                <br />
                <br />
                — {"{{YourName}}"}
              </div>
            </div>

            <div className="quote" style={{ marginTop: 10, borderLeftColor: "rgba(255,69,58,.85)" }}>
              <div className="kbd">14 days overdue (final notice)</div>
              <div style={{ marginTop: 8 }}>
                <strong>Subject:</strong> Final notice — Invoice #1843
                <br />
                <br />
                Hi {"{{ClientName}}"},
                <br />
                Invoice #1843 (${"{{Amount}}"}) remains unpaid 14 days past due. Please arrange payment by {"{{Date+3}}"}.
                <br />
                <br />
                If payment isn’t received by then, we’ll pause work and move this to our collections process.
                <br />
                <br />
                Thanks,
                <br />
                {"{{YourName}}"}
              </div>
            </div>

            <p className="fine" style={{ marginTop: 10 }}>
              (Beta will include multiple variants + softer/harder tones based on your preference.)
            </p>
          </div>
        </section>

        <section className="card" style={{ marginTop: 16 }} id="pricing">
          <h2>Pricing (hypothesis)</h2>
          <p>Priced to be an easy yes compared to the cost of a single late invoice.</p>
          <div className="pricing">
            <div className="price">
              <h3>Free</h3>
              <div className="amt">$0</div>
              <div className="tag">Up to 3 active invoices</div>
              <ul>
                <li>Chase list</li>
                <li>Core templates</li>
                <li>Send log</li>
              </ul>
            </div>
            <div
              className="price"
              style={{
                borderColor: "rgba(124,92,255,.40)",
                background: "rgba(124,92,255,.10)",
              }}
            >
              <span className="badge">Most common</span>
              <h3>Starter</h3>
              <div className="amt">
                $19
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 650,
                    color: "var(--muted2)",
                  }}
                >
                  /mo
                </span>
              </div>
              <div className="tag">Up to 30 active invoices</div>
              <ul>
                <li>All Free features</li>
                <li>More message variants</li>
                <li>Client settings (tone / late fee toggle)</li>
              </ul>
            </div>
            <div className="price">
              <h3>Studio</h3>
              <div className="amt">
                $39
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 650,
                    color: "var(--muted2)",
                  }}
                >
                  /mo
                </span>
              </div>
              <div className="tag">Up to 150 active invoices</div>
              <ul>
                <li>All Starter features</li>
                <li>Team notes + shared send log</li>
                <li>Light analytics (days overdue)</li>
              </ul>
            </div>
          </div>
          <p className="fine" style={{ marginTop: 10 }}>
            Note: pricing will change based on interviews. The waitlist form asks volume to validate tiers.
          </p>
        </section>

        <section className="section" style={{ marginTop: 16 }}>
          <div className="card">
            <h2>FAQ</h2>
            <div style={{ display: "grid", gap: 10 }}>
              <details>
                <summary>Do I have to connect QuickBooks/Xero?</summary>
                <p>No. MVP starts with manual entry or CSV import. Integrations come later.</p>
              </details>
              <details>
                <summary>Will this send emails for me?</summary>
                <p>
                  Not in the first version. We focus on copy‑paste + logging first (fast, low‑risk). Later: Gmail/O365 send with approval + templates.
                </p>
              </details>
              <details>
                <summary>Is this legal advice / collections?</summary>
                <p>No. AR Copilot provides messaging templates and workflow support. You control what you send.</p>
              </details>
              <details>
                <summary>What if I have clients who are “sensitive”?</summary>
                <p>
                  That’s why we support tone settings and short, professional language. You can keep it friendly without being vague.
                </p>
              </details>
            </div>
          </div>

          <div className="card">
            <h2>Who it’s for</h2>
            <ul>
              <li>Freelancers with a handful of invoices where follow‑ups slip</li>
              <li>Small agencies juggling multiple clients and retainers</li>
              <li>Anyone who wants a repeatable “collections-lite” system</li>
            </ul>
            <div className="quote" style={{ marginTop: 12, borderLeftColor: "rgba(24,214,255,.85)" }}>
              <div style={{ fontWeight: 700 }}>
                "I hate following up. I’d pay just to stop thinking about it."
              </div>
              <div className="fine" style={{ marginTop: 6 }}>
                — typical freelancer sentiment (to be replaced with real testimonial)
              </div>
            </div>
            <p className="fine" style={{ marginTop: 10 }}>
              Want the beta to include something specific (payment links, deposits, late fee wording)? Put it in the waitlist notes.
            </p>
          </div>
        </section>

        <footer>
          <div>
            © {new Date().getFullYear()} AR Copilot. Built for getting paid on time.
          </div>
          <div>
            <a href="#waitlist">Join waitlist</a>
            <span style={{ opacity: 0.45, padding: "0 8px" }}>•</span>
            <a href="#pricing">Pricing</a>
            <span style={{ opacity: 0.45, padding: "0 8px" }}>•</span>
            <a href="#">Privacy</a>
          </div>
        </footer>
      </div>
    </>
  );
}
