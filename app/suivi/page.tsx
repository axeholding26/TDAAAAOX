"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Package, Truck, CheckCircle, Clock, MapPin, Phone,
  ArrowLeft, AlertCircle, ShoppingBag, RefreshCw,
  Navigation, Bike, Check, X, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { MapTracking } from "@/components/storefront/MapTracking";

const ETAPES = [
  { statut: "en_attente",     label: "Reçue",       Icon: Clock       },
  { statut: "confirmee",      label: "Confirmée",   Icon: Check       },
  { statut: "en_preparation", label: "Préparation", Icon: Package     },
  { statut: "expediee",       label: "En route",    Icon: Truck       },
  { statut: "livree",         label: "Livrée",      Icon: CheckCircle },
];

const ORDRE = ["en_attente", "confirmee", "en_preparation", "expediee", "livree"];

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatMontant(val: number, devise = "FCFA") {
  return `${val.toLocaleString("fr")} ${devise}`;
}

export default function SuiviPage() {
  const [numero, setNumero]           = useState("");
  const [commande, setCommande]       = useState<any>(null);
  const [liveData, setLiveData]       = useState<any>(null); // polling /api/tracking/[token]
  const [erreur, setErreur]           = useState("");
  const [recherche, setRecherche]     = useState(false);
  const [refresh, setRefresh]         = useState(false);
  const [lastUpdate, setLastUpdate]   = useState<Date | null>(null);
  const intervalSuivi                 = useRef<NodeJS.Timeout | null>(null);
  const intervalTracking              = useRef<NodeJS.Timeout | null>(null);
  const numeroRef                     = useRef("");
  const tokenRef                      = useRef("");

  const charger = useCallback(async (num: string, silent = false) => {
    if (!num) return;
    if (!silent) setRecherche(true);
    else setRefresh(true);
    setErreur("");
    try {
      const res  = await fetch(`/api/suivi?numero=${encodeURIComponent(num.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.commande) {
        if (!silent) setErreur("Commande introuvable. Vérifiez le numéro (format : AX-YYYYMMDD-XXXX).");
      } else {
        setCommande(data.commande);
        setLastUpdate(new Date());
      }
    } catch {
      if (!silent) setErreur("Erreur de connexion. Réessayez dans quelques instants.");
    } finally {
      setRecherche(false);
      setRefresh(false);
    }
  }, []);

  const chargerTracking = useCallback(async (token: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/tracking/${token}`);
      if (res.ok) {
        const data = await res.json();
        if (data.commande) {
          setLiveData(data.commande);
          setLastUpdate(new Date());
        }
      }
    } catch { /* silent */ }
  }, []);

  // Auto-refresh order status every 20s
  useEffect(() => {
    if (!commande) return;
    numeroRef.current = commande.numero;
    intervalSuivi.current = setInterval(() => charger(numeroRef.current, true), 20000);
    return () => { if (intervalSuivi.current) clearInterval(intervalSuivi.current); };
  }, [commande?.numero, charger]);

  // Poll live tracking (livreur position) every 10s when trackingToken available
  useEffect(() => {
    if (!commande?.trackingToken) return;
    tokenRef.current = commande.trackingToken;
    chargerTracking(tokenRef.current); // immediate first load
    intervalTracking.current = setInterval(() => chargerTracking(tokenRef.current), 10000);
    return () => { if (intervalTracking.current) clearInterval(intervalTracking.current); };
  }, [commande?.trackingToken, chargerTracking]);

  function chercher(e: React.FormEvent) {
    e.preventDefault();
    if (intervalSuivi.current) clearInterval(intervalSuivi.current);
    if (intervalTracking.current) clearInterval(intervalTracking.current);
    setCommande(null);
    setLiveData(null);
    charger(numero);
  }

  const etapeActuelle = commande ? ORDRE.indexOf(commande.statut) : -1;
  const annulee       = commande?.statut === "annulee";
  const livree        = commande?.statut === "livree";

  // Live position from tracking poll, fall back to suivi data
  const livePos       = liveData?.livreurPosition as any;
  const livreurLat    = livePos?.lat ?? null;
  const livreurLng    = livePos?.lng ?? null;
  const clientLat     = liveData?.latitudeClient ?? null;
  const clientLng     = liveData?.longitudeClient ?? null;
  const showMap       = !annulee && (livreurLat || clientLat);

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col"
      style={{ fontFamily: "'Poppins','Century Gothic',system-ui,sans-serif" }}>

      {/* Ambient glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(245,166,35,0.06) 0%, transparent 70%)" }} />

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 px-5 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white/30 hover:text-white/60 transition-colors text-[13px]">
            <ArrowLeft size={14} />
            Accueil
          </Link>
          <div className="flex items-center justify-center">
            <Image src="/logo-dark.png" alt="Axso" width={72} height={24} style={{ objectFit: "contain", opacity: 0.7 }} />
          </div>
          <div className="w-20" />
        </div>
      </header>

      <main className="relative z-10 flex-1 max-w-2xl mx-auto w-full px-5 py-10 space-y-5">

        {/* Hero */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.18)" }}>
            <Package size={22} style={{ color: "#F5A623" }} />
          </div>
          <h1 className="text-[26px] font-bold mb-2 tracking-tight">Suivre ma commande</h1>
          <p className="text-white/30 text-[13px]">Entrez votre numéro pour voir l'état en temps réel</p>
        </div>

        {/* Search form */}
        <form onSubmit={chercher}
          className="rounded-2xl p-5 space-y-3"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest block">
            Numéro de commande
          </label>
          <div className="flex gap-2">
            <input
              value={numero}
              onChange={e => setNumero(e.target.value.toUpperCase())}
              placeholder="AX-20240101-XXXX"
              className="flex-1 rounded-xl px-4 py-3 text-white font-mono text-[13px] outline-none transition-all"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
              onFocus={e => (e.target.style.borderColor = "rgba(245,166,35,0.4)")}
              onBlur={e => (e.target.style.borderColor = "rgba(255,255,255,0.07)")}
            />
            <button
              type="submit"
              disabled={recherche || !numero.trim()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-[13px] transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#F5A623,#d4880d)", color: "#080808" }}>
              {recherche
                ? <div className="w-4 h-4 border-2 border-black/20 border-t-black/70 rounded-full animate-spin" />
                : <Search size={14} />}
              {recherche ? "…" : "Suivre"}
            </button>
          </div>
          <p className="text-white/20 text-[11px]">Le numéro figure sur votre confirmation de commande.</p>
        </form>

        {/* Error */}
        {erreur && (
          <div className="flex items-start gap-3 rounded-2xl p-4"
            style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)" }}>
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-[13px]">{erreur}</p>
          </div>
        )}

        {/* Result */}
        {commande && (
          <div className="space-y-4">

            {/* Status header card */}
            <div className="rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>

              {/* Top row */}
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-1">Commande</p>
                  <p className="font-mono font-bold text-[20px] text-white">{commande.numero}</p>
                  {commande.tenant?.nomBoutique && (
                    <p className="text-[11px] text-white/30 mt-0.5">{commande.tenant.nomBoutique}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {annulee ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#f87171", border: "1px solid rgba(239,68,68,0.18)" }}>
                      <X size={10} /> Annulée
                    </span>
                  ) : livree ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(16,185,129,0.08)", color: "#34d399", border: "1px solid rgba(16,185,129,0.2)" }}>
                      <Check size={10} /> Livrée
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full"
                      style={{ background: "rgba(245,166,35,0.09)", color: "#F5A623", border: "1px solid rgba(245,166,35,0.22)" }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[#F5A623] animate-pulse" />
                      {ETAPES.find(e => e.statut === commande.statut)?.label ?? commande.statut}
                    </span>
                  )}
                  {/* Refresh */}
                  <button onClick={() => charger(commande.numero, true)}
                    className="flex items-center gap-1 text-[10px] text-white/25 hover:text-white/50 transition-colors">
                    <RefreshCw size={10} className={refresh ? "animate-spin" : ""} />
                    {lastUpdate ? `${lastUpdate.toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}` : ""}
                  </button>
                </div>
              </div>

              {/* Timeline */}
              {!annulee && (
                <div className="flex items-start">
                  {ETAPES.map((etape, i) => {
                    const fait    = i < etapeActuelle;
                    const courant = i === etapeActuelle;
                    const { Icon } = etape;
                    return (
                      <div key={etape.statut} className="flex items-center flex-1">
                        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                            style={
                              fait    ? { background: "rgba(245,166,35,0.12)", border: "1.5px solid rgba(245,166,35,0.35)" } :
                              courant ? { background: "#F5A623", border: "1.5px solid #F5A623" } :
                                        { background: "rgba(255,255,255,0.03)", border: "1.5px solid rgba(255,255,255,0.07)" }
                            }>
                            <Icon size={12}
                              style={{ color: fait ? "#F5A623" : courant ? "#080808" : "rgba(255,255,255,0.15)" }} />
                          </div>
                          <p className="text-[9px] text-center leading-tight max-w-[52px]"
                            style={{
                              color: fait ? "rgba(245,166,35,0.65)" : courant ? "#F5A623" : "rgba(255,255,255,0.15)",
                              fontWeight: courant ? 700 : 400,
                            }}>
                            {etape.label}
                          </p>
                        </div>
                        {i < ETAPES.length - 1 && (
                          <div className="flex-1 h-px mx-1 mb-5 transition-all"
                            style={{ background: fait ? "rgba(245,166,35,0.35)" : "rgba(255,255,255,0.05)" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Annulée message */}
              {annulee && (
                <div className="flex items-center gap-3 rounded-xl p-4 mt-2"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.13)" }}>
                  <X size={16} className="text-red-400 shrink-0" />
                  <p className="text-red-300 text-[13px]">Cette commande a été annulée. Contactez la boutique pour plus d'informations.</p>
                </div>
              )}
            </div>

            {/* Live map */}
            {showMap && (
              <div className="rounded-2xl overflow-hidden"
                style={{ border: "1px solid rgba(255,255,255,0.07)", position: "relative" }}>
                <MapTracking
                  livreurLat={livreurLat}
                  livreurLng={livreurLng}
                  clientLat={clientLat}
                  clientLng={clientLng}
                  livreurNom={liveData?.livreurNom ?? null}
                />
                {livreurLat && (
                  <div style={{ position:"absolute", bottom:10, left:10, right:10, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", borderRadius:10, padding:"7px 12px", display:"flex", alignItems:"center", gap:8, pointerEvents:"none" }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:"#22c55e", animation:"pulse 1.2s ease-in-out infinite", flexShrink:0 }} />
                    <span style={{ fontSize:12, color:"white" }}>
                      {liveData?.livreurNom ? `${liveData.livreurNom} — ` : "Livreur — "}
                      mis à jour {livePos?.updatedAt ? new Date(livePos.updatedAt).toLocaleTimeString("fr", { hour:"2-digit", minute:"2-digit" }) : "récemment"}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Full-page tracking link when no live pos yet */}
            {commande.trackingToken && !showMap && !annulee && commande.tenant?.slug && (
              <Link
                href={`/${commande.tenant.slug}/tracking/${commande.trackingToken}`}
                className="flex items-center justify-between rounded-2xl p-5 transition-all hover:border-[rgba(245,166,35,0.35)] group"
                style={{ background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.18)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: "rgba(245,166,35,0.12)" }}>
                    <Navigation size={16} style={{ color: "#F5A623" }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white">Suivi GPS en temps réel</p>
                    <p className="text-[11px] text-white/35 mt-0.5">La carte s'affichera dès que le livreur partagera sa position</p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-white/25 group-hover:text-[#F5A623] transition-colors" />
              </Link>
            )}

            {/* Delivery info */}
            <div className="rounded-2xl p-5 space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Livraison</p>
              <div className="space-y-3">
                {commande.adresseLivraison && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.14)" }}>
                      <MapPin size={11} style={{ color: "#F5A623" }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 mb-0.5">Adresse</p>
                      <p className="text-[13px] text-white">{commande.adresseLivraison}{commande.ville ? `, ${commande.ville}` : ""}</p>
                    </div>
                  </div>
                )}
                {commande.livreur && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.14)" }}>
                      <Bike size={11} style={{ color: "#F5A623" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-white/25 mb-0.5">Livreur</p>
                      <p className="text-[13px] text-white">{commande.livreur.nom}</p>
                      {commande.livreur.telephone && (
                        <a href={`tel:${commande.livreur.telephone}`}
                          className="flex items-center gap-1 text-[11px] mt-0.5 hover:underline"
                          style={{ color: "#F5A623" }}>
                          <Phone size={10} /> {commande.livreur.telephone}
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {commande.numeroSuivi && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.14)" }}>
                      <Package size={11} style={{ color: "#F5A623" }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 mb-0.5">Numéro de suivi transporteur</p>
                      <p className="text-[13px] text-white font-mono">{commande.numeroSuivi}</p>
                      {commande.transporteur && (
                        <p className="text-[11px] text-white/30 mt-0.5">{commande.transporteur}</p>
                      )}
                    </div>
                  </div>
                )}
                {commande.createdAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.14)" }}>
                      <Clock size={11} style={{ color: "#F5A623" }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 mb-0.5">Commandé le</p>
                      <p className="text-[13px] text-white">{formatDate(commande.createdAt)}</p>
                    </div>
                  </div>
                )}
                {commande.montantTotal != null && (
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(245,166,35,0.07)", border: "1px solid rgba(245,166,35,0.14)" }}>
                      <ShoppingBag size={11} style={{ color: "#F5A623" }} />
                    </div>
                    <div>
                      <p className="text-[10px] text-white/25 mb-0.5">Montant total</p>
                      <p className="text-[13px] font-bold text-white">{formatMontant(commande.montantTotal, commande.devise)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Articles */}
            {commande.lignes?.length > 0 && (
              <div className="rounded-2xl p-5"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Articles ({commande.lignes.length})</p>
                <div className="space-y-3">
                  {commande.lignes.map((ligne: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        {ligne.imageUrl
                          ? <img src={ligne.imageUrl} alt={ligne.nom} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center">
                              <ShoppingBag size={13} className="text-white/15" />
                            </div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] text-white truncate">{ligne.nom}</p>
                        {ligne.variante && <p className="text-[11px] text-white/30">{ligne.variante}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[12px] font-semibold text-white/60">×{ligne.quantite}</p>
                        {ligne.prix != null && (
                          <p className="text-[11px] text-white/30">{formatMontant(ligne.prix * ligne.quantite, commande.devise)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contact boutique */}
            {commande.tenant?.whatsapp && (
              <div className="rounded-2xl p-5 flex items-center justify-between"
                style={{ background: "rgba(37,211,102,0.04)", border: "1px solid rgba(37,211,102,0.13)" }}>
                <div>
                  <p className="text-[13px] font-semibold text-white">Besoin d'aide ?</p>
                  <p className="text-[11px] text-white/30 mt-0.5">Contacter {commande.tenant.nomBoutique}</p>
                </div>
                <a href={`https://wa.me/${commande.tenant.whatsapp.replace(/\D/g, "")}?text=Bonjour, j'ai une question sur ma commande ${commande.numero}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all hover:opacity-80"
                  style={{ background: "rgba(37,211,102,0.12)", color: "#25D366", border: "1px solid rgba(37,211,102,0.22)" }}>
                  <Phone size={12} /> WhatsApp
                </a>
              </div>
            )}

            {/* Auto-refresh notice */}
            <p className="text-center text-[10px] text-white/15 pb-4">
              Actualisation automatique toutes les 20 secondes
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
