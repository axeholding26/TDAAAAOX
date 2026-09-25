"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Mic, Zap } from "lucide-react";

const MSG_USER = "Ajoute une promo -20% sur mes sneakers ce week-end";
const MSG_AXIA  = "C'est fait ✓ La promo est active du samedi 00h00 au dimanche 23h59, et j'ai notifié tes 3 derniers clients intéressés.";

/** Fait apparaître `text` caractère par caractère, façon machine à écrire, une fois `start` vrai. */
function useTypewriter(text: string, start: boolean, speed = 16, startDelay = 0) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (!start) return;
    let i = 0;
    const startTimer = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setOut(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, speed);
    }, startDelay);
    return () => clearTimeout(startTimer);
  }, [text, start, speed, startDelay]);
  return out;
}

export function AxiaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const axiaTyped = useTypewriter(MSG_AXIA, visible, 15, 950);
  const axiaDone = axiaTyped.length >= MSG_AXIA.length;

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
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-5 sm:p-6 max-w-md">
              <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-gray-100">
                <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: "#111111" }}>
                  <img src="/axia-icon.png" alt="Axia" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-bold text-sm text-[#111111]">Axia</p>
                  <p className="text-[11px] text-gray-400">Ton assistante IA</p>
                </div>
                <Mic size={16} className="ml-auto text-gray-300" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-end"
                  style={{ opacity: visible ? 1 : 0, animation: visible ? "slideRevealLeft 0.5s 300ms cubic-bezier(0.23,1,0.32,1) both" : "none" }}>
                  <div className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed max-w-[85%] text-white" style={{ background: "#F5A623" }}>
                    {MSG_USER}
                  </div>
                </div>
                {visible && (
                  <div className="flex justify-start" style={{ animation: "slideRevealLeft 0.4s 750ms cubic-bezier(0.23,1,0.32,1) both" }}>
                    <div className="rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed max-w-[85%] bg-gray-50 text-gray-700 border border-gray-100 min-h-[2.5em]">
                      {axiaTyped}
                      {!axiaDone && <span className="inline-block w-[2px] h-[13px] ml-0.5 align-middle animate-pulse" style={{ background: "#F5A623" }} />}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2" style={{ opacity: visible ? 1 : 0, transform: visible ? "none" : "translateX(24px)", transition: "all 0.8s 0.1s cubic-bezier(0.23,1,0.32,1)" }}>
            <div className="w-full h-[280px] sm:h-[340px] lg:h-[380px] mb-2 -mt-4">
              <Image src="/axia-icon.png" alt="Axia" width={380} height={380} className="w-full h-full object-contain" />
            </div>
            <span className="text-[#F5A623] text-sm font-bold uppercase tracking-widest mb-4 block">Assistante IA</span>
            <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-[#111111] mb-5 leading-[1.08]">
              Rencontre Axia, ta copilote au quotidien
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
              Parle-lui à l'écrit ou à la voix : elle configure ta boutique, répond à tes clients, lance des promotions et t'alerte sur ce qui compte — 24h/24.
            </p>
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
              <Zap size={14} style={{ color: "#F5A623" }} /> Comprend le français, disponible en interface vocale
            </div>
            <Link href="/inscription" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl font-bold text-white transition-transform hover:scale-[1.03]"
              style={{ background: "#111111" }}>
              Parler à Axia →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
