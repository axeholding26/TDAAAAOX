"use client";
import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import { Bike, MapPin, Navigation, Radio, Square, XCircle, CheckCircle, Phone, MessageCircle } from "lucide-react";
import { useT } from "@/components/I18nProvider";

export default function LivreurPage() {
  const t = useT();
  const params = useParams<{ token: string }>();
  const [commande, setCommande] = useState<any>(null);
  const [erreur, setErreur] = useState<string | null>(null); // lien terminé ou invalide
  const [status, setStatus] = useState<"idle"|"tracking"|"error"|"done">("idle");
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [lastPos, setLastPos] = useState<{lat:number;lng:number}|null>(null);
  const [updateCount, setUpdateCount] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [code, setCode] = useState("");
  const [echecOuvert, setEchecOuvert] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const watchRef = useRef<number|null>(null);
  const intervalRef = useRef<NodeJS.Timeout|null>(null);

  useEffect(() => {
    fetch(`/api/tracking/${params.token}`)
      .then(async r => {
        const d = await r.json().catch(() => ({}));
        if (d.commande) setCommande(d.commande);
        else setErreur(r.status === 410 && d.error ? d.error : r.status === 404 ? "Lien de livraison invalide." : "Connexion impossible. Vérifiez votre réseau et rechargez la page.");
      })
      .catch(() => setErreur("Connexion impossible. Vérifiez votre réseau et rechargez la page."));
    return () => {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.token]);

  async function sendPos(lat: number, lng: number) {
    const r = await fetch(`/api/tracking/${params.token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng, nom: nom || undefined, telephone: telephone || undefined }),
    }).catch(() => null);
    if (!r) return; // réseau coupé : le prochain envoi réessaie
    // Course terminée pendant le partage : on arrête d'envoyer la position.
    if (r.status === 410) {
      if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setErreur((await r.json().catch(() => ({}))).error || "Cette course est terminée : ce lien n'est plus actif.");
      return;
    }
    if (!r.ok) return;
    setLastPos({ lat, lng });
    setUpdateCount(c => c + 1);
  }

  function startTracking() {
    if (!navigator.geolocation) { setStatus("error"); return; }
    setStatus("tracking");

    function startWatch(highAccuracy: boolean) {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = navigator.geolocation.watchPosition(
        pos => sendPos(pos.coords.latitude, pos.coords.longitude),
        err => {
          // Code 3 = TIMEOUT — iOS Safari cold GPS; fallback to low accuracy
          if (err.code === 3 && highAccuracy) startWatch(false);
        },
        { enableHighAccuracy: highAccuracy, maximumAge: 5000, timeout: 15000 }
      );
    }

    // First fix: get position immediately with timeout so iOS Safari doesn't hang
    navigator.geolocation.getCurrentPosition(
      pos => sendPos(pos.coords.latitude, pos.coords.longitude),
      err => {
        if (err.code === 3) {
          // TIMEOUT on high accuracy — retry with low accuracy before giving up
          navigator.geolocation.getCurrentPosition(
            pos => sendPos(pos.coords.latitude, pos.coords.longitude),
            () => setStatus("error"),
            { enableHighAccuracy: false, timeout: 10000 }
          );
        } else {
          setStatus("error");
        }
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );

    startWatch(true);

    // 30s periodic backup (catches gaps in watchPosition on some iOS versions)
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => sendPos(pos.coords.latitude, pos.coords.longitude),
        () => {},
        { enableHighAccuracy: false, timeout: 10000 }
      );
    }, 30000);
  }

  // Même circuit que l'appli livreur (lib/cycle-livraison.ts) : démarrer, livrer avec le code du client, signaler un échec.
  async function changerStatut(statut: "expediee" | "livree" | "tentative_echouee", echecRaison?: string) {
    setEnvoi(true); setMessage(null);
    const r = await fetch(`/api/tracking/${params.token}/statut`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statut, echecRaison, code: statut === "livree" ? code : undefined }),
    }).catch(() => null);
    setEnvoi(false);
    const d = r ? await r.json().catch(() => ({})) : {};
    if (!r || !r.ok) {
      setMessage(t(d.error) || t("Connexion impossible. Vérifiez votre réseau et réessayez."));
      if (d.code === "code_incorrect") setCode("");
      return;
    }
    setCommande((c: any) => ({ ...c, statut }));
    setEchecOuvert(false);
    if (statut === "expediee") { if (status !== "tracking") startTracking(); return; }
    stopTracking();
  }

  function stopTracking() {
    if (watchRef.current !== null) navigator.geolocation?.clearWatch(watchRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setStatus("done");
  }

  if (erreur) return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", fontFamily:"system-ui,sans-serif", color:"white", display:"flex", alignItems:"center", justifyContent:"center", padding:24, textAlign:"center" }}>
      <p style={{ fontSize:15, color:"#DDD", maxWidth:320 }}>{t(erreur)}</p>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"#0A0A0A", fontFamily:"system-ui,sans-serif", color:"white", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}} @keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Logo / boutique */}
      <div style={{ textAlign:"center", marginBottom:32 }}>
        {/* Axso logo */}
        <div style={{ marginBottom:16 }}>
          <img src="/logo-dark.png" alt={t("Axso")} style={{ height:28, objectFit:"contain", display:"inline-block" }} />
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", width:64, height:64, borderRadius:"50%", background:"rgba(245,166,35,0.12)", border:"2px solid rgba(245,166,35,0.25)", margin:"0 auto 8px" }}>
          <Bike size={32} color="#F5A623" />
        </div>
        <div style={{ fontSize:13, color:"#F5A623", fontWeight:600, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:4 }}>
          {commande?.tenant?.nomBoutique || t("Livraison")}
        </div>
        <div style={{ fontSize:20, fontWeight:700 }}>{t("Mode livreur")}</div>
        {commande && <div style={{ fontSize:12, color:"#555", marginTop:4 }}>{t("Commande #")}{commande.numero} · {t(commande.clientNom)}</div>}
      </div>

      {/* Formulaire nom si pas encore tracking */}
      {status === "idle" && (
        <div style={{ width:"100%", maxWidth:360 }}>
          <div style={{ marginBottom:12 }}>
            <label htmlFor="livreur-nom" style={{ fontSize:11, color:"#666", display:"block", marginBottom:6 }}>{t("Votre nom (optionnel)")}</label>
            <input id="livreur-nom" value={nom} onChange={e => setNom(e.target.value)} placeholder={t("Ex: Moussa")}
              style={{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", color:"white", fontSize:16, outline:"none", boxSizing:"border-box" }} />
          </div>
          <div style={{ marginBottom:20 }}>
            <label htmlFor="livreur-tel" style={{ fontSize:11, color:"#666", display:"block", marginBottom:6 }}>{t("Téléphone (optionnel)")}</label>
            <input id="livreur-tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder={t("+237 6XX XX XX XX")} type="tel"
              style={{ width:"100%", padding:"12px 16px", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", color:"white", fontSize:16, outline:"none", boxSizing:"border-box" }} />
          </div>

          {/* Adresse client */}
          {commande && (
            <div style={{ background:"rgba(245,166,35,0.08)", border:"1px solid rgba(245,166,35,0.2)", borderRadius:16, padding:14, marginBottom:20 }}>
              <div style={{ fontSize:10, color:"#F5A623", fontWeight:600, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:6 }}>{t("Adresse de livraison")}</div>
              <div style={{ fontSize:14, color:"#DDD" }}>{t(commande.adresseExacte) || t(commande.adresseLivraison) || t("À préciser")}</div>
              {commande.ville && <div style={{ fontSize:12, color:"#888", marginTop:2 }}>{t(commande.ville)}</div>}
              {commande.mapsLienClient && (
                <a href={commande.mapsLienClient} target="_blank" rel="noopener noreferrer"
                  style={{ display:"inline-flex", alignItems:"center", gap:6, marginTop:10, color:"#F5A623", fontSize:12, textDecoration:"none", fontWeight:600 }}>
                  <MapPin size={13} />{" "}{t("Ouvrir dans Google Maps")}
                </a>
              )}
              {commande.latitudeClient && commande.longitudeClient && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${commande.latitudeClient},${commande.longitudeClient}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:6, marginTop:8, color:"#22c55e", fontSize:12, textDecoration:"none", fontWeight:600 }}>
                  <Navigation size={13} />{" "}{t("Itinéraire GPS")}
                </a>
              )}
            </div>
          )}

          {commande?.statut === "expediee" ? (
            <button onClick={startTracking}
              style={{ width:"100%", padding:"16px", borderRadius:16, background:"linear-gradient(135deg,#F5A623,#e09520)", color:"black", border:"none", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
              <Radio size={18} />{" "}{t("Reprendre le partage de position")}
            </button>
          ) : (
            <button onClick={() => changerStatut("expediee")} disabled={envoi || !commande}
              style={{ width:"100%", padding:"16px", borderRadius:16, background:"linear-gradient(135deg,#F5A623,#e09520)", color:"black", border:"none", fontSize:15, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, opacity: envoi ? 0.6 : 1 }}>
              <Navigation size={18} />{" "}{envoi ? t("Démarrage...") : t("Démarrer la livraison")}
            </button>
          )}
          <p style={{ fontSize:11, color:"#666", textAlign:"center", marginTop:8 }}>{t("Le client sera prévenu et pourra suivre votre position")}</p>
        </div>
      )}

      {/* Tracking actif */}
      {status === "tracking" && (
        <div style={{ textAlign:"center", maxWidth:360, width:"100%" }}>
          <div style={{ width:100, height:100, borderRadius:"50%", background:"rgba(34,197,94,0.1)", border:"3px solid rgba(34,197,94,0.3)", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px", animation:"pulse 1.5s ease-in-out infinite" }}>
            <Radio size={40} color="#22c55e" />
          </div>
          <div style={{ fontSize:18, fontWeight:700, color:"#22c55e", marginBottom:8 }}>{t("Position partagée")}</div>
          <div style={{ fontSize:13, color:"#555", marginBottom:20 }}>{t("Votre position est envoyée automatiquement")}</div>

          {lastPos && (
            <div style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:14, marginBottom:20, fontSize:12 }}>
              <div style={{ color:"#888", marginBottom:4 }}>{t("Dernière position")}</div>
              <div style={{ color:"#DDD", fontFamily:"monospace" }}>{lastPos.lat.toFixed(5)}, {lastPos.lng.toFixed(5)}</div>
              <div style={{ color:"#555", marginTop:4 }}>{updateCount}{" "}{t("mise(s) à jour envoyée(s)")}</div>
            </div>
          )}

          {commande?.latitudeClient && commande?.longitudeClient && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${commande.latitudeClient},${commande.longitudeClient}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, padding:"12px 20px", borderRadius:14, background:"rgba(34,197,94,0.12)", border:"1px solid rgba(34,197,94,0.25)", color:"#22c55e", fontSize:13, fontWeight:600, textDecoration:"none", marginBottom:16 }}>
              <Navigation size={16} />{" "}{t("Itinéraire vers le client")}
            </a>
          )}

          <button onClick={stopTracking}
            style={{ width:"100%", padding:"13px", borderRadius:14, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#ef4444", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <Square size={14} />{" "}{t("Arrêter le partage")}
          </button>
        </div>
      )}

      {commande && !["livree", "annulee"].includes(commande.statut) && status !== "done" && (
        <div style={{ width:"100%", maxWidth:360, marginTop:20 }}>
          {commande.clientTelephone && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
              <a href={`tel:${commande.clientTelephone}`} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px", borderRadius:12, background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#DDD", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                <Phone size={14} />{" "}{t("Appeler le client")}
              </a>
              <a href={`https://wa.me/${String(commande.clientTelephone).replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, padding:"11px", borderRadius:12, background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)", color:"#22c55e", fontSize:13, fontWeight:600, textDecoration:"none" }}>
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          )}

          {commande.statut === "expediee" && (
            <>
              <form onSubmit={e => { e.preventDefault(); changerStatut("livree"); }}>
                <label htmlFor="code-livraison" style={{ fontSize:11, color:"#888", display:"block", marginBottom:6, textAlign:"center" }}>{t("Demandez au client son code de livraison (reçu par WhatsApp)")}</label>
                <div style={{ display:"flex", gap:8 }}>
                  <input id="code-livraison" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" placeholder="• • • •"
                    style={{ flex:1, minWidth:0, padding:"13px", borderRadius:14, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.06)", color:"white", fontSize:22, letterSpacing:"0.4em", textAlign:"center", fontFamily:"monospace", outline:"none" }} />
                  <button type="submit" disabled={envoi || code.length !== 4}
                    style={{ padding:"0 18px", borderRadius:14, background:"#22c55e", color:"black", border:"none", fontWeight:700, fontSize:14, cursor:"pointer", opacity: envoi || code.length !== 4 ? 0.4 : 1, display:"flex", alignItems:"center", gap:6 }}>
                    <CheckCircle size={16} />{" "}{t("Livré")}
                  </button>
                </div>
              </form>
              {echecOuvert ? (
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                  {["Client absent", "Client injoignable", "Refus du colis", "Adresse introuvable"].map(r => (
                    <button key={r} onClick={() => changerStatut("tentative_echouee", r)} disabled={envoi}
                      style={{ padding:"10px", borderRadius:12, background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)", color:"#f87171", fontSize:12, fontWeight:600, cursor:"pointer" }}>{t(r)}</button>
                  ))}
                  <button onClick={() => setEchecOuvert(false)} style={{ gridColumn:"span 2", padding:"6px", background:"none", border:"none", color:"#666", fontSize:12, cursor:"pointer" }}>{t("Annuler")}</button>
                </div>
              ) : (
                <button onClick={() => setEchecOuvert(true)} disabled={envoi}
                  style={{ width:"100%", marginTop:12, padding:"11px", borderRadius:12, background:"none", border:"1px solid rgba(239,68,68,0.25)", color:"#f87171", fontSize:13, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  <XCircle size={14} />{" "}{t("Signaler un échec")}
                </button>
              )}
            </>
          )}
          {message && <p role="alert" style={{ marginTop:12, fontSize:13, color:"#f87171", textAlign:"center" }}>{message}</p>}
        </div>
      )}

      {status === "error" && (
        <div style={{ textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><XCircle size={48} color="#ef4444" /></div>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8, color:"#ef4444" }}>{t("Géolocalisation refusée")}</div>
          <p style={{ fontSize:13, color:"#666" }}>{t("Autorisez l'accès à votre position dans les paramètres de votre navigateur puis rechargez la page.")}</p>
        </div>
      )}

      {status === "done" && (
        <div style={{ textAlign:"center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}><CheckCircle size={48} color="#22c55e" /></div>
          <div style={{ fontSize:16, fontWeight:600, color: commande?.statut === "tentative_echouee" ? "#f87171" : "#22c55e" }}>
            {commande?.statut === "livree" ? t("Livraison confirmée — merci !") : commande?.statut === "tentative_echouee" ? t("Échec signalé : la boutique et le client sont prévenus.") : t("Partage terminé")}
          </div>
          <p style={{ fontSize:13, color:"#666", marginTop:8 }}>{updateCount}{" "}{t("position(s) envoyée(s)")}</p>
        </div>
      )}
    </div>
  );
}
