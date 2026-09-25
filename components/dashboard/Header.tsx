"use client";
import { useState, useEffect, useRef } from "react";
import { ecouterNotifications } from "@/components/dashboard/AlerteCommande";
import Link from "next/link";
import { basculerBoutique } from "@/components/dashboard/BoutiqueSwitcher";
import {
  Search, Bell, ChevronDown, LogOut, Settings,
  User, ExternalLink, Store, X, ShoppingBag, DollarSign, Star,
  Package, AlertTriangle, MessageCircle, Info,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { initiales } from "@/lib/utils";
import type { Session } from "next-auth";

interface HeaderProps {
  session:     Session;
  boutiqueSlug?: string;
  boutiqueNom?:  string;
}

interface NotifMarchand {
  id: string; type: string; titre: string; message: string;
  lien?: string | null; lu: boolean; createdAt: string;
  tenantId: string; nomBoutique: string; autreBoutique: boolean;
}

const NOTIF_ICONS: Record<string, { Icon: any; color: string }> = {
  nouvelle_commande:   { Icon: ShoppingBag,    color: "#D97706" },
  commande_whatsapp:   { Icon: MessageCircle,  color: "#25D366" },
  escalade_humain:     { Icon: AlertTriangle,  color: "#DC2626" },
  paiement:            { Icon: DollarSign,     color: "#16A34A" },
  avis:                { Icon: Star,           color: "#F59E0B" },
  stock_bas:           { Icon: Package,        color: "#DC2626" },
};
function iconPourType(type: string) { return NOTIF_ICONS[type] ?? { Icon: Info, color: "#6B7280" }; }
function tempsEcoule(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `Il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

export function Header({ session, boutiqueSlug, boutiqueNom }: HeaderProps) {
  const [profileOpen,   setProfileOpen]   = useState(false);
  const [notifOpen,     setNotifOpen]     = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState<NotifMarchand[]>([]);
  const [nonLues, setNonLues] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const pillRef   = useRef<HTMLDivElement>(null);

  // Données fournies par AlerteCommande (une seule interrogation pour tout le dashboard).
  useEffect(() => ecouterNotifications((d) => { setNotifications(d.notifications); setNonLues(d.nonLues); }), []);

  const marquerToutLu = async () => {
    setNonLues(0);
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })));
    try { await fetch("/api/notifications-marchand", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toutMarquer: true }) }); } catch {}
  };

  const nom      = session.user?.name  || "Marchand";
  const email    = session.user?.email || "";
  const urlLocale = boutiqueSlug ? `/${boutiqueSlug}` : null;

  /* ── Ferme les menus au clic extérieur ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!pillRef.current?.contains(e.target as Node)) {
        setProfileOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleNotif   = () => { setNotifOpen(v => !v);   setProfileOpen(false); };
  const toggleProfile = () => { setProfileOpen(v => !v); setNotifOpen(false);   };

  return (
    <>
      <style>{`
        @keyframes hdrDropIn {
          from { opacity:0; transform:translateY(-10px) scale(.96); }
          to   { opacity:1; transform:translateY(0)     scale(1);   }
        }
        @keyframes hdrPulse {
          0%,100% { box-shadow:0 0 0 0 rgba(245,166,35,0);    }
          50%     { box-shadow:0 0 0 5px rgba(245,166,35,.15); }
        }
        @keyframes hdrBadge {
          0%,100% { transform:scale(1);   }
          50%     { transform:scale(1.25); }
        }
        .hdr-drop { animation:hdrDropIn .24s cubic-bezier(.34,1.56,.64,1) both; }
        .hdr-btn:hover { background:rgba(0,0,0,.055) !important; }
        .hdr-item:hover { background:#f5f5f7 !important; color:#111 !important; }
        .hdr-item-red:hover { background:#fff0f0 !important; }
        .hdr-shop:hover { background:rgba(245,166,35,.14) !important; }
      `}</style>

      <div
        style={{
          position: "sticky", top: 0, zIndex: 40,
          display: "flex", justifyContent: "center",
          padding: "10px 16px 8px",
          fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif",
        }}
      >
        {/* ── The island ─────────────────────────────────────────────── */}
        <div
          ref={pillRef}
          style={{
            display: "flex", alignItems: "center",
            width: "100%",
            background: "rgba(255,255,255,.97)",
            backdropFilter: "blur(28px) saturate(1.4)",
            WebkitBackdropFilter: "blur(28px) saturate(1.4)",
            borderRadius: "999px",
            padding: "6px 8px 6px 14px",
            border: "1px solid rgba(0,0,0,.07)",
            boxShadow: "0 8px 40px rgba(0,0,0,.08), 0 2px 6px rgba(0,0,0,.04), inset 0 1px 0 rgba(255,255,255,.9)",
            gap: "8px",
            transition: "box-shadow .35s ease",
          }}
        >
          {/* ── Recherche ─────────────────────────────────────────────── */}
          <div
            onClick={() => searchRef.current?.focus()}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background:    searchFocused ? "#fff" : "rgba(0,0,0,.042)",
              border:        `1px solid ${searchFocused ? "#F5A623" : "rgba(0,0,0,.09)"}`,
              borderRadius:  "999px",
              padding:       "7px 14px",
              width:         searchFocused ? "240px" : "170px",
              cursor:        "text",
              transition:    "width .4s cubic-bezier(.34,1.56,.64,1), border-color .25s, background .25s, box-shadow .25s",
              boxShadow:     searchFocused ? "0 0 0 3px rgba(245,166,35,.12)" : "none",
              flexShrink:    0,
            }}
          >
            <Search
              size={13}
              style={{ color: searchFocused ? "#F5A623" : "#bbb", flexShrink: 0, transition: "color .25s" }}
            />
            <input
              ref={searchRef}
              type="text"
              placeholder="Rechercher…"
              onFocus={() => setSearchFocused(true)}
              onBlur={() =>  setSearchFocused(false)}
              style={{
                background: "transparent", border: "none", outline: "none",
                fontSize: "13px", color: "#333",
                width: "100%", fontFamily: "inherit",
              }}
            />
            {searchFocused && (
              <button
                onMouseDown={e => { e.preventDefault(); if (searchRef.current) searchRef.current.value = ""; }}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#bbb", padding:0, display:"flex", alignItems:"center" }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* ── Logo — centre absolu ───────────────────────────────────── */}
          <div style={{ position:"absolute", left:"50%", transform:"translateX(-50%)", pointerEvents:"auto" }}>
            <Link href="/dashboard" style={{ display:"flex", alignItems:"center", textDecoration:"none" }}>
              <img
                src="/logo.png" alt="axso"
                style={{
                  height: "44px", width: "auto", objectFit: "contain",
                  filter: "drop-shadow(0 2px 6px rgba(0,0,0,.07))",
                  transition: "transform .3s cubic-bezier(.34,1.56,.64,1)",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.04)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
              />
            </Link>
          </div>

          {/* ── Actions droite ─────────────────────────────────────────── */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginLeft:"auto" }}>

            {/* Boutique */}
            {urlLocale && (
              <a
                href={urlLocale} target="_blank" rel="noopener noreferrer"
                className="hdr-shop hidden lg:flex"
                style={{
                  alignItems: "center", gap: "6px",
                  background: "rgba(245,166,35,.07)",
                  border: "1px solid rgba(245,166,35,.22)",
                  color: "#c47c0a",
                  fontSize: "12px", fontWeight: 600,
                  padding: "6px 13px", borderRadius: "999px",
                  textDecoration: "none", whiteSpace: "nowrap",
                  transition: "background .2s",
                  flexShrink: 0,
                }}
              >
                <Store size={12} />
                {boutiqueNom ? boutiqueNom.slice(0, 14) : "Ma boutique"}
                <ExternalLink size={10} />
              </a>
            )}

            {/* ── Notifications ─────────────────────────────────────── */}
            <div style={{ position: "relative" }}>
              <button
                onClick={toggleNotif}
                className="hdr-btn"
                style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: notifOpen ? "rgba(0,0,0,.06)" : "transparent",
                  border: "1px solid rgba(0,0,0,.09)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", position: "relative", flexShrink: 0,
                  transition: "background .2s, box-shadow .3s",
                  animation: "hdrPulse 3s ease-in-out infinite",
                }}
                aria-label="Notifications"
              >
                <Bell size={15} style={{ color: "#555" }} />
                {nonLues > 0 && (
                  <span style={{
                    position: "absolute", top: "-2px", right: "-2px",
                    minWidth: "15px", height: "15px", padding: "0 3px",
                    background: "#F5A623", borderRadius: "999px",
                    fontSize: "8px", fontWeight: 800, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    border: "2px solid #fff",
                    animation: "hdrBadge 2.5s ease-in-out infinite",
                  }}>{nonLues > 9 ? "9+" : nonLues}</span>
                )}
              </button>

              {notifOpen && (
                <div className="hdr-drop" style={{
                  position: "absolute", right: 0, top: "44px",
                  width: "310px",
                  background: "#fff",
                  border: "1px solid rgba(0,0,0,.07)",
                  borderRadius: "22px",
                  boxShadow: "0 24px 64px rgba(0,0,0,.13), 0 4px 14px rgba(0,0,0,.07)",
                  overflow: "hidden", zIndex: 100,
                }}>
                  <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid #f2f2f2", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <span style={{ fontSize:"13px", fontWeight:700, color:"#111" }}>Notifications</span>
                    {nonLues > 0 && (
                      <span style={{ fontSize:"11px", fontWeight:600, color:"#F5A623", background:"rgba(245,166,35,.1)", padding:"3px 9px", borderRadius:"999px" }}>{nonLues} nouvelle{nonLues > 1 ? "s" : ""}</span>
                    )}
                  </div>
                  {notifications.length === 0 && (
                    <div style={{ padding: "28px 18px", textAlign: "center" }}>
                      <Bell size={20} style={{ color: "#ddd", margin: "0 auto 8px" }} />
                      <p style={{ fontSize: "12px", color: "#aaa" }}>Aucune notification pour l'instant</p>
                    </div>
                  )}
                  {notifications.map((n, i) => {
                    const { Icon, color } = iconPourType(n.type);
                    const content = (
                      <div key={n.id} className="hdr-item" style={{
                        display:"flex", alignItems:"flex-start", gap:"12px",
                        padding:"13px 18px", cursor: n.lien ? "pointer" : "default",
                        borderBottom: i < notifications.length - 1 ? "1px solid #f7f7f7" : "none",
                        background: n.lu ? "transparent" : "rgba(245,166,35,0.04)",
                        transition:"background .15s",
                      }}>
                        <Icon size={16} style={{ color, flexShrink:0, marginTop:"2px" }} />
                        <div>
                          <p style={{ fontSize:"13px", color:"#333", margin:0, lineHeight:"1.4", fontWeight: n.lu ? 400 : 600 }}>{n.titre}</p>
                          <p style={{ fontSize:"12px", color:"#999", margin:"2px 0 0", lineHeight:"1.4" }}>{n.message}</p>
                          <p style={{ fontSize:"11px", color:"#bbb", margin:"3px 0 0" }}>{tempsEcoule(n.createdAt)}{n.autreBoutique ? ` · ${n.nomBoutique}` : ""}</p>
                        </div>
                      </div>
                    );
                    // Notification d'une autre boutique : on bascule dessus avant d'ouvrir le lien.
                    if (n.autreBoutique) return <div key={n.id} style={{ cursor:"pointer" }} onClick={() => basculerBoutique(n.tenantId, n.lien)}>{content}</div>;
                    return n.lien ? <Link key={n.id} href={n.lien} onClick={() => setNotifOpen(false)}>{content}</Link> : content;
                  })}
                  {notifications.length > 0 && (
                    <div style={{ padding:"10px 18px 14px", borderTop:"1px solid #f2f2f2" }}>
                      <button onClick={marquerToutLu} style={{ background:"none", border:"none", fontSize:"12px", fontWeight:600, color:"#F5A623", cursor:"pointer", fontFamily:"inherit" }}>
                        Tout marquer comme lu
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Profil ────────────────────────────────────────────── */}
            <div style={{ position: "relative" }}>
              <button
                onClick={toggleProfile}
                style={{
                  display:"flex", alignItems:"center", gap:"8px",
                  background: profileOpen ? "rgba(0,0,0,.055)" : "transparent",
                  border: "1px solid rgba(0,0,0,.09)",
                  borderRadius: "999px",
                  padding: "5px 10px 5px 5px",
                  cursor: "pointer",
                  transition: "background .2s, border-color .2s",
                  flexShrink: 0,
                }}
                onMouseEnter={e => { if (!profileOpen) e.currentTarget.style.background = "rgba(0,0,0,.04)"; }}
                onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width:"27px", height:"27px", borderRadius:"50%",
                  background:"linear-gradient(135deg,#F5A623,#d97706)",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:"10px", fontWeight:800, color:"#fff", flexShrink:0,
                }}>
                  {initiales(nom)}
                </div>
                <span className="hidden sm:block" style={{ fontSize:"12.5px", fontWeight:600, color:"#333", maxWidth:"80px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                  {nom.split(" ")[0]}
                </span>
                <ChevronDown size={12} style={{ color:"#aaa", transform: profileOpen ? "rotate(180deg)" : "none", transition:"transform .25s cubic-bezier(.34,1.56,.64,1)" }} />
              </button>

              {profileOpen && (
                <div className="hdr-drop" style={{
                  position:"absolute", right:0, top:"46px",
                  width:"220px",
                  background:"#fff",
                  border:"1px solid rgba(0,0,0,.07)",
                  borderRadius:"20px",
                  boxShadow:"0 24px 64px rgba(0,0,0,.13), 0 4px 14px rgba(0,0,0,.07)",
                  padding:"8px",
                  zIndex:100,
                }}>
                  {/* Header profil */}
                  <div style={{ padding:"10px 13px 12px", borderBottom:"1px solid #f2f2f2", marginBottom:"6px" }}>
                    <p style={{ fontSize:"13px", fontWeight:700, color:"#111", margin:0 }}>{nom}</p>
                    <p style={{ fontSize:"11px", color:"#bbb", margin:"3px 0 0", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{email}</p>
                  </div>

                  {/* Items */}
                  {([
                    { Icon: User,         label: "Mon profil",        href: "#" },
                    { Icon: Settings,     label: "Paramètres",        href: "/dashboard/parametres" },
                    ...(urlLocale ? [{ Icon: ExternalLink, label: "Voir la boutique", href: urlLocale, ext: true }] : []),
                  ] as any[]).map(({ Icon, label, href, ext }) => (
                    <Link
                      key={label} href={href}
                      {...(ext ? { target:"_blank", rel:"noopener noreferrer" } : {})}
                      className="hdr-item"
                      style={{ display:"flex", alignItems:"center", gap:"10px", padding:"9px 13px", borderRadius:"13px", fontSize:"13px", color:"#555", textDecoration:"none", transition:"background .15s, color .15s" }}
                    >
                      <Icon size={14} style={{ flexShrink:0 }} /> {label}
                    </Link>
                  ))}

                  <div style={{ borderTop:"1px solid #f2f2f2", marginTop:"6px", paddingTop:"6px" }}>
                    <button
                      onClick={() => signOut({ callbackUrl: "/connexion" })}
                      className="hdr-item-red"
                      style={{ display:"flex", alignItems:"center", gap:"10px", padding:"9px 13px", borderRadius:"13px", fontSize:"13px", color:"#ef4444", background:"none", border:"none", cursor:"pointer", width:"100%", fontFamily:"inherit", transition:"background .15s" }}
                    >
                      <LogOut size={14} style={{ flexShrink:0 }} /> Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
