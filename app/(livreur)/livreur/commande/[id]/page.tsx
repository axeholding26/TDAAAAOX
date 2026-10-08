"use client";
import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Package, Clock, CheckCircle, Navigation, MessageCircle, XCircle } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";
import { useT } from "@/components/I18nProvider";

const MapLivraison = dynamic(() => import("@/components/livreur/MapLivraison").then(m => m.MapLivraison), { ssr: false });

type Commande = {
  id: string; numero: string; clientNom: string; clientTelephone: string;
  adresseLivraison: string; ville: string; pays: string;
  montantTotal: number; montantLivraison: number; devise: string;
  statut: string; noteClient: string | null; aCodeLivraison?: boolean;
  lignes: { nom: string; prix: number; quantite: number; imageUrl: string | null }[];
  livreur?: { id: string; latitude: number | null; longitude: number | null };
};

const ETAPES = [
  { statut: "confirmee",      label: "Confirmée",      icon: Clock },
  { statut: "en_preparation", label: "Préparation",    icon: Package },
  { statut: "expediee",       label: "En livraison",   icon: Navigation },
  { statut: "livree",         label: "Livré",           icon: CheckCircle },
];

// Raisons proposées au livreur — texte libre stocké tel quel dans Commande.echecRaison
const RAISONS_ECHEC = ["Client absent", "Client injoignable", "Refus du colis", "Adresse introuvable"];

const STATUT_COLOR: Record<string, string> = {
  confirmee: "#f59e0b", en_preparation: "#a78bfa", expediee: "#60a5fa", livree: "#34d399",
};

export default function CommandeLivreurPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [livreurPos, setLivreurPos] = useState<{ lat: number; lng: number } | null>(null);
  const [echecOuvert, setEchecOuvert] = useState(false);
  const [codeOuvert, setCodeOuvert] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    fetch(`/api/commandes/${id}`).then(r => r.json()).then(d => { setCommande(d.commande); setLoading(false); });

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => setLivreurPos({ lat: coords.latitude, lng: coords.longitude }),
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, [id]);

  function changerStatut(statut: "expediee" | "livree" | "tentative_echouee", echecRaison?: string) {
    startTransition(async () => {
      const res = await fetch(`/api/commandes/${id}/statut`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut, echecRaison, code: statut === "livree" ? code : undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(t(d.error) || t("Erreur"));
        if (d.code === "code_incorrect") setCode("");
        return;
      }
      if (statut === "expediee") {
        // Position envoyée tout de suite : le client voit le livreur sans attendre le prochain envoi du GeoTracker (30 s)
        if (livreurPos && commande?.livreur?.id) {
          await fetch(`/api/livreurs/${commande.livreur.id}/position`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ latitude: livreurPos.lat, longitude: livreurPos.lng }),
          }).catch(() => {});
        }
        toast.success(t("Livraison démarrée !"), { description: t("Le client peut suivre votre position.") });
        setCommande(c => c ? { ...c, statut: "expediee" } : c);
        router.refresh(); // le layout repasse le GeoTracker en suivi continu
        return;
      }
      if (statut === "tentative_echouee") toast.info(t("Échec signalé"), { description: t("Le client et la boutique sont prévenus.") });
      else toast.success(t("Livraison confirmée !"), { description: t("Les fonds sont libérés automatiquement.") });
      router.push("/livreur");
      router.refresh();
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-[#1B4FD8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!commande) return <div className="text-center py-16 text-gray-400">{t("Commande introuvable")}</div>;

  const etapeActuelle = ETAPES.findIndex(e => e.statut === commande.statut);
  const peutLivrer = commande.statut === "expediee";
  const peutDemarrer = ["confirmee", "en_preparation", "tentative_echouee"].includes(commande.statut);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${commande.adresseLivraison}, ${commande.ville}`)}`;
  const waUrl = `https://wa.me/${commande.clientTelephone.replace(/\D/g, "")}`;

  return (
    <div className="space-y-4 pb-44 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start">
      <button onClick={() => router.back()} className="lg:col-span-2 flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        <ArrowLeft size={16} />{" "}{t("Retour")}
      </button>

      {/* Header */}
      <div className="lg:col-span-2 bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-white/5 rounded-3xl p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-gray-500 text-xs font-mono">{commande.numero}</p>
            <h1 className="text-xl font-bold text-white mt-1">{t(commande.clientNom)}</h1>
          </div>
          <div className="text-right">
            <p className="text-[#1B4FD8] font-bold text-xl">{formatMontant(commande.montantTotal, commande.devise)}</p>
            <p className="text-gray-500 text-xs mt-0.5">{t("Livraison :")}{" "}{formatMontant(commande.montantLivraison, commande.devise)}</p>
          </div>
        </div>

        {/* Barre de progression */}
        <div className="flex items-center gap-1 mt-4">
          {ETAPES.map((e, i) => (
            <div key={e.statut} className="flex-1 h-1 rounded-full" style={{
              backgroundColor: i <= etapeActuelle ? STATUT_COLOR[commande.statut] || "#1B4FD8" : "#1a1a1a"
            }} />
          ))}
        </div>
        <p className="text-xs mt-2" style={{ color: STATUT_COLOR[commande.statut] || "#1B4FD8" }}>
          {t(ETAPES[etapeActuelle]?.label)}
        </p>
      </div>

      {/* Carte Leaflet */}
      <MapLivraison
        adresse={commande.adresseLivraison}
        ville={commande.ville}
        livreurLat={livreurPos?.lat}
        livreurLng={livreurPos?.lng}
      />

      {/* Adresse + Contact */}
      <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-3xl p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#1B4FD8]/10 flex items-center justify-center flex-shrink-0">
            <MapPin size={16} className="text-[#1B4FD8]" />
          </div>
          <div>
            <p className="text-white font-semibold">{t(commande.adresseLivraison)}</p>
            <p className="text-gray-400 text-sm">{t(commande.ville)}, {t(commande.pays)}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] py-3 rounded-2xl text-sm font-medium">
            <Navigation size={15} />{" "}{t("Google Maps")}
          </a>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 py-3 rounded-2xl text-sm font-medium">
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>

        <a href={`tel:${commande.clientTelephone}`}
          className="flex items-center gap-3 w-full bg-[#161616] border border-white/5 text-gray-300 py-3 px-4 rounded-2xl text-sm hover:bg-[#222] transition-colors">
          <Phone size={14} className="text-gray-400" />
          <span>{t(commande.clientTelephone)}</span>
          <span className="ml-auto text-[#1B4FD8] text-xs font-medium">{t("Appeler")}</span>
        </a>
      </div>

      {/* Articles */}
      <div className="lg:col-span-2 bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-3xl p-5">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Package size={14} className="text-[#1B4FD8]" />{" "}{t("Articles")}
        </h2>
        <div className="space-y-3">
          {commande.lignes.map((ligne, i) => (
            <div key={i} className="flex items-center gap-3">
              {ligne.imageUrl ? (
                <img src={ligne.imageUrl} alt={ligne.nom} className="w-11 h-11 rounded-xl object-cover" />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-[#1a1a1a] flex items-center justify-center">
                  <Package size={14} className="text-gray-500" />
                </div>
              )}
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{t(ligne.nom)}</p>
                <p className="text-gray-500 text-xs">{t("Qté :")}{" "}{ligne.quantite}</p>
              </div>
              <p className="text-[#1B4FD8] text-sm font-bold">{formatMontant(ligne.prix * ligne.quantite, commande.devise)}</p>
            </div>
          ))}
        </div>
        {commande.noteClient && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-gray-500 text-xs mb-1">{t("Note du client")}</p>
            <p className="text-gray-500 text-sm italic">"{t(commande.noteClient)}"</p>
          </div>
        )}
      </div>

      {/* CTA Démarrer / Confirmer */}
      {(peutDemarrer || peutLivrer) && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 p-4 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            {peutDemarrer ? (
              <button onClick={() => changerStatut("expediee")} disabled={isPending}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-[#1B4FD8] to-[#3b82f6] text-white font-bold py-4 rounded-2xl text-lg transition-all disabled:opacity-50 shadow-xl shadow-blue-500/20">
                <Navigation size={22} />
                {isPending ? t("Démarrage...") : t("Démarrer la livraison")}
              </button>
            ) : codeOuvert ? (
              <form onSubmit={e => { e.preventDefault(); changerStatut("livree"); }} className="space-y-2">
                <p className="text-center text-gray-400 text-xs">{t("Demandez au client son code de livraison (reçu par WhatsApp)")}</p>
                <div className="flex gap-2">
                  <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="• • • •"
                    className="flex-1 min-w-0 bg-[#161616] border border-white/10 rounded-2xl px-4 py-3.5 text-center text-2xl tracking-[0.5em] font-mono text-white outline-none focus:border-green-500/50" />
                  <button type="submit" disabled={isPending || code.length !== 4}
                    className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-green-400 text-white font-bold px-5 rounded-2xl disabled:opacity-40">
                    <CheckCircle size={20} />{isPending ? "…" : t("Valider")}
                  </button>
                </div>
              </form>
            ) : (
              // Commandes parties avant l'ajout du code : confirmation directe
              <button onClick={() => commande.aCodeLivraison ? setCodeOuvert(true) : changerStatut("livree")} disabled={isPending}
                className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-400 text-white font-bold py-4 rounded-2xl text-lg hover:from-green-400 hover:to-green-300 transition-all disabled:opacity-50 shadow-xl shadow-green-500/20">
                <CheckCircle size={22} />
                {isPending ? t("Confirmation...") : t("Confirmer la livraison")}
              </button>
            )}
            {peutLivrer && (echecOuvert ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {RAISONS_ECHEC.map(r => (
                  <button key={r} onClick={() => changerStatut("tentative_echouee", r)} disabled={isPending}
                    className="py-2.5 rounded-xl text-xs font-medium bg-red-500/10 border border-red-500/20 text-red-400 disabled:opacity-50">
                    {t(r)}
                  </button>
                ))}
                <button onClick={() => setEchecOuvert(false)} className="col-span-2 py-1.5 text-xs text-gray-500">{t("Annuler")}</button>
              </div>
            ) : (
              <button onClick={() => setEchecOuvert(true)} disabled={isPending}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors">
                <XCircle size={15} />{" "}{t("Signaler un échec")}
              </button>
            ))}
            {peutDemarrer && (
              <p className="text-center text-gray-500 text-xs mt-2">{t("Le client sera prévenu et pourra suivre votre position")}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
