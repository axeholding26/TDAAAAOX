"use client";

// Bannière publicitaire de « Ma boutique » : fait défiler les annonces (partenaires
// et services d'Axso). Ajouter une annonce = une ligne dans ANNONCES.
// Affichée une seule fois par semaine, à un moment tiré au hasard dans la semaine
// (mémorisé sur l'appareil ; stockage indisponible → jamais affichée).
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useT } from "@/components/I18nProvider";

interface Annonce { id: string; marque: string; titre: string; texte: string; cta: string; lien: string; logo?: string; fond: string; accent: string }

export const ANNONCES: Annonce[] = [
  {
    id: "kreads", marque: "KREADS · Partenaire officiel", titre: "Des vidéos publicitaires qui vendent",
    texte: "Studio de créatives publicitaires : vidéos et visuels pensés pour faire vendre tes produits sur Facebook, TikTok et Instagram.",
    cta: "Découvrir KREADS", lien: "https://kreads-two.vercel.app/", logo: "https://kreads-two.vercel.app/assets/kreads-logo-Bmz9VEmd.png",
    fond: "linear-gradient(120deg,#111111 0%,#2A1E0A 100%)", accent: "#F5A623",
  },
  {
    id: "axia", marque: "AXIA", titre: "Ton assistant IA travaille pour toi",
    texte: "Demande à AXIA de créer tes produits, modifier ta boutique ou analyser tes ventes, en une phrase.",
    cta: "Parler à AXIA", lien: "/dashboard/axia", fond: "linear-gradient(120deg,#1E1B4B 0%,#312E81 100%)", accent: "#A5B4FC",
  },
  {
    id: "affiliation", marque: "Affiliation Axso", titre: "Gagne de l'argent en parrainant",
    texte: "Invite d'autres commerçants sur Axso et touche une commission sur leurs abonnements.",
    cta: "Voir mon lien", lien: "/dashboard/affiliation", fond: "linear-gradient(120deg,#052E16 0%,#14532D 100%)", accent: "#4ADE80",
  },
];

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

export function BannierePub() {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [i, setI] = useState(0);
  const [pause, setPause] = useState(false);
  useEffect(() => {
    try {
      const brut = localStorage.getItem(CLE);
      const tour = tourDePub(Date.now(), brut ? Number(brut) : null);
      localStorage.setItem(CLE, String(tour.prochaine));
      if (tour.afficher) { setI(Math.floor(Math.random() * ANNONCES.length)); setVisible(true); }
    } catch { /* stockage indisponible : pas de pub */ }
  }, []);
  useEffect(() => {
    if (pause || ANNONCES.length < 2) return;
    const id = setInterval(() => setI((x) => (x + 1) % ANNONCES.length), 7000);
    return () => clearInterval(id);
  }, [pause]);
  if (!visible) return null;
  const a = ANNONCES[i];
  const externe = a.lien.startsWith("http");
  const Cta = externe ? "a" : Link;

  return (
    <section aria-label={t("Publicités")} aria-roledescription="carousel" onMouseEnter={() => setPause(true)} onMouseLeave={() => setPause(false)}
      className="relative overflow-hidden rounded-3xl p-5 sm:p-6 text-white transition-[background] duration-500" style={{ background: a.fond }}>
      <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-4">
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
        <Cta href={a.lien} {...(externe ? { target: "_blank", rel: "noopener noreferrer sponsored" } : {})}
          className="self-start sm:self-center flex-shrink-0 inline-flex items-center gap-2 h-11 px-5 rounded-xl text-[13.5px] font-bold text-[#111111] hover:opacity-90 transition-opacity"
          style={{ background: a.accent }}>
          {t(a.cta)} <ArrowRight size={16} />
        </Cta>
      </div>
      {ANNONCES.length > 1 && (
        <div className="mt-4 flex gap-1.5">
          {ANNONCES.map((x, k) => (
            <button key={x.id} onClick={() => setI(k)} aria-label={t("Annonce {0}", k + 1)} aria-current={k === i}
              className={`h-1.5 rounded-full transition-all ${k === i ? "w-6 bg-white" : "w-3 bg-white/35 hover:bg-white/60"}`} />
          ))}
        </div>
      )}
    </section>
  );
}
