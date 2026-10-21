"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import type { Langue } from "@/lib/i18n";

export function choisirLangue(langue: Langue) {
  document.cookie = `langue=${langue}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}

const LANGUES: { id: Langue; nom: string; code: string }[] = [
  { id: "fr", nom: "Français", code: "FR" },
  { id: "en", nom: "English", code: "EN" },
];

// Styles en ligne (pas de classes) : la pastille flottante s'affiche aussi sur les vitrines,
// dont le CSS du design ne doit pas la déformer.
const POLICE = "'Poppins','Century Gothic',system-ui,sans-serif";

/**
 * Menu de langue (français par défaut ; l'anglais seulement après un choix, mémorisé un an).
 * `flottant` : pastille fixe en bas à gauche, masquée dans le dashboard (qui l'a dans son header)
 * et l'admin (barre latérale). `ouvrirVers` / `aligner` : sens et bord du menu selon la place du bouton
 * (`aligner="droite"` pour un bouton au bord droit de l'écran, sinon le menu en déborde).
 */
export function LangueSelecteur({ flottant = false, ouvrirVers = "haut", aligner = "gauche" }: { flottant?: boolean; ouvrirVers?: "haut" | "bas"; aligner?: "gauche" | "droite" }) {
  const { langue } = useT();
  const pathname = usePathname();
  const [ouvert, setOuvert] = useState(false);
  const racine = useRef<HTMLDivElement>(null);

  // Fermé par un clic ailleurs ou Échap (le focus revient sur le bouton).
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => { if (!racine.current?.contains(e.target as Node)) setOuvert(false); };
    const echap = (e: KeyboardEvent) => { if (e.key === "Escape") { setOuvert(false); racine.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", echap);
    return () => { document.removeEventListener("pointerdown", dehors); document.removeEventListener("keydown", echap); };
  }, [ouvert]);

  if (flottant && (pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin"))) return null;
  const actuelle = LANGUES.find((l) => l.id === langue) ?? LANGUES[0];

  return (
    <div
      ref={racine}
      style={{
        position: flottant ? "fixed" : "relative", flexShrink: 0, fontFamily: POLICE,
        ...(flottant && { left: 16, bottom: 16, zIndex: 60 }),
      }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-label={`Langue / Language : ${actuelle.nom}`}
        onClick={() => setOuvert((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, height: 34, padding: "0 10px 0 11px",
          borderRadius: 999, fontSize: 12.5, fontWeight: 600, fontFamily: POLICE, lineHeight: 1,
          background: "#fff", color: "#111", cursor: "pointer",
          border: `1px solid ${ouvert ? "#F5A623" : "rgba(0,0,0,.12)"}`,
          boxShadow: flottant ? "0 4px 16px rgba(0,0,0,.12)" : ouvert ? "0 0 0 3px rgba(245,166,35,.18)" : "none",
          transition: "border-color .15s, box-shadow .15s",
        }}
      >
        <Globe size={15} aria-hidden style={{ color: "#C77C0A" }} />
        {actuelle.nom}
        <ChevronDown size={14} aria-hidden style={{ color: "#888", transition: "transform .15s", transform: ouvert ? "rotate(180deg)" : "none" }} />
      </button>

      {ouvert && (
        <ul
          role="listbox"
          aria-label="Langue / Language"
          style={{
            position: "absolute", [ouvrirVers === "haut" ? "bottom" : "top"]: "calc(100% + 8px)",
            [aligner === "droite" ? "right" : "left"]: 0, minWidth: 180, margin: 0, padding: 6, listStyle: "none", zIndex: 70,
            background: "#fff", borderRadius: 14, border: "1px solid rgba(0,0,0,.08)",
            boxShadow: "0 12px 32px rgba(17,17,17,.16), 0 2px 6px rgba(17,17,17,.06)",
            animation: "axLangue .14s ease-out",
          }}
        >
          <style>{`@keyframes axLangue{from{opacity:0;transform:translateY(${ouvrirVers === "haut" ? 4 : -4}px)}to{opacity:1;transform:none}}`}</style>
          {LANGUES.map((l) => {
            const choisie = l.id === langue;
            return (
              <li key={l.id} role="option" aria-selected={choisie}>
                <button
                  type="button"
                  onClick={() => (choisie ? setOuvert(false) : choisirLangue(l.id))}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                    borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontFamily: POLICE,
                    background: choisie ? "#FFF6E6" : "transparent", color: "#111", fontSize: 13.5, fontWeight: choisie ? 600 : 500,
                  }}
                  onMouseEnter={(e) => { if (!choisie) e.currentTarget.style.background = "#F5F5F5"; }}
                  onMouseLeave={(e) => { if (!choisie) e.currentTarget.style.background = "transparent"; }}
                >
                  <span style={{
                    width: 28, height: 22, borderRadius: 6, display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10.5, fontWeight: 700, letterSpacing: ".04em",
                    background: choisie ? "#F5A623" : "#F0F0F0", color: choisie ? "#111" : "#666",
                  }}>{l.code}</span>
                  <span style={{ flex: 1 }}>{l.nom}</span>
                  {choisie && <Check size={15} aria-hidden style={{ color: "#C77C0A" }} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
