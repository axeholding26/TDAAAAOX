"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mic, Zap } from "lucide-react";
import { useT } from "@/components/I18nProvider";

// Conversation jouée message par message quand la section arrive à l'écran.
const CONVERSATION: { de: "marchand" | "axia"; texte: string }[] = [
  { de: "marchand", texte: "Salut Axia, comment s'est passée ma semaine ?" },
  { de: "axia",     texte: "Très bonne semaine : 47 commandes et 1 284 000 XOF de ventes, soit +18 % par rapport à la semaine dernière. Tes sneakers sont ton best-seller." },
  { de: "marchand", texte: "Il m'en reste combien ?" },
  { de: "axia",     texte: "Plus que 6 paires en 42 et 3 en 43. À ce rythme, tu seras en rupture d'ici jeudi. Tu veux que je prépare une commande fournisseur ?" },
  { de: "marchand", texte: "Oui. Et ajoute une promo -20% sur mes sneakers ce week-end" },
  { de: "axia",     texte: "C'est fait ✓ La promo est active du samedi 00h00 au dimanche 23h59, et j'ai notifié tes 3 derniers clients intéressés." },
];
const RYTHME_MS = 1500;

export function AxiaSection() {
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [affiches, setAffiches] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const iv = setInterval(() => setAffiches(n => {
      if (n + 1 >= CONVERSATION.length) clearInterval(iv);
      return Math.min(n + 1, CONVERSATION.length);
    }), RYTHME_MS);
    return () => clearInterval(iv);
  }, [visible]);
  // Axia « écrit… » pendant l'attente de sa prochaine réponse.
  const axiaEcrit = visible && affiches < CONVERSATION.length && CONVERSATION[affiches].de === "axia";

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold: 0.15 });
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-24 overflow-hidden" style={{ background: "#FAFAFA" }}>
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center max-w-[1400px] mx-auto">

          <div className="order-2 lg:order-1" style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(-24px)", transition: "all 0.8s cubic-bezier(0.23,1,0.32,1)" }}>
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5 sm:p-6 max-w-lg">
              <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#111111" }}>
                  <img src="/axia-icon.png" alt={t("Axia")} className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#111111]">{t("Axia")}</p>
                  <p className="text-[11px] text-gray-400">{t("Ton assistante IA")}</p>
                </div>
                <Mic size={16} className="ml-auto text-gray-300" />
              </div>
              <div className="h-[580px] sm:h-[520px] flex flex-col justify-end gap-3 overflow-hidden">
                {CONVERSATION.slice(0, affiches).map((m, i) => (
                  <div key={i} className={`flex ${m.de === "marchand" ? "justify-end" : "justify-start"}`}
                    style={{ animation: "slideRevealLeft 0.45s cubic-bezier(0.23,1,0.32,1) both" }}>
                    <div className={`rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed max-w-[85%] ${m.de === "marchand" ? "text-white rounded-br-md" : "bg-gray-50 text-gray-700 border border-gray-100 rounded-bl-md"}`}
                      style={m.de === "marchand" ? { background: "#F5A623" } : undefined}>
                      {t(m.texte)}
                    </div>
                  </div>
                ))}
                {axiaEcrit && (
                  <div className="flex justify-start" aria-hidden>
                    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-gray-50 border border-gray-100 flex gap-1">
                      {[0, 150, 300].map(d => (
                        <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 pl-4 pr-1.5 py-1.5" aria-hidden>
                <span className="flex-1 text-[13px] text-gray-400">{t("Écris à Axia…")}</span>
                <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#111111" }}>
                  <Mic size={14} style={{ color: "#F5A623" }} />
                </span>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2" style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.8s 0.1s cubic-bezier(0.23,1,0.32,1)" }}>
            <div className="w-full h-[280px] sm:h-[340px] lg:h-[380px] mb-2 -mt-4">
              <Image src="/axia-icon.png" alt={t("Axia")} width={380} height={380} className="w-full h-full object-contain" />
            </div>
            <span className="text-[#F5A623] text-sm font-bold uppercase tracking-widest mb-4 block">{t("Assistante IA")}</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111111] mb-5 leading-[1.08]">
              {t("Rencontre Axia, ta copilote au quotidien")}
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
              {t("Parle-lui à l'écrit ou à la voix : elle configure ta boutique, répond à tes clients, lance des promotions et t'alerte sur ce qui compte — 24h/24.")}
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
              <Zap size={14} style={{ color: "#F5A623" }} />{" "}{t("Comprend le français, disponible en interface vocale")}
            </div>
            <Link href="/inscription" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: "#111111" }}>
              {t("Parler à Axia →")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
