"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const LIENS = [
  { label: "Fonctionnalités", href: "/fonctionnalites" },
  { label: "Tarifs",          href: "/#tarifs"         },
  { label: "Affiliation",     href: "/affiliation"     },
  { label: "Témoignages",     href: "/temoignages"     },
  { label: "Contact",         href: "/contact"         },
];

export function NavbarMarketing() {
  const [scrolled,    setScrolled]    = useState(false);
  const [hovered,     setHovered]     = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const collapseRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded    = !scrolled || hovered;

  /* ── scroll listener (throttlé via rAF, cf. VideoSection.tsx) ── */
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        setScrolled(window.scrollY > 56);
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onEnter = () => { if (collapseRef.current) clearTimeout(collapseRef.current); setHovered(true); };
  const onLeave = () => { collapseRef.current = setTimeout(() => setHovered(false), 320); };

  return (
    <>
      <style>{`
        @keyframes axGlow {
          0%,100% { opacity:.5; transform:translateX(-50%) scaleX(.7); }
          50%      { opacity:1;  transform:translateX(-50%) scaleX(1);  }
        }
        @keyframes axFadeUp {
          from { opacity:0; transform:translateY(10px); }
          to   { opacity:1; transform:translateY(0);    }
        }
        @keyframes axSheetOpen {
          from { opacity:0; transform:translateY(-6px) scale(.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);   }
        }
        .ax-nl:hover  { color:#fff !important; background:rgba(255,255,255,.1) !important; }
        .ax-cta:hover { transform:scale(1.05) !important; box-shadow:0 6px 26px rgba(245,166,35,.7) !important; }
        .ax-ml:hover  { background:rgba(255,255,255,.08) !important; color:#fff !important; }
        .ax-desktop { display:none; }
        @media (min-width:768px) { .ax-desktop { display:flex; } }
        .ax-mobile  { display:flex; }
        @media (min-width:768px) { .ax-mobile  { display:none; } }
      `}</style>

      <nav
        aria-label="Navigation principale"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: "14px",
          fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif",
          pointerEvents: "none",
        }}
      >
        {/* ── Ambient glow ─────────────────────────────────────────────── */}
        <div style={{
          position: "absolute", top: 0, left: "50%",
          width: "600px", height: "90px",
          background: "radial-gradient(ellipse at top, rgba(245,166,35,.14) 0%, transparent 68%)",
          pointerEvents: "none",
          animation: "axGlow 4s ease-in-out infinite",
          transition: "opacity .5s ease",
          opacity: isExpanded ? 1 : .4,
        }} />

        {/* ── Desktop island ───────────────────────────────────────────── */}
        <div
          className="ax-desktop"
          onMouseEnter={onEnter}
          onMouseLeave={onLeave}
          style={{
            alignItems: "center",
            pointerEvents: "auto",
            background: "#111111",
            borderRadius: "999px",
            padding: isExpanded ? "8px 10px 8px 18px" : "7px 12px",
            width: isExpanded
              ? "min(1120px, calc(100vw - 32px))"
              : "min(190px, calc(100vw - 32px))",
            transition:
              "width .55s cubic-bezier(.34,1.56,.64,1), padding .4s ease, box-shadow .35s ease",
            boxShadow: scrolled
              ? "0 16px 56px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.07)"
              : "0 8px 36px rgba(0,0,0,.28), 0 2px 8px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.06)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* Logo */}
          <Link href="/" style={{ display:"flex", alignItems:"center", flexShrink:0, textDecoration:"none", zIndex:2 }}>
            <img
              src="/logo-dark.png" alt="axso"
              style={{
                height: isExpanded ? "42px" : "32px",
                width: "auto", objectFit: "contain",
                transition: "height .45s cubic-bezier(.34,1.56,.64,1)",
              }}
            />
          </Link>

          {/* Nav links — centre */}
          <div style={{
            display: "flex", alignItems: "center", gap: "2px",
            flex: 1, justifyContent: "center",
            opacity:    isExpanded ? 1 : 0,
            transform:  isExpanded ? "none" : "scale(.9) translateX(-12px)",
            transition: isExpanded
              ? "opacity .3s ease .14s, transform .45s cubic-bezier(.34,1.56,.64,1) .08s"
              : "opacity .15s ease, transform .25s ease",
            pointerEvents: isExpanded ? "auto" : "none",
          }}>
            {LIENS.map(l => (
              <a key={l.href} href={l.href} className="ax-nl" style={{
                padding: "7px 17px",
                borderRadius: "999px",
                fontSize: "13.5px", fontWeight: 500,
                color: "rgba(255,255,255,.6)",
                textDecoration: "none", whiteSpace: "nowrap",
                transition: "color .15s, background .15s",
              }}>
                {l.label}
              </a>
            ))}
          </div>

          {/* CTAs — droite */}
          <div style={{
            display: "flex", alignItems: "center", gap: "6px", flexShrink: 0,
            opacity:    isExpanded ? 1 : 0,
            transform:  isExpanded ? "none" : "translateX(20px)",
            transition: isExpanded
              ? "opacity .3s ease .2s, transform .45s cubic-bezier(.34,1.56,.64,1) .12s"
              : "opacity .12s ease, transform .2s ease",
            pointerEvents: isExpanded ? "auto" : "none",
          }}>
            <Link href="/connexion" style={{
              padding: "7px 17px", borderRadius: "999px",
              fontSize: "13px", fontWeight: 500,
              color: "rgba(255,255,255,.5)", textDecoration: "none",
              whiteSpace: "nowrap", transition: "color .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.color = "#fff"}
            onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,.5)"}
            >
              Connexion
            </Link>
            <Link href="/inscription" className="ax-cta" style={{
              padding: "9px 22px", borderRadius: "999px",
              fontSize: "13px", fontWeight: 700,
              color: "#080808", background: "#F5A623",
              textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: "0 3px 16px rgba(245,166,35,.52)",
              transition: "transform .18s, box-shadow .18s",
              display: "inline-block",
            }}>
              Créer ma boutique gratuite&nbsp;→
            </Link>
          </div>

          {/* Compact indicator — visible quand îlot fermé (absolue, n'affecte pas le flux) */}
          <div style={{
            position: "absolute", right: "12px",
            display: "flex", alignItems: "center", gap: "8px",
            opacity:       isExpanded ? 0 : 1,
            pointerEvents: isExpanded ? "none" : "auto",
            transition:    isExpanded ? "opacity .1s ease" : "opacity .25s ease .15s",
          }}>
            <Link href="/inscription" style={{
              padding: "7px 18px", borderRadius: "999px",
              fontSize: "12.5px", fontWeight: 700,
              color: "#080808", background: "#F5A623",
              textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: "0 2px 12px rgba(245,166,35,.45)",
            }}>
              →
            </Link>
          </div>
        </div>

        {/* ── Mobile island — s'expand en place (vrai Dynamic Island) ── */}
        <div
          className="ax-mobile"
          style={{
            flexDirection: "column",
            pointerEvents: "auto",
            background: "#111111",
            borderRadius: mobileOpen ? "28px" : "999px",
            width: "calc(100vw - 28px)",
            overflow: "hidden",
            boxShadow: mobileOpen
              ? "0 20px 60px rgba(0,0,0,.55), 0 4px 14px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.07)"
              : "0 10px 40px rgba(0,0,0,.38), 0 2px 8px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.06)",
            transition: "border-radius .5s cubic-bezier(.34,1.56,.64,1), box-shadow .4s ease",
          }}
        >
          {/* ── Ligne du haut — toujours visible ── */}
          <div style={{ display:"flex", alignItems:"center", padding:"7px 10px 7px 16px", gap:"8px" }}>
            <Link href="/" style={{ display:"flex", alignItems:"center", textDecoration:"none", flexShrink:0 }}>
              <img src="/logo-dark.png" alt="axso" style={{
                height: mobileOpen ? "34px" : "30px",
                objectFit:"contain",
                transition: "height .4s cubic-bezier(.34,1.56,.64,1)",
              }} />
            </Link>
            <div style={{ flex: 1 }} />
            {/* CTA masqué quand ouvert */}
            <Link href="/inscription" style={{
              padding: "7px 16px", borderRadius: "999px",
              fontSize: "12.5px", fontWeight: 700,
              color: "#080808", background: "#F5A623",
              textDecoration: "none", whiteSpace: "nowrap",
              boxShadow: "0 2px 10px rgba(245,166,35,.4)",
              opacity: mobileOpen ? 0 : 1,
              transform: mobileOpen ? "scale(.75)" : "scale(1)",
              transition: "opacity .2s ease, transform .3s cubic-bezier(.34,1.56,.64,1)",
              pointerEvents: mobileOpen ? "none" : "auto",
            }}>
              Créer gratuitement
            </Link>
            <button
              onClick={() => setMobileOpen(v => !v)}
              style={{
                width: "36px", height: "36px", borderRadius: "50%",
                border: "1px solid rgba(255,255,255,.15)",
                background: mobileOpen ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.06)",
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
                transition: "background .2s, transform .45s cubic-bezier(.34,1.56,.64,1)",
                transform: mobileOpen ? "rotate(45deg)" : "none",
              }}
              aria-label="Menu"
            >
              {mobileOpen ? <X size={15} /> : <Menu size={15} />}
            </button>
          </div>

          {/* ── Contenu expandable ── */}
          <div style={{
            maxHeight: mobileOpen ? "420px" : "0",
            opacity: mobileOpen ? 1 : 0,
            overflow: "hidden",
            transition: "max-height .5s cubic-bezier(.34,1.56,.64,1), opacity .3s ease",
          }}>
            <div style={{ padding: "0 12px 16px" }}>
              <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: "10px" }}>
                {LIENS.map((l, i) => (
                  <a
                    key={l.href} href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className="ax-ml"
                    style={{
                      display: "block",
                      padding: "13px 10px",
                      borderRadius: "14px",
                      fontSize: "15px", fontWeight: 500,
                      color: "rgba(255,255,255,.65)",
                      textDecoration: "none",
                      transition: "background .15s, color .15s",
                      animation: mobileOpen ? `axFadeUp .32s ease ${i * 0.07}s both` : "none",
                    }}
                  >
                    {l.label}
                  </a>
                ))}
                <div style={{
                  display: "flex", gap: "8px", marginTop: "12px",
                  animation: mobileOpen ? `axFadeUp .32s ease ${LIENS.length * 0.07}s both` : "none",
                }}>
                  <Link href="/connexion" onClick={() => setMobileOpen(false)} style={{
                    flex: 1, display: "block", textAlign: "center",
                    padding: "13px", borderRadius: "16px",
                    border: "1px solid rgba(255,255,255,.13)",
                    fontSize: "14px", fontWeight: 600,
                    color: "rgba(255,255,255,.55)", textDecoration: "none",
                  }}>
                    Connexion
                  </Link>
                  <Link href="/inscription" onClick={() => setMobileOpen(false)} style={{
                    flex: 2, display: "block", textAlign: "center",
                    padding: "13px", borderRadius: "16px",
                    fontSize: "14px", fontWeight: 700,
                    color: "#080808", background: "#F5A623",
                    textDecoration: "none",
                    boxShadow: "0 4px 20px rgba(245,166,35,.5)",
                  }}>
                    Créer ma boutique gratuite
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
}
