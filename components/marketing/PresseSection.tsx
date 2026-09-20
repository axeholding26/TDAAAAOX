"use client";
import { useEffect, useRef, useState } from "react";

const medias = [
  "Jeune Afrique",
  "Africa Business+",
  "Le Monde Afrique",
  "Tech en Afrique",
  "Forbes Africa",
  "Afrique IT",
];

export function PresseSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    if (sectionRef.current) obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="py-16 bg-gray-50 border-y border-gray-100 overflow-hidden">
      <div className="w-full px-6 sm:px-10 lg:px-16 xl:px-24">
        <p
          className="text-center text-gray-300 text-sm uppercase tracking-widest mb-10"
          style={{
            opacity: visible ? 1 : 0,
            animation: visible ? "flip3dIn 0.6s cubic-bezier(0.23,1,0.32,1) both" : "none",
          }}
        >
          Vu dans
        </p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-8">
          {medias.map((media, i) => (
            <div
              key={i}
              className="flex items-center justify-center h-12 cursor-default group"
              style={{
                opacity: visible ? 0.4 : 0,
                animation: visible ? `slideRevealLeft 0.5s ${i * 80}ms cubic-bezier(0.23,1,0.32,1) both` : "none",
              }}
            >
              <span
                className="text-gray-500 font-bold text-xs sm:text-sm text-center transition-all duration-300 group-hover:opacity-100 group-hover:text-[#1B4FD8] group-hover:scale-110"
                style={{
                  filter: "blur(0px)",
                  transition: "opacity 0.3s, color 0.3s, transform 0.3s, text-shadow 0.3s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.textShadow = "0 0 20px rgba(27,79,216,0.5)";
                  (e.currentTarget.parentElement as HTMLElement).style.opacity = "1";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.textShadow = "none";
                  (e.currentTarget.parentElement as HTMLElement).style.opacity = "0.4";
                }}
              >
                {media}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
