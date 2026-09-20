"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

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
  const [popups, setPopups] = useState<Popup[]>([]);
  const [visible, setVisible] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/popups?slug=${slug}`)
      .then((r) => r.json())
      .then((d) => setPopups(d.popups ?? []))
      .catch(() => null);
  }, [slug]);

  useEffect(() => {
    if (!popups.length) return;

    // Session-based tracking
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem("axso_popups_seen") ?? "[]"));

    for (const popup of popups) {
      if (seen.has(popup.id) || dismissed.has(popup.id)) continue;

      if (popup.declencheur === "premiere_visite") {
        const key = `axso_pv_${popup.id}`;
        if (localStorage.getItem(key)) continue;
        localStorage.setItem(key, "1");
      }

      if (popup.declencheur === "delai") {
        const timer = setTimeout(() => {
          setVisible(popup.id);
          seen.add(popup.id);
          sessionStorage.setItem("axso_popups_seen", JSON.stringify([...seen]));
          // Track view
          fetch("/api/popups", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: popup.id, trackView: true }),
          }).catch(() => null);
        }, popup.delaiSec * 1000);
        return () => clearTimeout(timer);
      }

      if (popup.declencheur === "premiere_visite") {
        setTimeout(() => {
          setVisible(popup.id);
          seen.add(popup.id);
          sessionStorage.setItem("axso_popups_seen", JSON.stringify([...seen]));
        }, 500);
      }
    }
  }, [popups, dismissed]);

  // Exit intent
  useEffect(() => {
    const exitPopup = popups.find((p) => p.declencheur === "exit_intent");
    if (!exitPopup) return;

    function onMouseLeave(e: MouseEvent) {
      if (e.clientY <= 5 && !dismissed.has(exitPopup!.id)) {
        setVisible(exitPopup!.id);
      }
    }
    document.addEventListener("mouseleave", onMouseLeave);
    return () => document.removeEventListener("mouseleave", onMouseLeave);
  }, [popups, dismissed]);

  const current = visible ? popups.find((p) => p.id === visible) : null;

  if (!current) return null;

  function dismiss() {
    if (!current) return;
    setDismissed((prev) => new Set([...prev, current.id]));
    setVisible(null);
  }

  function handleCta() {
    if (!current) return;
    // Track click
    fetch("/api/popups", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, trackClick: true }),
    }).catch(() => null);
    if (current.ctaUrl) {
      window.location.href = current.ctaUrl;
    }
    dismiss();
  }

  // Bandeau
  if (current.type === "bandeau") {
    return (
      <div className="fixed top-0 left-0 right-0 z-[100] px-4 py-3 text-white text-center text-[13px] flex items-center justify-between gap-4" style={{ background: accentColor }}>
        <div className="flex-1 text-center">
          <strong>{current.titre}</strong> — {current.message}
          {current.codePromo && <span className="ml-2 bg-white/20 px-2 py-0.5 rounded font-mono text-xs">{current.codePromo}</span>}
          {current.ctaTexte && current.ctaUrl && (
            <button onClick={handleCta} className="ml-3 underline font-semibold">{current.ctaTexte}</button>
          )}
        </div>
        <button onClick={dismiss} className="shrink-0 hover:bg-white/10 p-1 rounded"><X size={14} /></button>
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
        <h3 className="text-[17px] font-bold text-[#111] mb-2">{current.titre}</h3>
        <p className="text-[13px] text-[#666] mb-3">{current.message}</p>
        {current.codePromo && (
          <div className="bg-[#FFF8EC] border border-[#F5A623]/30 rounded-xl px-4 py-2.5 text-center mb-3">
            <p className="text-[11px] text-[#888]">Code promo</p>
            <p className="text-[18px] font-bold tracking-widest" style={{ color: accentColor }}>{current.codePromo}</p>
          </div>
        )}
        {current.ctaTexte && (
          <button
            onClick={handleCta}
            className="w-full py-3 rounded-xl text-white font-semibold text-[14px]"
            style={{ background: accentColor }}
          >
            {current.ctaTexte}
          </button>
        )}
      </div>
    </div>
  );
}
