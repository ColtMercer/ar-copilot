export const metadata = {
  title: "Thanks — AR Copilot",
};

export default function ThanksPage() {
  return (
    <main style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      padding: 24,
      fontFamily:
        'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
    }}>
      <div style={{ maxWidth: 520 }}>
        <h1 style={{ fontSize: 32, margin: "0 0 12px" }}>You’re on the list.</h1>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          Thanks — we’ll email you when the beta opens.
        </p>
        <p style={{ marginTop: 18 }}>
          <a href="/" style={{ textDecoration: "underline" }}>
            Back to the homepage
          </a>
        </p>
      </div>
    </main>
  );
}
