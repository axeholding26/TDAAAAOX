"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { hrefBoutique } from "@/lib/utils";

interface Popup {
  id: string;
  type: string;
  declencheur: string;
  delaiSec: number;
  titre: string;
  message: string;
  ctaTexte: string | null;
  ctaUrl: string | null;
  imageUrl: string | null;
  codePromo: string | null;
}

interface Props {
  slug: string;
  accentColor?: string;
}

export function StorefrontPopups({ slug, accentColor = "#F5A623" }: Props) {
  const t = useT();
  const [popups, setPopups] = useState<Popup[]>([]);
  const [visible, setVisible] = useState<string | null>(null);
  const affichee = useRef<string | null>(null);
  const suivante = useRef<() => void>(() => setVisible(null));

  useEffect(() => {
    fetch(`/api/popups?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setPopups(d.popups ?? []))
      .catch(() => null);
  }, [slug]);

  // Déclencheurs. Une popup à la fois (les autres attendent leur tour), chacune au plus une fois par
  // visite, affichage compté quel que soit le déclencheur. Avant : seule la première popup « après délai »
  // s'affichait (la boucle s'arrêtait dessus), « Au scroll » ne faisait rien, la sortie ne marchait que sur
  // ordinateur, réapparaissait à chaque fois et n'était jamais comptée.
  useEffect(() => {
    if (!popups.length) return;
    const lire = (cle: string) => { try { return sessionStorage.getItem(cle); } catch { return null; } };
    const vues = new Set<string>(JSON.parse(lire("axso_popups_seen") ?? "[]"));
    const enAttente: string[] = [];
    const montrer = (p: Popup) => {
      if (vues.has(p.id)) return;
      vues.add(p.id);
      try { sessionStorage.setItem("axso_popups_seen", JSON.stringify([...vues])); } catch {}
      fetch("/api/popups", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, trackView: true }) }).catch(() => null);
      if (affichee.current) enAttente.push(p.id);
      else { affichee.current = p.id; setVisible(p.id); }
    };
    suivante.current = () => { affichee.current = enAttente.shift() ?? null; setVisible(affichee.current); };

    const minuteries: ReturnType<typeof setTimeout>[] = [];
    for (const p of popups) {
      if (p.declencheur === "delai") minuteries.push(setTimeout(() => montrer(p), Math.max(0, p.delaiSec) * 1000));
      if (p.declencheur === "premiere_visite") {
        const cle = `axso_pv_${p.id}`;
        let deja = false;
        try { deja = !!localStorage.getItem(cle); localStorage.setItem(cle, "1"); } catch {}
        if (!deja) minuteries.push(setTimeout(() => montrer(p), 500));
      }
    }

    const auScroll = popups.filter((p) => p.declencheur === "scroll");
    const sortie = popups.filter((p) => p.declencheur === "exit_intent");
    let plusBas = 0;
    const onScroll = () => {
      const y = window.scrollY, total = document.documentElement.scrollHeight - window.innerHeight;
      if (total > 0 && y / total >= 0.5) auScroll.forEach(montrer); // moitié de la page lue
      // Sortie sur téléphone : remontée franche vers le haut après avoir lu un peu (le geste avant de quitter).
      plusBas = Math.max(plusBas, y);
      if (plusBas > 400 && plusBas - y > 250) sortie.forEach(montrer);
    };
    const onQuitte = (e: MouseEvent) => { if (e.clientY <= 5) sortie.forEach(montrer); }; // ordinateur : souris vers la barre d'onglets
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("mouseleave", onQuitte);
    return () => {
      minuteries.forEach(clearTimeout);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseleave", onQuitte);
    };
  }, [popups]);

  const current = visible ? popups.find((p) => p.id === visible) : null;

  if (!current) return null;

  const dismiss = () => suivante.current();

  function handleCta() {
    if (!current) return;
    // Track click
    fetch("/api/popups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, trackClick: true }),
    }).catch(() => null);
    // « produits » → /boutique/produits (comme les boutons du Constructeur) ; jamais un lien « javascript: ».
    const lien = hrefBoutique(slug, current.ctaUrl);
    if (lien && !/^javascript:/i.test(lien)) window.location.href = lien;
    dismiss();
  }

  // Bandeau
  if (current.type === "bandeau") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] px-4 py-3 text-white text-center text-[13px] flex items-center justify-between gap-4" style={{ background: accentColor }}>
        <div className="flex-1 text-center">
          <strong>{t(current.titre)}</strong> — {t(current.message)}
          {current.codePromo && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded font-mono text-xs">{t(current.codePromo)}</span>}
          {current.ctaTexte && current.ctaUrl && (
            <button onClick={handleCta} className="ml-3 underline font-semibold">{t(current.ctaTexte)}</button>
          )}
        </div>
        <button onClick={dismiss} className="shrink-0 hover:bg-white/10 p-1 rounded"><X size={14} /></button>
      </div>
    );
  }

  // Slide-in : carte dans le coin, sans voile ni blocage de la page.
  if (current.type === "slide_in") {
    return (
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] sm:w-80 bg-white rounded-2xl shadow-2xl p-5 border border-[#F0F0F0]">
        <button onClick={dismiss} aria-label={t("Fermer")} className="absolute top-2.5 right-2.5 p-1.5 rounded-lg hover:bg-[#F5F5F5]">
          <X size={14} className="text-[#888]" />
        </button>
        {current.imageUrl && <img src={current.imageUrl} alt="" className="w-full h-28 object-cover rounded-xl mb-3" />}
        <h3 className="text-[15px] font-bold text-[#111] mb-1 pr-6">{t(current.titre)}</h3>
        <p className="text-[13px] text-[#666] mb-3">{t(current.message)}</p>
        {current.codePromo && (
          <p className="text-[15px] font-bold tracking-widest text-center rounded-lg py-2 mb-3 bg-[#FFF8EC]" style={{ color: accentColor }}>{t(current.codePromo)}</p>
        )}
        {current.ctaTexte && (
          <button onClick={handleCta} className="w-full py-2.5 rounded-xl text-white font-semibold text-[13px]" style={{ background: accentColor }}>
            {t(current.ctaTexte)}
          </button>
        )}
      </div>
    );
  }

  // Popup centré
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm px-4" onClick={dismiss}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={dismiss} className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-[#F5F5F5]">
          <X size={15} className="text-[#888]" />
        </button>
        {current.imageUrl && (
          <img src={current.imageUrl} alt={current.titre} className="w-full h-36 object-cover rounded-xl mb-4" />
        )}
        <h3 className="text-[17px] font-bold text-[#111] mb-2">{t(current.titre)}</h3>
        <p className="text-[13px] text-[#666] mb-3">{t(current.message)}</p>
        {current.codePromo && (
          <div className="bg-[#FFF8EC] border border-[#F5A623]/30 rounded-xl px-4 py-2.5 text-center mb-3">
            <p className="text-[11px] text-[#888]">{t("Code promo")}</p>
            <p className="text-[18px] font-bold tracking-widest" style={{ color: accentColor }}>{t(current.codePromo)}</p>
          </div>
        )}
        {current.ctaTexte && (
          <button
            onClick={handleCta}
            className="w-full py-3 rounded-xl text-white font-semibold text-[14px]"
            style={{ background: accentColor }}
          >
            {t(current.ctaTexte)}
          </button>
        )}
      </div>
    </div>
  );
}
