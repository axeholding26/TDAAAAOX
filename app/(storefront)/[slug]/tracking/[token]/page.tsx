"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { MapPin, Package, CheckCircle2, Truck, ClipboardList, Check, Map, Bike } from "lucide-react";
import { MapTracking } from "@/components/storefront/MapTracking";
import { useT } from "@/components/I18nProvider";

const STATUT_STEP_ICONS: Record<string, React.ReactNode> = {
  en_attente:     <ClipboardList size={16} />,
  confirmee:      <Check size={16} />,
  en_preparation: <Package size={16} />,
  expediee:       <Truck size={16} />,
  livree:         <CheckCircle2 size={16} />,
};

const STATUT_STEPS = [
  { key: "en_attente",    label: "Commande reçue"      },
  { key: "confirmee",     label: "Confirmée"           },
  { key: "en_preparation", label: "En préparation"     },
  { key: "expediee",      label: "Partie en livraison" },
  { key: "livree",        label: "Livrée"               },
];

export default function TrackingPage() {
  const t = useT();
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [liveInfo, setLiveInfo] = useState<{ distanceKm: number | null; etaMin: number | null; speedKmh: number | null }>({ distanceKm: null, etaMin: null, speedKmh: null });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  async function load() {
    const r = await fetch(`/api/tracking/${params.token}`).then(r => r.json());
    if (r.commande) {
      setData(r.commande); setLastUpdate(new Date());
      // Livrée ou annulée : plus rien ne bougera, inutile de continuer à interroger le serveur
      if (["livree", "annulee"].includes(r.commande.statut) && intervalRef.current) clearInterval(intervalRef.current);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 8000); // le livreur envoie toutes les 5 s pendant la course
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  if (loading) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0F0F0F", fontFamily:"system-ui,sans-serif" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:40, height:40, border:"3px solid #F5A623", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 1s linear infinite", margin:"0 auto 16px" }} />
        <p style={{ color:"#666", fontSize:14 }}>{t("Chargement du suivi…")}</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"#0F0F0F", fontFamily:"system-ui,sans-serif" }}>
      <p style={{ color:"#666" }}>{t("Commande introuvable")}</p>
    </div>
  );

  const pos = data.livreurPosition as any;
  const annulee = data.statut === "annulee";
  const livree = data.statut === "livree";
  const echec = data.statut === "tentative_echouee";
  const enPreparation = ["en_attente", "confirmee", "en_preparation"].includes(data.statut);
  // Un échec reste à l'étape "en livraison" : le livreur va repasser
  const statutIdx = STATUT_STEPS.findIndex(s => s.key === (echec ? "expediee" : data.statut));
  const currentStep = statutIdx >= 0 ? statutIdx : 0;

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", fontFamily:"'Inter',system-ui,sans-serif", color:"white" }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes spin{to{transform:rotate(360deg)}}
        @media(min-width:1024px){
          .trk-wrap{max-width:1040px!important}
          .trk-grid{display:grid;grid-template-columns:1.4fr 1fr;column-gap:20px;align-items:start}
          .trk-map{grid-column:1;grid-row:1 / span 3}
          .trk-side{grid-column:2}
        }`}</style>

      {/* Header */}
      <div style={{ background:"linear-gradient(135deg,#1A1A1A,#111)", padding:"16px 20px 14px", borderBottom:"1px solid rgba(245,166,35,0.15)" }}>
        <div className="trk-wrap" style={{ maxWidth:500, margin:"0 auto" }}>
          {/* Axso logo top-center */}
          <div style={{ textAlign:"center", marginBottom:12 }}>
            <img src="/logo-dark.png" alt={t("Axso")} style={{ height:26, objectFit:"contain" }} />
          </div>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontSize:11, color:"#F5A623", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
                {t(data.tenant?.nomBoutique)}
              </div>
              <div style={{ fontSize:20, fontWeight:700 }}>{t("Suivi de livraison")}</div>
              <div style={{ fontSize:12, color:"#555", marginTop:2 }}>{t("Commande #")}{data.numero}</div>
            </div>
            {data.tenant?.logoUrl && (
              <img src={data.tenant.logoUrl} alt="" style={{ height:40, objectFit:"contain", opacity:0.7 }} />
            )}
          </div>
        </div>
      </div>

      <div className="trk-wrap" style={{ maxWidth:500, margin:"0 auto", padding:"20px 16px" }}>

        {/* Annulée banner */}
        {annulee && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:16, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:18 }}>❌</span>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:"#f87171" }}>{t("Commande annulée")}</div>
              <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t("Cette commande a été annulée. Contactez la boutique pour plus d'informations.")}</div>
            </div>
          </div>
        )}

        {/* Livrée */}
        {livree && (
          <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:16, padding:"16px 18px", marginBottom:16 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#4ade80" }}>
              {t("Commande livrée")}
              {data.livreeAt && t(" le {0} à {1}", new Date(data.livreeAt).toLocaleDateString("fr", { day:"numeric", month:"long" }), new Date(data.livreeAt).toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" }))}
            </div>
            <div style={{ fontSize:12, color:"#888", marginTop:4 }}>{t("Merci pour votre achat ! Votre avis aide la boutique :")}</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:10 }}>
              {(data.lignes ?? []).map((l: any) => (
                <a key={l.produitId} href={`/${data.tenant?.slug}/produits/${l.produitId}`}
                  style={{ fontSize:12, color:"#F5A623", border:"1px solid rgba(245,166,35,0.3)", borderRadius:10, padding:"6px 10px", textDecoration:"none" }}>
                  ★ {t("Noter « {0} »", l.nom)}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Tentative manquée */}
        {echec && (
          <div style={{ background:"rgba(239,68,68,0.08)", border:"1px solid rgba(239,68,68,0.2)", borderRadius:16, padding:"14px 18px", marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#f87171" }}>{t("Tentative de livraison manquée")}{data.echecRaison ? ` — ${t(data.echecRaison)}` : ""}</div>
            <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t("Le livreur va repasser. Vous pouvez l'appeler ou contacter la boutique pour convenir d'un horaire.")}</div>
          </div>
        )}

        {/* Code de livraison — preuve de remise, à donner au livreur seulement à la réception */}
        {data.codeLivraison && (
          <div style={{ background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.25)", borderRadius:16, padding:"14px 18px", marginBottom:16, display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:"#4ade80" }}>{t("Votre code de livraison")}</div>
              <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t("Donnez-le au livreur uniquement quand vous avez votre colis en main.")}</div>
            </div>
            <div style={{ fontFamily:"ui-monospace,monospace", fontSize:28, fontWeight:800, letterSpacing:"0.3em", color:"white" }}>{data.codeLivraison}</div>
          </div>
        )}

        <div className="trk-grid">
        {/* Étapes */}
        {!annulee && <div className="trk-side" style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:20, marginBottom:16 }}>
          {STATUT_STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep;
            return (
              <div key={step.key} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 0", borderBottom: i < STATUT_STEPS.length-1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                <div style={{ width:36, height:36, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color: done ? "#22c55e" : active ? "#F5A623" : "#555", background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(245,166,35,0.15)" : "rgba(255,255,255,0.05)", border: done ? "1px solid rgba(34,197,94,0.3)" : active ? "1px solid rgba(245,166,35,0.4)" : "1px solid rgba(255,255,255,0.1)" }}>
                  {done ? <Check size={16} /> : t(STATUT_STEP_ICONS[step.key])}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight: active ? 600 : 400, color: done ? "#22c55e" : active ? "#F5A623" : "#555" }}>{t(step.label)}</div>
                </div>
                {active && <div style={{ width:8, height:8, borderRadius:"50%", background:"#F5A623", animation:"pulse 1.5s ease-in-out infinite" }} />}
              </div>
            );
          })}
        </div>}

        {/* Carte */}
        {livree || annulee ? null : (pos?.lat || (data.latitudeClient && data.longitudeClient)) ? (
          <div className="trk-map" style={{ borderRadius:20, overflow:"hidden", border:"1px solid rgba(255,255,255,0.08)", marginBottom:16, position:"relative" }}>
            <MapTracking
              livreurLat={pos?.lat ?? null}
              livreurLng={pos?.lng ?? null}
              clientLat={data.latitudeClient ?? null}
              clientLng={data.longitudeClient ?? null}
              livreurNom={data.livreurNom ?? null}
              onLiveInfo={setLiveInfo}
            />
            {pos?.lat && (
              <div style={{ position:"absolute", bottom:12, left:12, right:12, background:"rgba(0,0,0,0.75)", backdropFilter:"blur(8px)", borderRadius:12, padding:"8px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
                <span style={{ fontSize:12, color:"white", display:"flex", alignItems:"center", gap:8 }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:"#22c55e", animation:"pulse 1s ease-in-out infinite", flexShrink:0 }} />
                  {data.livreurNom ? `${data.livreurNom} — ` : t("Livreur — ")}
                  {t("Mis à jour")}{" "}{pos.updatedAt ? new Date(pos.updatedAt).toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" }) : t("récemment")}
                </span>
                {liveInfo.distanceKm != null && (
                  <span style={{ fontSize:12, fontWeight:700, color:"#F5A623", whiteSpace:"nowrap" }}>
                    {liveInfo.distanceKm < 1 ? `${Math.round(liveInfo.distanceKm * 1000)} m` : `${liveInfo.distanceKm} km`}
                    {liveInfo.etaMin != null && t(" · ≈ {0} min", liveInfo.etaMin)}
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="trk-map" style={{ borderRadius:20, border:"1px solid rgba(255,255,255,0.08)", padding:32, textAlign:"center", marginBottom:16, background:"rgba(255,255,255,0.02)" }}>
            <Map size={32} style={{ color:"#555", margin:"0 auto 8px" }} />
            <p style={{ fontSize:13, color:"#555" }}>
              {enPreparation
                ? t("Votre commande est en préparation. Vous serez prévenu par WhatsApp dès que le livreur part.")
                : t("La carte s'affichera dès que le livreur partagera sa position")}
            </p>
          </div>
        )}

        {/* Livreur info */}
        {(data.livreurNom || data.livreurTelephone) && (
          <div className="trk-side" style={{ background:"rgba(245,166,35,0.08)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:16, padding:16, marginBottom:16, display:"flex", alignItems:"center", gap:14 }}>
            <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(245,166,35,0.15)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, color:"#F5A623" }}><Bike size={20} /></div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:"white", marginBottom:2 }}>{t(data.livreurNom) ?? t("Livreur assigné")}</div>
              {data.livreurTelephone && <div style={{ fontSize:12, color:"#888" }}>{t(data.livreurTelephone)}</div>}
            </div>
            {data.livreurTelephone && (
              <a href={`tel:${data.livreurTelephone}`} style={{ background:"#F5A623", color:"black", borderRadius:12, padding:"8px 14px", fontSize:12, fontWeight:600, textDecoration:"none" }}>
                {t("Appeler")}
              </a>
            )}
          </div>
        )}

        {/* Adresse client */}
        {(data.adresseExacte || data.adresseLivraison) && (
          <div className="trk-side" style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:16, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:10, color:"#666", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>{t("Adresse de livraison")}</div>
            <div style={{ fontSize:14, color:"#DDD" }}>{t(data.adresseExacte) || t(data.adresseLivraison)}</div>
            {data.ville && <div style={{ fontSize:12, color:"#666", marginTop:4 }}>{t(data.ville)}</div>}
            {data.mapsLienClient && (
              <a href={data.mapsLienClient} target="_blank" rel="noopener noreferrer"
                style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:10, color:"#F5A623", fontSize:12, textDecoration:"none" }}>
                <MapPin size={12} />{" "}{t("Voir sur Google Maps")}
              </a>
            )}
          </div>
        )}

        </div>

        {/* Lien personnel : ce jeton ouvre « Mon compte » (toutes les commandes de ce numéro), sans code */}
        {data.tenant?.slug && (
          <a href={`/${data.tenant.slug}/mon-compte?lien=${params.token}`}
            style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:16, padding:"14px 16px", marginBottom:16, color:"white", fontSize:14, fontWeight:600, textDecoration:"none" }}>
            <ClipboardList size={16} style={{ color:"#F5A623" }} />{" "}{t("Voir toutes mes commandes")}
          </a>
        )}

        {/* Refresh info */}
        {!livree && !annulee && <div style={{ textAlign:"center", padding:"12px 0" }}>
          <p style={{ fontSize:11, color:"#444" }}>
            {t("Mise à jour automatique toutes les 8 secondes")}
            {lastUpdate && t(" · Dernière : {0}", lastUpdate.toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit", second:"2-digit" }))}
          </p>
        </div>}
      </div>
    </div>
  );
}
