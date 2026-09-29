"use client";
// Menu déroulant des pays avec drapeaux. Images (flagcdn) et non emojis :
// Windows n'affiche pas les emojis drapeaux (il montre « CM » à la place).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";
import { PAYS_DEVISES, PAYS_OPTIONS } from "@/lib/devise-convert";

export function Drapeau({ code, taille = 20 }: { code: string | null | undefined; taille?: number }) {
  if (!code || !/^[A-Za-z]{2}$/.test(code)) return null;
  return (
    <img src={`https://flagcdn.com/${code.toLowerCase()}.svg`} alt="" width={taille} height={Math.round(taille * 0.75)} loading="lazy"
      style={{ width: taille, height: Math.round(taille * 0.75), objectFit: "cover", borderRadius: 3, flexShrink: 0, boxShadow: "0 0 0 1px rgba(0,0,0,.08)" }} />
  );
}

type Pays = { code: string; nom: string };

export function SelectPays({ value, onChange, options = PAYS_OPTIONS, placeholder = "Sélectionner un pays…", className = "", style, children, ariaLabel = "Pays" }: {
  value: string | null | undefined;
  onChange: (code: string) => void;
  options?: Pays[];
  placeholder?: string;
  /** Classes du bouton déclencheur (sinon style champ de formulaire). */
  className?: string;
  style?: CSSProperties;
  /** Contenu personnalisé du bouton (ex. pastille de la vitrine). */
  children?: ReactNode;
  ariaLabel?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [actif, setActif] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  const courant = options.find((p) => p.code === value);
  const q = recherche.trim().toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const filtres = q ? options.filter((p) => (p.nom + " " + p.code).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").includes(q)) : options;

  function ouvrir() {
    const r = bouton.current!.getBoundingClientRect();
    const width = Math.max(r.width, 280);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const hauteur = 360;
    const top = r.bottom + 6 + hauteur > window.innerHeight && r.top > hauteur ? r.top - 6 - hauteur : r.bottom + 6;
    setPos({ top, left, width });
    setRecherche("");
    setActif(Math.max(0, options.findIndex((p) => p.code === value)));
    setOuvert(true);
  }
  const fermer = () => { setOuvert(false); bouton.current?.focus(); };
  const choisir = (code: string) => { setOuvert(false); onChange(code); };

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => { if (!panneau.current?.contains(e.target as Node) && !bouton.current?.contains(e.target as Node)) setOuvert(false); };
    const defile = (e: Event) => { if (!panneau.current?.contains(e.target as Node)) setOuvert(false); };
    document.addEventListener("mousedown", clic);
    window.addEventListener("scroll", defile, true);
    window.addEventListener("resize", defile);
    return () => { document.removeEventListener("mousedown", clic); window.removeEventListener("scroll", defile, true); window.removeEventListener("resize", defile); };
  }, [ouvert]);

  useEffect(() => { liste.current?.querySelector(`[data-i="${actif}"]`)?.scrollIntoView({ block: "nearest" }); }, [actif, ouvert]);

  function clavier(e: React.KeyboardEvent) {
    if (e.key === "Escape") { e.preventDefault(); fermer(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActif((i) => Math.min(i + 1, filtres.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActif((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (filtres[actif]) choisir(filtres[actif].code); }
  }

  return (
    <>
      <button ref={bouton} type="button" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={ouvert}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={(e) => { if (!ouvert && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) { e.preventDefault(); ouvrir(); } }}
        className={children ? className : `ax-select-pays ${className}`} style={style}>
        {children ?? (
          <>
            {courant ? <Drapeau code={courant.code} /> : null}
            <span className={`flex-1 text-left truncate ${courant ? "" : "opacity-50"}`}>{courant?.nom ?? value ?? placeholder}</span>
            <ChevronDown size={16} className={`opacity-50 transition-transform ${ouvert ? "rotate-180" : ""}`} aria-hidden />
          </>
        )}
      </button>

      {ouvert && pos && createPortal(
        <div ref={panneau} onKeyDown={clavier} className="ax-pays-panneau"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.width }}>
          <div className="ax-pays-recherche">
            <Search size={15} aria-hidden />
            <input autoFocus value={recherche} placeholder="Rechercher un pays…" aria-label="Rechercher un pays"
              onChange={(e) => { setRecherche(e.target.value); setActif(0); }} />
          </div>
          <ul ref={liste} role="listbox" aria-label={ariaLabel}>
            {filtres.length === 0 && <li className="ax-pays-vide">Aucun pays trouvé</li>}
            {filtres.map((p, i) => (
              <li key={p.code} data-i={i} role="option" aria-selected={p.code === value}
                className={`ax-pays-option ${i === actif ? "is-actif" : ""} ${p.code === value ? "is-choisi" : ""}`}
                onMouseEnter={() => setActif(i)} onClick={() => choisir(p.code)}>
                <Drapeau code={p.code} taille={22} />
                <span className="flex-1 truncate">{p.nom}</span>
                {PAYS_DEVISES[p.code] && <span className="ax-pays-devise">{PAYS_DEVISES[p.code]}</span>}
                {p.code === value && <Check size={15} strokeWidth={2.5} className="ax-pays-check" aria-hidden />}
              </li>
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </>
  );
}
