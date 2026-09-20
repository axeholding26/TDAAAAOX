"use client";
import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Phone, Package, Clock, CheckCircle, Navigation, MessageCircle, Zap } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { toast } from "sonner";
import dynamic from "next/dynamic";

const MapLivraison = dynamic(() => import("@/components/livreur/MapLivraison").then(m => m.MapLivraison), { ssr: false });

type Commande = {
  id: string; numero: string; clientNom: string; clientTelephone: string;
  adresseLivraison: string; ville: string; pays: string;
  montantTotal: number; montantLivraison: number; devise: string;
  statut: string; noteClient: string | null;
  lignes: { nom: string; prix: number; quantite: number; imageUrl: string | null }[];
  livreur?: { latitude: number | null; longitude: number | null };
};

const ETAPES = [
  { statut: "confirmee",      label: "Confirmée",      icon: Clock },
  { statut: "en_preparation", label: "Préparation",    icon: Package },
  { statut: "expediee",       label: "En livraison",   icon: Navigation },
  { statut: "livree",         label: "Livré",           icon: CheckCircle },
];

const STATUT_COLOR: Record<string, string> = {
  confirmee: "#f59e0b", en_preparation: "#a78bfa", expediee: "#60a5fa", livree: "#34d399",
};

export default function CommandeLivreurPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commande, setCommande] = useState<Commande | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [livreurPos, setLivreurPos] = useState<{ lat: number; lng: number } | null>(null);

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

  async function marquerLivre() {
    startTransition(async () => {
      const res = await fetch(`/api/commandes/${id}/statut`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "livree" }),
      });
      if (res.ok) {
        toast.success("Livraison confirmée !", { description: "Les fonds sont libérés automatiquement." });
        router.push("/livreur");
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
    });
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 border-[#1B4FD8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!commande) return <div className="text-center py-16 text-gray-400">Commande introuvable</div>;

  const etapeActuelle = ETAPES.findIndex(e => e.statut === commande.statut);
  const peutLivrer = commande.statut === "expediee";
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${commande.adresseLivraison}, ${commande.ville}`)}`;
  const waUrl = `https://wa.me/${commande.clientTelephone.replace(/\D/g, "")}`;

  return (
    <div className="space-y-4 pb-28">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
        <ArrowLeft size={16} /> Retour
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-[#111] to-[#0d0d0d] border border-white/5 rounded-3xl p-5">
        <div className="flex items-start justify-between mb-1">
          <div>
            <p className="text-gray-500 text-xs font-mono">{commande.numero}</p>
            <h1 className="text-xl font-bold text-white mt-1">{commande.clientNom}</h1>
          </div>
          <div className="text-right">
            <p className="text-[#1B4FD8] font-bold text-xl">{formatMontant(commande.montantTotal, commande.devise)}</p>
            <p className="text-gray-500 text-xs mt-0.5">Livraison : {formatMontant(commande.montantLivraison, commande.devise)}</p>
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
          {ETAPES[etapeActuelle]?.label}
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
            <p className="text-white font-semibold">{commande.adresseLivraison}</p>
            <p className="text-gray-400 text-sm">{commande.ville}, {commande.pays}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] py-3 rounded-2xl text-sm font-medium">
            <Navigation size={15} /> Google Maps
          </a>
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 py-3 rounded-2xl text-sm font-medium">
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>

        <a href={`tel:${commande.clientTelephone}`}
          className="flex items-center gap-3 w-full bg-[#161616] border border-white/5 text-gray-300 py-3 px-4 rounded-2xl text-sm hover:bg-[#222] transition-colors">
          <Phone size={14} className="text-gray-400" />
          <span>{commande.clientTelephone}</span>
          <span className="ml-auto text-[#1B4FD8] text-xs font-medium">Appeler</span>
        </a>
      </div>

      {/* Articles */}
      <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-3xl p-5">
        <h2 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
          <Package size={14} className="text-[#1B4FD8]" /> Articles
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
                <p className="text-white text-sm font-medium">{ligne.nom}</p>
                <p className="text-gray-500 text-xs">Qté : {ligne.quantite}</p>
              </div>
              <p className="text-[#1B4FD8] text-sm font-bold">{formatMontant(ligne.prix * ligne.quantite, commande.devise)}</p>
            </div>
          ))}
        </div>
        {commande.noteClient && (
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-gray-500 text-xs mb-1">Note du client</p>
            <p className="text-gray-500 text-sm italic">"{commande.noteClient}"</p>
          </div>
        )}
      </div>

      {/* CTA Confirmer */}
      {peutLivrer && (
        <div className="fixed bottom-16 left-0 right-0 p-4 bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/5">
          <div className="max-w-2xl mx-auto">
            <button onClick={marquerLivre} disabled={isPending}
              className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-green-500 to-green-400 text-white font-bold py-4 rounded-2xl text-lg hover:from-green-400 hover:to-green-300 transition-all disabled:opacity-50 shadow-xl shadow-green-500/20">
              <CheckCircle size={22} />
              {isPending ? "Confirmation..." : "Confirmer la livraison"}
            </button>
            <p className="text-center text-gray-500 text-xs mt-2">Les fonds seront libérés automatiquement</p>
          </div>
        </div>
      )}
    </div>
  );
}
