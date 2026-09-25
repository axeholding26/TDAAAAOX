"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useCartStore } from "@/store/cartStore";
import { formatMontant } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Loader2, CreditCard, Shield, Lock,
  CheckCircle2, AlertCircle, MessageCircle, Download,
  Package, Zap, Phone, MapPin, User, Mail, ArrowLeft,
  Receipt, Save, ClipboardList, Check
} from "lucide-react";
import { NotchPayCheckout } from "./NotchPayCheckout";
import { trackPixelEvent } from "./MetaPixel";
import { trackTikTokEvent } from "./TikTokPixel";
import { trackSnapchatEvent } from "./SnapchatPixel";

export interface ParametresCommande {
  demanderEmail?: boolean;
  demanderGps?: boolean;
  champPersonnalise?: { actif: boolean; label: string };
}

interface Props {
  theme: { fond: string; accent: string; texte: string; surface: string };
  slug: string; devise: string; tenantId: string; nomBoutique: string; logoUrl?: string;
  parametresCommande?: ParametresCommande;
  paysBoutique?: string; // code ISO2 — pays présélectionné dans le formulaire
}

/** Nom du pays (clé de PAYS_CONFIG) de la boutique, sinon Sénégal. */
const paysParDefaut = (code?: string) => Object.keys(PAYS_CONFIG).find((n) => PAYS_CONFIG[n].code === code) ?? "Sénégal";

// ─── Config opérateurs ───────────────────────────────────────────────────────
const PAYS_CONFIG: Record<string, { code: string; operateurs: { id: string; label: string; logo: string }[] }> = {
  "Sénégal":       { code: "SN", operateurs: [{ id: "WAVE", label: "Wave", logo: "🌊" }, { id: "ORANGE", label: "Orange Money", logo: "🟠" }, { id: "FREE", label: "Free Money", logo: "🟣" }] },
  "Côte d'Ivoire": { code: "CI", operateurs: [{ id: "MTN", label: "MTN MoMo", logo: "🟡" }, { id: "ORANGE", label: "Orange Money", logo: "🟠" }, { id: "WAVE", label: "Wave", logo: "🌊" }, { id: "MOOV", label: "Moov Money", logo: "🔵" }] },
  "Cameroun":      { code: "CM", operateurs: [{ id: "MTN", label: "MTN MoMo", logo: "🟡" }, { id: "ORANGE", label: "Orange Money", logo: "🟠" }] },
  "Mali":          { code: "ML", operateurs: [{ id: "ORANGE", label: "Orange Money", logo: "🟠" }, { id: "MOOV", label: "Moov Money", logo: "🔵" }] },
  "Burkina Faso":  { code: "BF", operateurs: [{ id: "ORANGE", label: "Orange Money", logo: "🟠" }, { id: "MOOV", label: "Moov Money", logo: "🔵" }] },
  "Guinée":        { code: "GN", operateurs: [{ id: "MTN", label: "MTN MoMo", logo: "🟡" }, { id: "ORANGE", label: "Orange Money", logo: "🟠" }] },
  "Togo":          { code: "TG", operateurs: [{ id: "MOOV", label: "Moov Money", logo: "🔵" }, { id: "TMONEY", label: "T-Money", logo: "💙" }] },
  "Bénin":         { code: "BJ", operateurs: [{ id: "MTN", label: "MTN MoMo", logo: "🟡" }, { id: "MOOV", label: "Moov Money", logo: "🔵" }] },
  "Nigeria":       { code: "NG", operateurs: [{ id: "MTN", label: "MTN MoMo", logo: "🟡" }, { id: "AIRTEL", label: "Airtel Money", logo: "🔴" }] },
  "Ghana":         { code: "GH", operateurs: [{ id: "MTN", label: "MTN MoMo GH", logo: "🟡" }, { id: "VODAFONE", label: "Vodafone Cash", logo: "🔴" }] },
  "Kenya":         { code: "KE", operateurs: [{ id: "MPESA", label: "M-Pesa", logo: "🟢" }] },
  "Maroc":         { code: "MA", operateurs: [{ id: "MAROC_TELECOM", label: "Maroc Telecom", logo: "🟦" }] },
};
const PAYS_AFRIQUE = Object.keys(PAYS_CONFIG).concat(["Niger","Mauritanie","Tunisie","Algérie","Gabon","Congo","RDC"]);

// ─── Guide GPS par navigateur ─────────────────────────────────────────────────
function GpsStep({ label, steps }: { label: string; steps: string[] }) {
  return (
    <div>
      <p style={{ color: "#F5A623" }} className="font-bold mb-1">{label} :</p>
      <ol className="list-decimal pl-4 space-y-0.5">
        {steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  );
}

// ─── Récapitulatif commande ───────────────────────────────────────────────────
function Recap({ theme, devise, items, total, codePromo, label, fraisLivraison }: any) {
  return (
    <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
      <h2 className="font-bold font-playfair text-base flex items-center gap-2"><Receipt size={16} /> {label || "Récapitulatif"}</h2>
      <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
        {items.map((item: any) => (
          <div key={`${item.produitId}-${item.variante}`} className="flex items-center gap-3">
            {item.imageUrl
              ? <img src={item.imageUrl} alt={item.nom} className="w-11 h-11 rounded-xl object-cover flex-shrink-0" />
              : <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.accent}15`, color: theme.accent }}>{item.type === "digital" ? <Save size={18} /> : <Package size={18} />}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{item.nom}</p>
              {item.variante && <p className="text-xs opacity-40">{item.variante}</p>}
              <p className="text-xs opacity-45">×{item.quantite}</p>
            </div>
            <span className="text-sm font-semibold flex-shrink-0" style={{ color: theme.accent }}>{formatMontant(item.prix * item.quantite, devise)}</span>
          </div>
        ))}
      </div>
      <div className="border-t pt-3 text-sm" style={{ borderColor: `${theme.accent}18` }}>
        {codePromo && <div className="flex justify-between text-green-500 mb-1"><span>Code : {codePromo}</span><Check size={14} /></div>}
        {fraisLivraison !== null && fraisLivraison !== undefined && (
          <div className="flex justify-between mb-1 opacity-70">
            <span>Livraison</span>
            <span>{fraisLivraison > 0 ? formatMontant(fraisLivraison, devise) : "Gratuite"}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base">
          <span>Total</span>
          <span style={{ color: theme.accent }}>{formatMontant(total + (fraisLivraison || 0), devise)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Input stylisé ────────────────────────────────────────────────────────────
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs block mb-1.5 font-medium opacity-60">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT PHYSIQUE — Paiement à la livraison → WhatsApp
// ═══════════════════════════════════════════════════════════════════════════════
function CheckoutPhysique({ theme, slug, devise, tenantId, items, total, codePromo, viderPanier, parametresCommande, paysBoutique }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cfg: ParametresCommande = parametresCommande || {};
  const demanderEmail = cfg.demanderEmail ?? true;
  const demanderGps = cfg.demanderGps ?? true;
  const champPerso = cfg.champPersonnalise?.actif ? cfg.champPersonnalise.label : null;
  const [loadingCanal, setLoadingCanal] = useState<"whatsapp" | "direct" | null>(null);
  const [popup, setPopup] = useState<"whatsapp" | "direct" | null>(null);
  const loading = loadingCanal !== null;
  const [done, setDone] = useState<{ commandeId: string; numero: string; viaWhatsapp: boolean; whatsappUrl: string | null; trackingToken?: string } | null>(null);
  const [form, setForm] = useState({ nom: "", telephone: "", adresse: "", ville: "", pays: paysParDefaut(paysBoutique), email: "" });
  const [champPersoValeur, setChampPersoValeur] = useState("");
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsBloque, setGpsBloque] = useState(false);
  const [adresseExacte, setAdresseExacte] = useState("");
  const [zones, setZones] = useState<string[]>([]);
  const [zone, setZone] = useState("");
  const [fraisLivraison, setFraisLivraison] = useState<number | null>(null);
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Code d'affiliation depuis l'URL (?ref=CODE) ou localStorage — même
  // mécanisme que CheckoutDigital, manquait ici (COD/WhatsApp n'attribuait
  // jamais de vente à un affilié).
  const codeRef = useMemo(() => {
    const fromUrl = searchParams?.get("ref") ?? null;
    if (fromUrl) {
      try { localStorage.setItem("axso_ref", fromUrl); } catch {}
      return fromUrl;
    }
    try { return localStorage.getItem("axso_ref"); } catch { return null; }
  }, [searchParams]);

  // Zones configurées par le marchand (dashboard/parametres/zones)
  useEffect(() => {
    fetch(`/api/boutique/${slug}/zones`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.zones) && d.zones.length > 0) setZones(d.zones); })
      .catch(() => {});
  }, [slug]);

  // Frais de livraison en direct dès qu'une zone est choisie (estimation
  // affichée seulement — le montant réellement facturé est recalculé côté
  // serveur dans whatsapp-creer/route.ts).
  useEffect(() => {
    if (!zone) { setFraisLivraison(null); return; }
    let annule = false;
    fetch("/api/livraison/calculer", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId, zone, montantCommande: total }),
    })
      .then(r => r.json())
      .then(d => { if (!annule && d.options?.[0]) setFraisLivraison(d.options[0].frais); })
      .catch(() => {});
    return () => { annule = true; };
  }, [zone, tenantId, total]);

  const inp = "w-full px-4 py-3 rounded-xl border text-sm transition-all focus:ring-2 focus:outline-none";
  const inpStyle = { backgroundColor: theme.surface, borderColor: `${theme.accent}30`, color: theme.texte, ["--tw-ring-color" as any]: `${theme.accent}40` };

  // ── Détection navigateur précise ─────────────────────────────────────────
  const nav = typeof navigator !== "undefined" ? navigator : null;
  const ua  = nav?.userAgent ?? "";
  const isIOS     = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMobile  = isIOS || isAndroid;

  // Navigateurs iOS (tous utilisent WebKit, mais l'app réelle diffère)
  const isChromeiOS   = /CriOS/.test(ua);
  const isFirefoxiOS  = /FxiOS/.test(ua);
  const isOperaiOS    = /OPiOS/.test(ua);
  const isEdgeiOS     = /EdgiOS/.test(ua);
  const isSafariIOS   = isIOS && !isChromeiOS && !isFirefoxiOS && !isOperaiOS && !isEdgeiOS;

  // Navigateurs Android
  const isSamsung     = /SamsungBrowser/.test(ua);
  const isOperaAndroid= /OPR\//.test(ua);
  const isFirefoxAndroid = /Firefox/.test(ua) && isAndroid;
  const isEdgeAndroid = /EdgA/.test(ua);
  const isBrave       = typeof (nav as any)?.brave !== "undefined";
  const isUC          = /UCBrowser/.test(ua);
  const isChromeAndroid = isAndroid && /Chrome/.test(ua) && !isSamsung && !isOperaAndroid && !isEdgeAndroid;

  // Navigateurs desktop
  const isDesktopSafari = !isMobile && /Safari/.test(ua) && !/Chrome/.test(ua);
  const isDesktopFirefox = !isMobile && /Firefox/.test(ua);
  const isDesktopEdge   = !isMobile && /Edg\//.test(ua);
  const isDesktopOpera  = !isMobile && /OPR\//.test(ua);
  const isDesktopChrome = !isMobile && /Chrome/.test(ua) && !isDesktopEdge && !isDesktopOpera;

  // Vérifie l'état de la permission au chargement
  useEffect(() => {
    if (!nav?.permissions) return;
    nav.permissions.query({ name: "geolocation" as PermissionName })
      .then(r => {
        if (r.state === "denied") setGpsBloque(true);
        r.onchange = () => setGpsBloque(r.state === "denied");
      })
      .catch(() => {}); // iOS Safari ne supporte pas navigator.permissions
  }, []);

  function obtenirPosition() {
    if (!nav?.geolocation) {
      toast.error("Géolocalisation non supportée sur cet appareil");
      return;
    }
    setGpsLoading(true);

    const tenterAvec = (highAccuracy: boolean) => {
      nav.geolocation.getCurrentPosition(
        pos => {
          setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGpsLoading(false);
          setGpsBloque(false);
        },
        err => {
          if (err.code === 1) {
            setGpsLoading(false);
            setGpsBloque(true);
          } else if (err.code === 2 && highAccuracy) {
            // Réessayer en basse précision (réseau/WiFi) si puce GPS indisponible
            tenterAvec(false);
          } else {
            setGpsLoading(false);
            toast.error("GPS indisponible — activez la localisation sur votre appareil", { duration: 5000 });
          }
        },
        { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 0 }
      );
    };

    tenterAvec(true);
  }

  async function partagerPosition() {
    if (typeof window === "undefined") return;
    if (nav?.permissions) {
      try {
        const p = await nav.permissions.query({ name: "geolocation" as PermissionName });
        if (p.state === "denied") { setGpsBloque(true); return; }
      } catch {} // iOS Safari
    }
    obtenirPosition();
  }

  async function commander(canal: "whatsapp" | "direct") {
    if (!form.nom.trim() || !form.telephone.trim()) { toast.error("Nom et téléphone obligatoires"); return; }
    if (zones.length > 0 && !zone) { toast.error("Sélectionnez votre zone de livraison"); return; }
    // WhatsApp : onglet ouvert PENDANT le clic — ouvert après la requête, il
    // était bloqué par le navigateur (surtout sur mobile) et le client
    // n'arrivait jamais sur le WhatsApp du marchand.
    const onglet = canal === "whatsapp" ? window.open("", "_blank") : null;
    setLoadingCanal(canal);
    try {
      const res = await fetch("/api/commandes/whatsapp-creer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId, slug, canal,
          client: form,
          items: items.map((i: any) => ({ produitId: i.produitId, nom: i.nom, prix: i.prix, quantite: i.quantite, variante: i.variante, imageUrl: i.imageUrl })),
          total, devise, codePromo, zone: zone || undefined,
          codeAffiliation: codeRef || undefined,
          localisation: gps ? { lat: gps.lat, lng: gps.lng, adresseExacte: adresseExacte || form.adresse } : null,
          champPersonnalise: champPerso && champPersoValeur.trim() ? { label: champPerso, valeur: champPersoValeur.trim() } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      trackPixelEvent("Purchase", {
        content_ids: items.map((i: any) => i.produitId),
        contents: items.map((i: any) => ({ id: i.produitId, quantity: i.quantite })),
        value: total,
        currency: devise,
        num_items: items.length,
      });
      trackTikTokEvent("CompletePayment", { value: total, currency: devise, content_type: "product", contents: items.map((i: any) => ({ content_id: i.produitId, quantity: i.quantite })) });
      trackSnapchatEvent("PURCHASE", { price: total, currency: devise });
      if (typeof window !== "undefined") (window as any).dataLayer?.push({ event: "purchase", value: total, currency: devise, num_items: items.length });
      try { localStorage.removeItem("axso_ref"); } catch {}
      viderPanier();
      setDone(data);
      if (canal === "whatsapp" && data.whatsappUrl) {
        if (onglet) { onglet.opener = null; onglet.location.href = data.whatsappUrl; }
        else window.location.href = data.whatsappUrl; // onglet refusé : on y va directement
      } else onglet?.close();
    } catch (e: any) {
      onglet?.close();
      toast.error(e.message || "Erreur");
    } finally {
      setLoadingCanal(null);
    }
  }

  // Succès
  if (done) {
    const appUrl = typeof window !== "undefined" ? window.location.origin : "";
    const invoiceUrl = done.trackingToken ? `${appUrl}/${slug}/facture/${done.trackingToken}` : null;
    const trackingUrl = done.trackingToken ? `${appUrl}/${slug}/tracking/${done.trackingToken}` : null;
    return (
      <div className="max-w-lg mx-auto py-12 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: `${theme.accent}20`, border: `2px solid ${theme.accent}` }}>
            <CheckCircle2 size={36} style={{ color: theme.accent }} />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-playfair mb-2" style={{ color: theme.accent }}>Commande #{done.numero} confirmée !</h2>
            <p className="text-sm opacity-60">
              {done.viaWhatsapp
                ? "Votre commande est enregistrée et un onglet WhatsApp s'est ouvert pour la confirmer auprès du vendeur."
                : "Votre commande est enregistrée. Le vendeur a été notifié et vous contactera pour la livraison."}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {done.viaWhatsapp && done.whatsappUrl && (
            <a href={done.whatsappUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl font-bold text-base hover:opacity-90 transition-all"
              style={{ background: "#25D366", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,0.35)" }}>
              <MessageCircle size={18} /> L'onglet ne s'est pas ouvert ? Cliquez ici
            </a>
          )}
          {invoiceUrl && (
            <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-semibold text-sm border-2 hover:opacity-80 transition-all"
              style={{ borderColor: theme.accent, color: theme.accent }}>
              <Download size={16} /> Voir ma facture
            </a>
          )}
          {trackingUrl && (
            <a href={trackingUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-semibold text-sm hover:opacity-80 transition-all"
              style={{ background: `${theme.accent}12`, color: theme.accent }}>
              <MapPin size={16} /> Suivre ma livraison en temps réel
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="space-y-5">
        {/* Bandeau info */}
        <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)" }}>
          <Package size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-green-600">Paiement à la livraison</p>
            <p className="text-xs text-green-700 opacity-75 mt-0.5 leading-relaxed">
              Vous ne payez rien maintenant. Le paiement se fait en espèces ou mobile money à la réception de votre colis.
            </p>
          </div>
        </div>

      </div>

      {/* Pop-up « VOS INFORMATIONS » : les coordonnées de livraison, demandées
          au moment de commander (bouton WhatsApp ou « Commander maintenant »). */}
      {popup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={(e) => { if (e.target === e.currentTarget && !loading) setPopup(null); }}
          onKeyDown={(e) => { if (e.key === "Escape" && !loading) setPopup(null); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="titre-vos-informations"
            className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-2xl"
            style={{ backgroundColor: theme.fond, color: theme.texte }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: theme.fond, borderColor: `${theme.accent}20` }}>
              <h2 id="titre-vos-informations" className="font-extrabold text-base tracking-[0.12em] flex items-center gap-2"><ClipboardList size={17} /> VOS INFORMATIONS</h2>
              <button type="button" onClick={() => setPopup(null)} disabled={loading} aria-label="Fermer" className="w-9 h-9 rounded-full flex items-center justify-center opacity-60 hover:opacity-100">✕</button>
            </div>
            <div className="p-5 space-y-4">
        {/* Formulaire */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
          <h2 className="font-bold font-playfair text-base flex items-center gap-2"><ClipboardList size={16} /> Vos informations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nom complet" required>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Ex: Aminata Diallo" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
                </div>
              </Field>
            </div>
            <Field label="Téléphone (WhatsApp de préférence)" required>
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input type="tel" value={form.telephone} onChange={e => set("telephone", e.target.value)} placeholder="+221 77 000 00 00" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
              </div>
            </Field>
            {demanderEmail && (
              <Field label="Email (optionnel)">
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@exemple.com" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
                </div>
              </Field>
            )}
            {champPerso && (
              <div className={demanderEmail ? "" : "sm:col-span-2"}>
                <Field label={champPerso}>
                  <input value={champPersoValeur} onChange={e => setChampPersoValeur(e.target.value)} className={inp} style={inpStyle} />
                </Field>
              </div>
            )}
          </div>
        </div>

        {/* Adresse livraison */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
          <h2 className="font-bold font-playfair text-base flex items-center gap-2"><Package size={16} /> Adresse de livraison</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Adresse exacte">
                <div className="relative">
                  <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input value={adresseExacte || form.adresse}
                    onChange={e => { setAdresseExacte(e.target.value); set("adresse", e.target.value); }}
                    placeholder="Rue, quartier, numéro, point de repère…" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
                </div>
              </Field>
            </div>

            {/* GPS Picker */}
            {demanderGps && (
            <div className="sm:col-span-2 space-y-2">
              {/* Succès */}
              {gps && !gpsBloque && (
                <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
                  <CheckCircle2 size={16} color="#16a34a" className="flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: "#15803d" }}>Position GPS partagée</p>
                    <p className="text-xs" style={{ color: "#16a34a", opacity: 0.8 }}>{gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
                  </div>
                  <a href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-semibold underline flex-shrink-0" style={{ color: "#16a34a" }}>
                    Voir
                  </a>
                  <button type="button" onClick={() => setGps(null)} className="text-xs opacity-50 hover:opacity-100 flex-shrink-0" style={{ color: "#16a34a" }}>✕</button>
                </div>
              )}

              {/* Guide déblocage par navigateur */}
              {gpsBloque && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.18)" }}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} color="#ef4444" className="flex-shrink-0 mt-0.5" />
                    <p className="text-sm font-bold" style={{ color: "#ef4444" }}>Localisation bloquée — comment l'autoriser :</p>
                  </div>

                  <div className="space-y-2.5 text-xs" style={{ color: "#d1d5db" }}>
                    {/* ── iOS Safari ── */}
                    {isSafariIOS && <>
                      <GpsStep label="Safari (iPhone/iPad)" steps={[
                        "Réglages iPhone → Confidentialité et sécurité → Services de localisation",
                        "Faites défiler → Safari → sélectionnez \"Lors de l'utilisation\"",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Chrome iOS ── */}
                    {isChromeiOS && <>
                      <GpsStep label="Chrome (iPhone/iPad)" steps={[
                        "Réglages iPhone → Confidentialité → Services de localisation → Chrome",
                        "Sélectionnez \"Lors de l'utilisation\"",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Firefox iOS ── */}
                    {isFirefoxiOS && <>
                      <GpsStep label="Firefox (iPhone/iPad)" steps={[
                        "Réglages iPhone → Confidentialité → Services de localisation → Firefox",
                        "Sélectionnez \"Lors de l'utilisation\"",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Opera iOS ── */}
                    {isOperaiOS && <>
                      <GpsStep label="Opera (iPhone/iPad)" steps={[
                        "Réglages iPhone → Confidentialité → Services de localisation → Opera",
                        "Sélectionnez \"Lors de l'utilisation\"",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Edge iOS ── */}
                    {isEdgeiOS && <>
                      <GpsStep label="Edge (iPhone/iPad)" steps={[
                        "Réglages iPhone → Confidentialité → Services de localisation → Microsoft Edge",
                        "Sélectionnez \"Lors de l'utilisation\"",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Chrome Android ── */}
                    {isChromeAndroid && <>
                      <GpsStep label="Chrome (Android)" steps={[
                        "Appuyez sur 🔒 dans la barre d'adresse → Autorisations → Localisation → Autoriser",
                        "Ou : Paramètres Android → Applications → Chrome → Autorisations → Localisation → Autoriser",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Samsung Internet ── */}
                    {isSamsung && <>
                      <GpsStep label="Samsung Internet" steps={[
                        "Menu (3 traits) → Paramètres → Sites et téléchargements → Autorisations du site",
                        "Localisation → Autoriser",
                        "Ou : Paramètres Android → Applications → Internet → Autorisations → Localisation",
                      ]} />
                    </>}

                    {/* ── Opera Android ── */}
                    {isOperaAndroid && <>
                      <GpsStep label="Opera (Android)" steps={[
                        "Appuyez sur l'icône O → Paramètres → Confidentialité → Autorisations du site",
                        "Localisation → Autoriser pour ce site",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Firefox Android ── */}
                    {isFirefoxAndroid && <>
                      <GpsStep label="Firefox (Android)" steps={[
                        "Menu (3 points) → Paramètres → Paramètres du site → Localisation",
                        "Ou : appuyez sur 🔒 → Informations de connexion → Autorisations → Localisation",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Edge Android ── */}
                    {isEdgeAndroid && <>
                      <GpsStep label="Edge (Android)" steps={[
                        "Menu (3 points) → Paramètres → Confidentialité et sécurité → Autorisations du site",
                        "Localisation → Autoriser",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── Brave ── */}
                    {isBrave && <>
                      <GpsStep label="Brave" steps={[
                        "Appuyez sur l'icône lion → Autorisations pour ce site → Localisation → Autoriser",
                        "Ou : Paramètres Brave → Confidentialité → Autorisations du site → Localisation",
                        "Revenez ici et appuyez sur Réessayer",
                      ]} />
                    </>}

                    {/* ── UC Browser ── */}
                    {isUC && <>
                      <GpsStep label="UC Browser" steps={[
                        "Paramètres → Autorisations du site → Localisation → Autoriser",
                        "Ou : Paramètres Android → Applications → UC Browser → Autorisations → Localisation",
                      ]} />
                    </>}

                    {/* ── Desktop Chrome/Chromium ── */}
                    {isDesktopChrome && <>
                      <GpsStep label="Chrome / Chromium (ordinateur)" steps={[
                        "Cliquez sur 🔒 dans la barre d'adresse → Paramètres du site → Localisation → Autoriser",
                        "Rechargez la page et réessayez",
                      ]} />
                    </>}

                    {/* ── Desktop Edge ── */}
                    {isDesktopEdge && <>
                      <GpsStep label="Microsoft Edge (ordinateur)" steps={[
                        "Cliquez sur 🔒 → Autorisations pour ce site → Localisation → Autoriser",
                        "Rechargez la page et réessayez",
                      ]} />
                    </>}

                    {/* ── Desktop Firefox ── */}
                    {isDesktopFirefox && <>
                      <GpsStep label="Firefox (ordinateur)" steps={[
                        "Cliquez sur 🔒 → Informations de connexion → Autorisations → Localisation → Autoriser",
                        "Ou : barre d'adresse, cliquez sur l'icône géolocalisation → Autoriser → Enregistrer",
                        "Rechargez la page et réessayez",
                      ]} />
                    </>}

                    {/* ── Desktop Opera ── */}
                    {isDesktopOpera && <>
                      <GpsStep label="Opera (ordinateur)" steps={[
                        "Cliquez sur 🔒 → Paramètres du site → Localisation → Autoriser",
                        "Rechargez la page et réessayez",
                      ]} />
                    </>}

                    {/* ── Desktop Safari macOS ── */}
                    {isDesktopSafari && <>
                      <GpsStep label="Safari (Mac)" steps={[
                        "Safari → Réglages → Sites web → Localisation",
                        "Trouvez ce site et sélectionnez \"Autoriser\"",
                        "Revenez ici et réessayez",
                      ]} />
                    </>}

                    {/* Fallback générique si aucun navigateur détecté */}
                    {!isSafariIOS && !isChromeiOS && !isFirefoxiOS && !isOperaiOS && !isEdgeiOS &&
                     !isChromeAndroid && !isSamsung && !isOperaAndroid && !isFirefoxAndroid && !isEdgeAndroid && !isBrave && !isUC &&
                     !isDesktopChrome && !isDesktopEdge && !isDesktopFirefox && !isDesktopOpera && !isDesktopSafari && (
                      <GpsStep label="Votre navigateur" steps={[
                        "Cherchez l'icône 🔒 ou ⚙️ dans la barre d'adresse",
                        "Ouvrez les paramètres / autorisations du site",
                        "Activez la Localisation → Autoriser",
                        "Rechargez la page et réessayez",
                      ]} />
                    )}
                  </div>

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => { setGpsBloque(false); obtenirPosition(); }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: "rgba(37,211,102,0.1)", color: "#22c55e", border: "1px solid rgba(37,211,102,0.2)" }}>
                      <MapPin size={11} /> J'ai autorisé — Réessayer
                    </button>
                    <button type="button" onClick={() => setGpsBloque(false)}
                      className="px-3 py-2 rounded-lg text-xs transition-all" style={{ color: "#6b7280" }}>
                      Ignorer
                    </button>
                  </div>
                </div>
              )}

              {/* Bouton principal (si pas de GPS et pas bloqué) */}
              {!gps && !gpsBloque && (
                <button type="button" onClick={partagerPosition} disabled={gpsLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-dashed border-2 text-sm font-semibold transition-all"
                  style={{ borderColor: `${theme.accent}35`, color: theme.accent, background: `${theme.accent}06` }}>
                  {gpsLoading
                    ? <><Loader2 size={14} className="animate-spin" /> Localisation en cours…</>
                    : <><MapPin size={14} /> Partager ma localisation GPS <span className="opacity-50 font-normal">(optionnel)</span></>
                  }
                </button>
              )}
            </div>
            )}

            {zones.length > 0 && (
              <div className="sm:col-span-2">
                <Field label="Zone de livraison" required>
                  <select value={zone} onChange={e => setZone(e.target.value)} className={inp} style={inpStyle}>
                    <option value="" style={{ backgroundColor: theme.surface }}>Sélectionnez votre zone…</option>
                    {zones.map(z => <option key={z} value={z} style={{ backgroundColor: theme.surface }}>{z}</option>)}
                  </select>
                </Field>
                {zone && fraisLivraison !== null && (
                  <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: theme.accent }}>
                    <Package size={11} />
                    {fraisLivraison > 0 ? `Frais de livraison : ${formatMontant(fraisLivraison, devise)}` : "Livraison gratuite pour cette zone"}
                  </p>
                )}
              </div>
            )}
            <Field label="Ville">
              <input value={form.ville} onChange={e => set("ville", e.target.value)} placeholder="Dakar" className={inp} style={inpStyle} />
            </Field>
            <Field label="Pays">
              <select value={form.pays} onChange={e => set("pays", e.target.value)} className={inp} style={inpStyle}>
                {PAYS_AFRIQUE.map(p => <option key={p} style={{ backgroundColor: theme.surface }}>{p}</option>)}
              </select>
            </Field>
          </div>
        </div>
            </div>
            <div className="sticky bottom-0 px-5 py-4 border-t" style={{ backgroundColor: theme.fond, borderColor: `${theme.accent}20` }}>
              <button onClick={() => commander(popup)} disabled={loading}
                className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3"
                style={popup === "whatsapp" ? { background: "#25D366", color: "#fff" } : { background: theme.accent, color: "#fff" }}>
                {loading ? <Loader2 size={18} className="animate-spin" /> : popup === "whatsapp" ? <MessageCircle size={18} /> : <ClipboardList size={18} />}
                {loading ? "Création de la commande…" : popup === "whatsapp" ? "Confirmer via WhatsApp" : "Confirmer la commande"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Récap + CTA */}
      <div>
        <div className="space-y-4">
          <Recap theme={theme} devise={devise} items={items} total={total} codePromo={codePromo} label="Votre commande" fraisLivraison={zones.length > 0 ? fraisLivraison : null} />

          <button onClick={() => setPopup("whatsapp")} disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
            style={{ background: "#25D366", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,0.4)" }}>
            {loadingCanal === "whatsapp" ? <Loader2 size={18} className="animate-spin" /> : <MessageCircle size={18} />}
            {loadingCanal === "whatsapp" ? "Création de la commande…" : "Commander via WhatsApp"}
          </button>

          <button onClick={() => setPopup("direct")} disabled={loading}
            className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 border-2"
            style={{ borderColor: theme.accent, color: theme.accent, background: `${theme.accent}08` }}>
            {loadingCanal === "direct" ? <Loader2 size={16} className="animate-spin" /> : <ClipboardList size={16} />}
            {loadingCanal === "direct" ? "Création de la commande…" : "Commander maintenant"}
          </button>

          <div className="flex items-center gap-2 text-xs opacity-40 justify-center">
            <Lock size={10} /> Commande sécurisée · Paiement à la livraison
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT DIGITAL — Paiement NotchPay · Wallet Axso · Livraison instantanée
// ═══════════════════════════════════════════════════════════════════════════════
function CheckoutDigital({ theme, slug, devise, tenantId, items, total, codePromo, viderPanier, paysBoutique }: any) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<"form" | "paiement">("form");
  const [loading, setLoading] = useState(false);
  const [commandeId, setCommandeId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", email: "", telephone: "", pays: paysParDefaut(paysBoutique) });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Code d'affiliation depuis l'URL (?ref=CODE) ou localStorage
  const codeRef = useMemo(() => {
    const fromUrl = searchParams?.get("ref") ?? null;
    if (fromUrl) {
      try { localStorage.setItem("axso_ref", fromUrl); } catch {}
      return fromUrl;
    }
    try { return localStorage.getItem("axso_ref"); } catch { return null; }
  }, [searchParams]);

  const inp = "w-full px-4 py-3 rounded-xl border text-sm transition-all focus:ring-2 focus:outline-none";
  const inpStyle = { backgroundColor: theme.surface, borderColor: `${theme.accent}30`, color: theme.texte, ["--tw-ring-color" as any]: `${theme.accent}40` };

  async function creerCommande() {
    if (!form.nom.trim() || !form.email.trim()) {
      toast.error("Nom et email obligatoires pour les produits digitaux");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/commandes/digital-creer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId,
          client: { ...form },
          items: items.map((i: any) => ({ produitId: i.produitId, nom: i.nom, prix: i.prix, quantite: i.quantite, variante: i.variante, imageUrl: i.imageUrl })),
          total, devise, codePromo,
          codeAffiliation: codeRef || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCommandeId(data.commandeId);
      setPhase("paiement");
    } catch (e: any) {
      toast.error(e.message || "Erreur lors de la création de la commande");
    } finally {
      setLoading(false);
    }
  }

  function onPaiementSucces() {
    try { localStorage.removeItem("axso_ref"); } catch {}
    trackPixelEvent("Purchase", {
      content_ids: items.map((i: any) => i.produitId),
      contents: items.map((i: any) => ({ id: i.produitId, quantity: i.quantite })),
      value: total,
      currency: devise,
      num_items: items.length,
    });
    trackTikTokEvent("CompletePayment", { value: total, currency: devise, content_type: "product", contents: items.map((i: any) => ({ content_id: i.produitId, quantity: i.quantite })) });
    trackSnapchatEvent("PURCHASE", { price: total, currency: devise });
    if (typeof window !== "undefined") (window as any).dataLayer?.push({ event: "purchase", value: total, currency: devise, num_items: items.length });
    viderPanier();
    router.push(`/${slug}/confirmation/${commandeId}`);
  }

  const inp2 = inp; // alias pour lisibilité dans le bloc paiement

  // ── Phase 2 : paiement NotchPay ──────────────────────────────────────────────
  if (phase === "paiement" && commandeId) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
        <div className="lg:col-span-3 space-y-5">
          <button onClick={() => setPhase("form")}
            className="flex items-center gap-1.5 text-sm opacity-50 hover:opacity-80 transition-opacity">
            <ArrowLeft size={14} /> Modifier mes informations
          </button>

          {/* Bandeau digital */}
          <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}30` }}>
            <Zap size={18} style={{ color: theme.accent }} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold" style={{ color: theme.accent }}>Livraison instantanée</p>
              <p className="text-xs opacity-70 mt-0.5 leading-relaxed">
                Vos fichiers seront disponibles immédiatement après le paiement.
              </p>
            </div>
          </div>

          {/* NotchPay checkout */}
          <div className="rounded-2xl border p-5" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
            <h2 className="font-bold font-playfair text-base mb-4 flex items-center gap-2"><CreditCard size={16} /> Paiement sécurisé</h2>
            <NotchPayCheckout
              commandeId={commandeId}
              montant={total}
              devise={devise}
              clientEmail={form.email}
              clientNom={form.nom}
              clientTelephone={form.telephone}
              onError={(msg) => toast.error(msg)}
            />
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="lg:sticky lg:top-24 space-y-4">
            <Recap theme={theme} devise={devise} items={items} total={total} codePromo={codePromo} label="Produits digitaux" />
            {codeRef && (
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: `${theme.accent}10`, color: theme.accent }}>
                <CheckCircle2 size={12} /> Code affiliation <span className="font-mono font-bold">{codeRef}</span> appliqué
              </div>
            )}
            <div className="flex items-center gap-2 text-xs opacity-40 justify-center">
              <Download size={10} /> Téléchargement disponible immédiatement après paiement
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Phase 1 : formulaire ───────────────────────────────────────────────────
  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:gap-8">
      <div className="lg:col-span-3 space-y-5">
        {/* Bandeau digital */}
        <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: `${theme.accent}10`, border: `1px solid ${theme.accent}30` }}>
          <Zap size={18} style={{ color: theme.accent }} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold" style={{ color: theme.accent }}>Livraison instantanée</p>
            <p className="text-xs opacity-70 mt-0.5 leading-relaxed">
              Votre fichier sera disponible immédiatement après la confirmation du paiement. Un lien de téléchargement vous sera envoyé par email.
            </p>
          </div>
        </div>

        {/* Infos client */}
        <div className="rounded-2xl border p-5 space-y-4" style={{ backgroundColor: theme.surface, borderColor: `${theme.accent}20` }}>
          <h2 className="font-bold font-playfair text-base flex items-center gap-2"><User size={16} /> Vos informations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="Nom complet" required>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                  <input value={form.nom} onChange={e => set("nom", e.target.value)} placeholder="Ex: Aminata Diallo" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
                </div>
              </Field>
            </div>
            <Field label="Email (recevez votre fichier ici)" required>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input type="email" value={form.email} onChange={e => set("email", e.target.value)} placeholder="email@exemple.com" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
              </div>
            </Field>
            <Field label="Téléphone (optionnel)">
              <div className="relative">
                <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" />
                <input type="tel" value={form.telephone} onChange={e => set("telephone", e.target.value)} placeholder="+221 77 000 00 00" className={inp} style={{ ...inpStyle, paddingLeft: "2.25rem" }} />
              </div>
            </Field>
            <Field label="Pays">
              <select value={form.pays} onChange={e => set("pays", e.target.value)} className={inp} style={inpStyle}>
                {PAYS_AFRIQUE.map(p => <option key={p} style={{ backgroundColor: theme.surface }}>{p}</option>)}
              </select>
            </Field>
          </div>
        </div>

        {/* Info paiement */}
        <div className="flex items-center gap-3 p-4 rounded-2xl border" style={{ borderColor: `${theme.accent}15`, background: `${theme.accent}05` }}>
          <CreditCard size={16} style={{ color: theme.accent }} className="flex-shrink-0" />
          <p className="text-xs opacity-60 leading-relaxed">
            Paiement sécurisé par <span className="font-bold" style={{ color: "#111111" }}>NotchPay</span> · Orange Money, MTN MoMo, carte bancaire · Chiffrement SSL 256-bit
          </p>
        </div>
      </div>

      {/* Récap + CTA */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-24 space-y-4">
          <Recap theme={theme} devise={devise} items={items} total={total} codePromo={codePromo} label="Produits digitaux" />

          {codeRef && (
            <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl" style={{ background: `${theme.accent}10`, color: theme.accent }}>
              <CheckCircle2 size={12} /> Code affiliation <span className="font-mono font-bold">{codeRef}</span> appliqué
            </div>
          )}

          <button onClick={creerCommande} disabled={loading}
            className="w-full py-4 rounded-2xl font-bold text-base transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg"
            style={{ backgroundColor: "#635BFF", color: "#fff", boxShadow: "0 4px 20px rgba(99,91,255,0.4)" }}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Shield size={16} />}
            {loading ? "Préparation du paiement…" : `Payer ${formatMontant(total, devise)}`}
          </button>

          <div className="flex items-center gap-2 text-xs opacity-40 justify-center">
            <Download size={10} /> Téléchargement disponible immédiatement après paiement
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECKOUT MIXTE — Avertissement + deux sections
// ═══════════════════════════════════════════════════════════════════════════════
function CheckoutMixte({ theme, slug, devise, tenantId, nomBoutique, logoUrl, items, total, codePromo, viderPanier, parametresCommande, paysBoutique }: any) {
  const itemsPhysiques = items.filter((i: any) => i.type === "physique");
  const itemsDigitaux  = items.filter((i: any) => i.type === "digital" || i.type === "dropshipping");
  const totalPhysique  = itemsPhysiques.reduce((s: number, i: any) => s + i.prix * i.quantite, 0);
  const totalDigital   = itemsDigitaux.reduce((s: number, i: any) => s + i.prix * i.quantite, 0);
  const [section, setSection] = useState<"physique" | "digital">("physique");

  return (
    <div className="space-y-6">
      {/* Bandeau mixte */}
      <div className="flex items-start gap-3 p-4 rounded-2xl border" style={{ background: "rgba(245,158,11,0.06)", borderColor: "rgba(245,158,11,0.3)" }}>
        <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-amber-600">Panier mixte détecté</p>
          <p className="text-xs text-amber-700 opacity-80 mt-0.5 leading-relaxed">
            Votre panier contient des produits physiques et des produits digitaux. Ils nécessitent deux processus distincts.
          </p>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex rounded-2xl border p-1 gap-1" style={{ borderColor: `${theme.accent}20`, backgroundColor: theme.surface }}>
        <button onClick={() => setSection("physique")}
          className="flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{ background: section === "physique" ? theme.accent : "transparent", color: section === "physique" ? theme.fond : theme.texte, opacity: section === "physique" ? 1 : 0.6 }}>
          <Package size={14} /> Physiques ({itemsPhysiques.length})
        </button>
        <button onClick={() => setSection("digital")}
          className="flex-1 py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2"
          style={{ background: section === "digital" ? theme.accent : "transparent", color: section === "digital" ? theme.fond : theme.texte, opacity: section === "digital" ? 1 : 0.6 }}>
          <Zap size={14} /> Digitaux ({itemsDigitaux.length})
        </button>
      </div>

      {section === "physique" && itemsPhysiques.length > 0 && (
        <CheckoutPhysique theme={theme} slug={slug} devise={devise} tenantId={tenantId} items={itemsPhysiques} total={totalPhysique} codePromo={null} viderPanier={() => {}} parametresCommande={parametresCommande} paysBoutique={paysBoutique} />
      )}
      {section === "digital" && itemsDigitaux.length > 0 && (
        <CheckoutDigital theme={theme} slug={slug} devise={devise} tenantId={tenantId} nomBoutique={nomBoutique} logoUrl={logoUrl} items={itemsDigitaux} total={totalDigital} codePromo={null} viderPanier={() => {}} paysBoutique={paysBoutique} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export function CheckoutForm({ theme, slug, devise, tenantId, nomBoutique, logoUrl, parametresCommande, paysBoutique }: Props) {
  const { items, totalAvecReduction, viderPanier, codePromo } = useCartStore();
  const total = totalAvecReduction();

  // Détecter le type du panier
  // digital + dropshipping → paiement en ligne Stripe
  // physique → COD livraison
  const typePanier = useMemo(() => {
    if (items.length === 0) return "vide";
    const aEnLigne  = items.some(i => i.type === "digital" || i.type === "dropshipping");
    const aPhysique = items.some(i => i.type === "physique");
    if (aEnLigne && aPhysique) return "mixte";
    if (aEnLigne) return "digital"; // même flow Stripe pour digital + dropshipping
    return "physique";
  }, [items]);

  useEffect(() => {
    if (items.length === 0) return;
    trackPixelEvent("InitiateCheckout", {
      content_ids: items.map((i: any) => i.produitId),
      contents: items.map((i: any) => ({ id: i.produitId, quantity: i.quantite })),
      value: total,
      currency: devise,
      num_items: items.length,
    });
    trackTikTokEvent("InitiateCheckout", { value: total, currency: devise });
    trackSnapchatEvent("START_CHECKOUT", { price: total, currency: devise });
    if (typeof window !== "undefined") (window as any).dataLayer?.push({ event: "initiate_checkout", value: total, currency: devise, num_items: items.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="opacity-60">Votre panier est vide</p>
        <a href={`/${slug}/produits`} className="text-sm mt-3 inline-block" style={{ color: theme.accent }}>← Voir les produits</a>
      </div>
    );
  }

  const commonProps = { theme, slug, devise, tenantId, nomBoutique, logoUrl, items, total, codePromo, viderPanier, parametresCommande, paysBoutique };

  return (
    <>
      {/* Badge type en haut */}
      <div className="mb-6">
        {typePanier === "physique" && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: "rgba(16,185,129,0.1)", color: "#10B981", border: "1px solid rgba(16,185,129,0.2)" }}>
            <Package size={14} /> Commande physique · Paiement à la livraison
          </div>
        )}
        {typePanier === "digital" && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: `${theme.accent}15`, color: theme.accent, border: `1px solid ${theme.accent}30` }}>
            <Zap size={14} /> {items.some((i:any) => i.type === "dropshipping") ? "Expédition directe · Paiement en ligne sécurisé" : "Livraison instantanée · Paiement en ligne sécurisé"}
          </div>
        )}
        {typePanier === "mixte" && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold" style={{ background: "rgba(245,158,11,0.1)", color: "#D97706", border: "1px solid rgba(245,158,11,0.3)" }}>
            <AlertCircle size={14} /> Panier mixte · Deux processus distincts
          </div>
        )}
      </div>

      {typePanier === "physique" && <CheckoutPhysique {...commonProps} />}
      {typePanier === "digital"  && <CheckoutDigital {...commonProps} />}
      {typePanier === "mixte"    && <CheckoutMixte {...commonProps} />}
    </>
  );
}
