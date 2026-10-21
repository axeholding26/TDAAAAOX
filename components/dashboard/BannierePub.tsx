"use client";

// Bannière publicitaire de « Ma boutique » : fait défiler les annonces (partenaires
// et services d'Axso), gérées dans le Command Center (/admin/annonces, table Annonce).
// Affichée une seule fois par semaine, à un moment tiré au hasard dans la semaine
// (mémorisé sur l'appareil ; stockage indisponible → jamais affichée). Les annonces
// ne sont chargées (GET /api/annonces) que ce jour-là ; aucune active → rien.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import type { AnnonceAffichee } from "@/lib/annonces";

// Compteurs affichages/clics : envoyés sans attendre, une erreur ne gêne jamais l'interface.
const compter = (id: string, type: "affichage" | "clic") =>
  fetch(`/api/annonces/${encodeURIComponent(id)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }), keepalive: true }).catch(() => {});

const CLE = "axso_pub_prochaine";
const SEMAINE = 7 * 24 * 3600 * 1000;

/** Vrai si la bannière doit s'afficher maintenant ; programme alors la prochaine (semaine suivante, moment aléatoire). */
export function tourDePub(maintenant: number, prochaine: number | null, hasard = Math.random): { afficher: boolean; prochaine: number } {
  // Première visite : un moment au hasard dans les 7 jours qui viennent.
  if (prochaine == null || Number.isNaN(prochaine)) return { afficher: false, prochaine: maintenant + Math.floor(hasard() * SEMAINE) };
  if (maintenant < prochaine) return { afficher: false, prochaine };
  // Affichée : la suivante tombe dans la semaine d'après, à un moment aléatoire.
  const debut = Math.max(prochaine, maintenant) + SEMAINE - (Math.max(prochaine, maintenant) % SEMAINE);
  return { afficher: true, prochaine: debut + Math.floor(hasard() * SEMAINE) };
}

/** Contenu d'une annonce (logo, textes, bouton) : bannière marchand et aperçu du Command Center. */
export function ContenuAnnonce({ a, onClic }: { a: AnnonceAffichee; onClic?: () => void }) {
  const t = useT();
  const externe = a.lien.startsWith("http");
  const Cta = externe ? "a" : Link;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
      {a.logo && (
        <span className="w-14 h-14 flex-shrink-0 rounded-2xl bg-white flex items-center justify-center overflow-hidden">
          <img src={a.logo} alt={a.marque} className="w-11 h-11 object-contain" onError={(e) => (e.currentTarget.parentElement!.style.display = "none")} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: a.accent }}>{t(a.marque)}</p>
        <p className="mt-1 text-[17px] sm:text-[19px] font-bold leading-tight">{t(a.titre)}</p>
        <p className="mt-1 text-[13px] text-white/70 leading-snug">{t(a.texte)}</p>
      </div>
      <Cta href={a.lien} onClick={onClic} {...(externe ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {})}
        className="self-start sm:self-center flex-shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-xl text-[13.5px] font-bold text-[#111111] hover:opacity-90 transition-opacity"
        style={{ background: a.accent }}>
        {t(a.cta)} <ArrowRight size={16} />
      </Cta>
    </div>
  );
}

export function BannierePub() {
  const t = useT();
  const [annonces, setAnnonces] = useState<AnnonceAffichee[]>([]);
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  const vues = useRef(new Set<string>());
  useEffect(() => {
    let afficher = false;
    try {
      const brut = localStorage.getItem(CLE);
      const tour = tourDePub(Date.now(), brut ? Number(brut) : null);
      localStorage.setItem(CLE, String(tour.prochaine));
      afficher = tour.afficher;
    } catch { /* stockage indisponible : pas de pub */ }
    if (!afficher) return;
    // Pas d'annulation au démontage : le tour de la semaine est déjà consommé ci-dessus
    // (le double appel des effets en développement ne relancerait plus la bannière).
    fetch("/api/annonces").then((r) => (r.ok ? r.json() : null)).then((d) => {
      const liste: AnnonceAffichee[] = d?.annonces ?? [];
      if (!liste.length) return;
      setI(Math.floor(Math.random() * liste.length));
      setAnnonces(liste);
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (pause || annonces.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % annonces.length), 7000);
    return () => clearInterval(id);
  }, [pause, annonces.length]);
  const a = annonces[i];
  // Un affichage compté par annonce vue (une fois par passage de la bannière).
  useEffect(() => {
    if (a && !vues.current.has(a.id)) { vues.current.add(a.id); compter(a.id, "affichage"); }
  }, [a]);
  if (!a) return null;

  return (
    <section aria-label={t("Publicités")} aria-roledescription="carousel" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white transition-[background] duration-500" style={{ background: a.fond }}>
      <ContenuAnnonce key={a.id} a={a} onClic={() => compter(a.id, "clic")} />
      {annonces.length > 1 && (
        <div className="mt-4 flex gap-1.5">
          {annonces.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={t("Annonce {0}", k + 1)} aria-current={k === i}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-3 bg-white/35 hover:bg-white/60"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
