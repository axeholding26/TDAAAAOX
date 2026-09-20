import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Phone, Package, ChevronRight, TrendingUp, Clock, Star, Zap, Bike, Car, PersonStanding, Truck, Map, MessageCircle } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { MapLivraisonClient } from "@/components/livreur/MapLivraisonClient";

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  confirmee:      { label: "À récupérer",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  en_preparation: { label: "Préparation",   color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  expediee:       { label: "En livraison",  color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  livree:         { label: "Livré ✓",       color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

export default async function LivreurDashboard() {
  const session = await auth();
  if (!session) redirect("/connexion");

  const livreur = await prisma.livreur.findFirst({
    where: { userId: (session.user as any)?.id },
    include: { tenant: true },
  });
  if (!livreur) redirect("/connexion");

  const now = new Date();
  const debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const debutSemaine = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const [commandesActives, livraisonsJour, livraisonsSemaine, notifNonLues] = await Promise.all([
    prisma.commande.findMany({
      where: { livreurId: livreur.id, statut: { in: ["confirmee", "en_preparation", "expediee"] } },
      include: { lignes: { take: 3 } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.commande.count({ where: { livreurId: livreur.id, statut: "livree", updatedAt: { gte: debutJour } } }),
    prisma.commande.count({ where: { livreurId: livreur.id, statut: "livree", updatedAt: { gte: debutSemaine } } }),
    prisma.notification.count({ where: { livreurId: livreur.id, lu: false } }),
  ]);

  // Commande en cours (prioritaire = expediée, sinon première active)
  const commandePrioritaire = commandesActives.find((c) => c.statut === "expediee") || commandesActives[0];

  const VEHICULE_LABELS: Record<string, string> = {
    moto: "Moto", voiture: "Voiture", velo: "Vélo", a_pied: "Piéton",
  };
  function VehiculeIcon({ vehicule }: { vehicule: string }) {
    if (vehicule === "voiture") return <Car size={14} />;
    if (vehicule === "velo") return <Bike size={14} />;
    if (vehicule === "a_pied") return <PersonStanding size={14} />;
    if (vehicule === "moto") return <Bike size={14} />;
    return <Truck size={14} />;
  }

  return (
    <div className="space-y-5">
      {/* Hero card */}
      <div className="relative rounded-3xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4FD8]/20 via-[#1B4FD8]/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1B4FD820,_transparent_60%)]" />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">
                {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="text-2xl font-bold text-white font-playfair">
                Bonjour, {livreur.nom.split(" ")[0]}
              </h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                <VehiculeIcon vehicule={livreur.vehicule} />
                {VEHICULE_LABELS[livreur.vehicule] || "Livraison"}{livreur.zone ? ` · ${livreur.zone}` : ""}
              </p>
            </div>
            {livreur.disponible ? (
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium">Actif</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                <span className="text-red-400 text-xs font-medium">Hors service</span>
              </div>
            )}
          </div>

          {/* Stats du jour */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-[#1B4FD8]">{commandesActives.length}</p>
              <p className="text-gray-400 text-xs mt-1">En cours</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-green-400">{livraisonsJour}</p>
              <p className="text-gray-400 text-xs mt-1">Auj.</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-[#a78bfa]">{livraisonsSemaine}</p>
              <p className="text-gray-400 text-xs mt-1">Cette semaine</p>
            </div>
          </div>
        </div>
      </div>

      {/* Commande prioritaire avec carte */}
      {commandePrioritaire && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Zap size={16} className="text-[#1B4FD8]" />
              Livraison en cours
            </h2>
            <span className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ color: STATUT[commandePrioritaire.statut]?.color, backgroundColor: STATUT[commandePrioritaire.statut]?.bg }}>
              {STATUT[commandePrioritaire.statut]?.label}
            </span>
          </div>

          {/* Carte Leaflet */}
          <MapLivraisonClient
            adresse={commandePrioritaire.adresseLivraison}
            ville={commandePrioritaire.ville}
            livreurLat={livreur.latitude}
            livreurLng={livreur.longitude}
          />

          {/* Détails commande */}
          <Link href={`/livreur/commande/${commandePrioritaire.id}`}>
            <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 hover:border-[#1B4FD8]/30 rounded-2xl p-4 transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-bold">{commandePrioritaire.clientNom}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                    <MapPin size={12} />
                    <span>{commandePrioritaire.adresseLivraison}, {commandePrioritaire.ville}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                    <Phone size={12} />
                    <span>{commandePrioritaire.clientTelephone}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[#1B4FD8] font-bold text-lg">{formatMontant(commandePrioritaire.montantTotal, commandePrioritaire.devise)}</p>
                  <p className="text-gray-500 text-xs">{commandePrioritaire.lignes.length} article{commandePrioritaire.lignes.length > 1 ? "s" : ""}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${commandePrioritaire.adresseLivraison}, ${commandePrioritaire.ville}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] py-2.5 rounded-xl text-sm"
                >
                  <Map size={14} /> Maps
                </a>
                <a
                  href={`https://wa.me/${commandePrioritaire.clientTelephone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 py-2.5 rounded-xl text-sm"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <div className="flex items-center gap-1 text-gray-400 text-sm ml-auto px-3">
                  Détails <ChevronRight size={14} />
                </div>
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* Autres commandes actives */}
      {commandesActives.length > 1 && (
        <div>
          <h2 className="text-white font-semibold mb-3 text-sm">Autres en attente</h2>
          <div className="space-y-2">
            {commandesActives.slice(1).map((cmd) => {
              const st = STATUT[cmd.statut] || STATUT.confirmee;
              return (
                <Link key={cmd.id} href={`/livreur/commande/${cmd.id}`}>
                  <div className="flex items-center gap-3 bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-2xl p-3.5 hover:border-[#1B4FD8]/20 transition-all">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                      <Package size={16} style={{ color: st.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{cmd.clientNom}</p>
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={9} />{cmd.ville}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-[#1B4FD8] text-sm font-bold">{formatMontant(cmd.montantTotal, cmd.devise)}</p>
                      <span className="text-[10px] mt-0.5" style={{ color: st.color }}>{st.label}</span>
                    </div>
                    <ChevronRight size={14} className="text-gray-500" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Aucune commande */}
      {commandesActives.length === 0 && (
        <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-3xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1B4FD8]/10 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-[#1B4FD8]" />
          </div>
          <p className="text-white font-semibold">Aucune livraison assignée</p>
          <p className="text-gray-500 text-sm mt-2">Votre responsable vous assignera la prochaine commande</p>
          {livreur.disponible && (
            <div className="flex items-center justify-center gap-2 mt-4 text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Vous êtes disponible
            </div>
          )}
        </div>
      )}

      {/* Lien vers historique */}
      <Link href="/livreur/commandes" className="flex items-center justify-center gap-2 w-full text-gray-500 hover:text-gray-300 text-sm py-3 transition-colors">
        <TrendingUp size={14} />
        Voir tout l'historique ({livraisonsSemaine} cette semaine)
      </Link>
    </div>
  );
}
