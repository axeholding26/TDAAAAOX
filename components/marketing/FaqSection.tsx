"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Minus } from "lucide-react";

const faqs = [
  { q: "Est-ce vraiment gratuit ?", r: "Oui, 100% gratuit pour créer et gérer votre boutique. Axso ne prend que 3% sur chaque vente réussie. Aucun abonnement, aucune mensualité." },
  { q: "Comment mes clients paient-ils ?", r: "Tous les modes de paiement africains sont intégrés : MTN Mobile Money, Orange Money, Wave, Visa/Mastercard, et plus encore selon votre pays. La configuration prend 2 minutes." },
  { q: "Puis-je utiliser mon propre nom de domaine ?", r: "Oui ! Vous obtenez d'abord une URL gratuite (votre-boutique.axso.com), puis vous pouvez connecter votre propre domaine depuis les paramètres." },
  { q: "L'assistant IA parle-t-il français ?", r: "Absolument. L'IA d'Axso est configurée pour comprendre et répondre en français (et en anglais). Elle connaît les marchés africains et peut vous aider à rédiger vos fiches produits." },
  { q: "Ai-je besoin de compétences techniques ?", r: "Aucune. Le constructeur Axso fonctionne par glisser-déposer, sans code. Décrivez votre boutique à Axia et elle configure l'essentiel à votre place en quelques minutes." },
  { q: "Puis-je importer mes produits depuis un fichier Excel ?", r: "Oui, Axso accepte l'import CSV avec un template téléchargeable. Importez des centaines de produits en quelques secondes." },
  { q: "Comment gérer plusieurs vendeurs sur ma boutique ?", r: "Depuis la section Équipe du dashboard, vous pouvez inviter des collaborateurs avec des rôles différents : Admin, Éditeur ou Livreur." },
  { q: "Les notifications WhatsApp sont-elles automatiques ?", r: "Oui ! Chaque nouvelle commande vous est notifiée sur WhatsApp. Vos clients reçoivent automatiquement la confirmation et le numéro de suivi." },
  { q: "Puis-je vendre dans plusieurs pays africains ?", r: "Oui, Axso supporte 23 pays africains. Vous pouvez configurer des zones de livraison et des tarifs différents selon les pays." },
  { q: "Et si j'ai besoin d'aide ?", r: "Notre support est disponible 24/7 via WhatsApp. Une documentation complète en français est disponible, et l'IA intégrée peut répondre à toutes vos questions." },
];

export function FaqSection() {
  const [ouvert, setOuvert] = useState<number | null>(0);
  const [visible, setVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 bg-gray-50/50 relative overflow-hidden" id="faq">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-[#F5A623]/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div
          className="text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.7s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          <span className="text-[#111111] text-sm font-semibold uppercase tracking-widest mb-4 block">FAQ</span>
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900">Questions fréquentes</h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className={`rounded-2xl border-2 transition-all duration-300 hover:scale-[1.005] ${
                ouvert === i ? "bg-white shadow-md shadow-[#F5A623]/10" : "bg-white hover:border-gray-200"
              }`}
              style={{
                opacity: visible ? 1 : 0,
                animation: visible ? `slideRevealLeft 0.5s ${i * 60}ms cubic-bezier(0.23,1,0.32,1) both` : "none",
                borderColor: ouvert === i ? "rgba(245,166,35,0.45)" : "#f3f4f6",
                boxShadow: ouvert === i ? "0 8px 30px rgba(245,166,35,0.10), 0 0 0 1px rgba(245,166,35,0.18)" : "none",
              }}
            >
              <button
                onClick={() => setOuvert(ouvert === i ? null : i)}
                className="w-full flex items-center justify-between p-6 text-left"
              >
                <span className={`font-semibold transition-colors duration-200 ${ouvert === i ? "text-[#111111]" : "text-gray-800"}`}>
                  {faq.q}
                </span>
                <div
                  className={`flex-shrink-0 ml-4 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                    ouvert === i ? "bg-[#111111] border-[#111111] scale-110 shadow-md shadow-[#111111]/25" : "border-gray-200 hover:border-[#F5A623]/50"
                  }`}
                  style={{
                    transform: ouvert === i ? "rotate(0deg) scale(1.1)" : "rotate(0deg) scale(1)",
                  }}
                >
                  {ouvert === i
                    ? <Minus size={13} className="text-white" />
                    : <Plus size={13} className="text-gray-400" />
                  }
                </div>
              </button>
              <div
                className="overflow-hidden transition-all duration-300"
                style={{
                  maxHeight: ouvert === i ? "500px" : "0",
                  opacity: ouvert === i ? 1 : 0,
                }}
              >
                <div className="px-6 pb-6">
                  <p className="text-gray-500 leading-relaxed">{faq.r}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
