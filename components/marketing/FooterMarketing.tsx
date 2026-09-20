"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Globe } from "lucide-react";

const liens = {
  Produit: [
    { label: "Paliers d'empire", href: "/#tarifs" },
    { label: "Thèmes", href: "/themes" },
    { label: "Intégrations paiements", href: "/#paiements" },
    { label: "Fonctionnalités", href: "/#fonctionnalites" },
    { label: "Devenir affilié", href: "/affiliation" },
  ],
  Ressources: [
    { label: "Blog", href: "/blog" },
    { label: "Documentation", href: "/docs" },
    { label: "Tutoriels vidéo", href: "/tutorials" },
    { label: "Communauté", href: "/community" },
  ],
  Entreprise: [
    { label: "À propos", href: "/about" },
    { label: "Carrières", href: "/jobs" },
    { label: "Presse", href: "/press" },
    { label: "Contact", href: "/contact" },
  ],
  Légal: [
    { label: "Conditions d'utilisation", href: "/legal/cgu" },
    { label: "Politique de confidentialité", href: "/legal/privacy" },
    { label: "Cookies", href: "/legal/cookies" },
    { label: "Abonnements", href: "/legal/abonnements" },
  ],
};

export function FooterMarketing() {
  const footerRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.1 });
    if (footerRef.current) obs.observe(footerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <footer ref={footerRef} className="bg-[#111111] pt-16 pb-8"
      style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(20px)", transition: "opacity 0.8s cubic-bezier(0.23,1,0.32,1), transform 0.8s cubic-bezier(0.23,1,0.32,1)" }}>
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <img src="/logo-dark.png" alt="axso" style={{ height: "34px", width: "auto", objectFit: "contain" }} />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-2">
              Vends partout. Encaisse facilement. Grandis sans limite.
            </p>
            <p className="text-gray-500 text-xs leading-relaxed mb-5">
              AXSO est la plateforme e-commerce faite pour l'Afrique.
            </p>
            <div className="flex gap-3">
              {(["𝕏", "f", null, "in"] as (string | null)[]).map((s, i) => (
                <a key={i} href="#"
                  className="w-8 h-8 rounded-lg bg-[#1F1F1F] flex items-center justify-center text-gray-400 hover:text-[#F5A623] hover:bg-[#2A2A2A] transition-all text-xs font-bold">
                  {s === null ? <Camera size={14} /> : s}
                </a>
              ))}
            </div>
          </div>

          {Object.entries(liens).map(([section, items]) => (
            <div key={section}>
              <h4 className="text-white font-semibold mb-4 text-sm">{section}</h4>
              <ul className="space-y-2.5">
                {items.map((lien) => (
                  <li key={lien.label}>
                    <Link href={lien.href} className="text-gray-400 text-sm hover:text-[#F5A623] transition-colors">
                      {lien.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-[#262626] pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm">© {new Date().getFullYear()} AXSO Technologies. Tous droits réservés.</p>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1"><Globe size={13} /> Français</span>
            <span>|</span>
            <span className="inline-flex items-center gap-1"><Globe size={13} /> English</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
