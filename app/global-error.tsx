"use client";
// Remplace le layout racine : ni styles globaux ni traductions ici, tout est en ligne.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="fr">
      <body style={{ margin: 0, background: "#ffffff", color: "#111111", fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>
        <title>Erreur | Axso</title>
        <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 16px", textAlign: "center" }}>
          <div style={{ maxWidth: 420 }}>
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: "0 0 12px" }}>Une erreur est survenue</h1>
            <p style={{ color: "#737373", margin: "0 0 32px" }}>Réessayez dans un instant. Si le problème continue, contactez-nous sur WhatsApp au +237 6 98 67 73 55.</p>
            <button onClick={() => retry()}
              style={{ border: 0, cursor: "pointer", fontWeight: 700, fontSize: 16, padding: "14px 32px", borderRadius: 16, background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
