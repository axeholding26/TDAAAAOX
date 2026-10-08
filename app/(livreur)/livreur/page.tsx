import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { MapPin, Phone, Package, ChevronRight, TrendingUp, Zap, Bike, Car, PersonStanding, Truck, Map, MessageCircle } from "lucide-react";
import { formatMontant } from "@/lib/utils";
import { MapLivraisonClient } from "@/components/livreur/MapLivraisonClient";
import { getT } from "@/lib/i18n/serveur";
import { STATUTS_COURSE_ACTIVE } from "@/lib/commandes";

const STATUT: Record<string, { label: string; color: string; bg: string }> = {
  confirmee:      { label: "À récupérer",   color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  en_preparation: { label: "Préparation",   color: "#a78bfa", bg: "rgba(167,139,250,0.1)" },
  expediee:       { label: "En livraison",  color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  tentative_echouee: { label: "À retenter", color: "#f87171", bg: "rgba(248,113,113,0.1)" },
  livree:         { label: "Livré ✓",       color: "#34d399", bg: "rgba(52,211,153,0.1)" },
};

export default async function LivreurDashboard() {
  const t = await getT();
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

  const [commandesActives, livraisonsJour, livraisonsSemaine, especesNonRemises] = await Promise.all([
    prisma.commande.findMany({
      where: { livreurId: livreur.id, statut: { in: STATUTS_COURSE_ACTIVE } },
      include: { lignes: { take: 3 } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.commande.count({ where: { livreurId: livreur.id, statut: "livree", updatedAt: { gte: debutJour } } }),
    prisma.commande.count({ where: { livreurId: livreur.id, statut: "livree", updatedAt: { gte: debutSemaine } } }),
    // Même filtre que /api/livreurs/[id]/encaissements (côté marchand) : livré en COD, pas encore remis
    prisma.commande.findMany({
      where: { livreurId: livreur.id, methodePaiement: { in: ["whatsapp_cod", "direct_cod"] }, statut: "livree", codRemis: false },
      select: { montantTotal: true, devise: true, tenant: { select: { nomBoutique: true } } },
    }),
  ]);

  // Un livreur plateforme peut travailler pour plusieurs boutiques : on regroupe par boutique (et devise)
  const aReverser = Object.values(especesNonRemises.reduce<Record<string, { boutique: string; devise: string; total: number; nb: number }>>((acc, c) => {
    const k = `${c.tenant.nomBoutique}|${c.devise}`;
    acc[k] ??= { boutique: c.tenant.nomBoutique, devise: c.devise, total: 0, nb: 0 };
    acc[k].total += c.montantTotal;
    acc[k].nb += 1;
    return acc;
  }, {}));

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
    <div className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0 lg:items-start">
      {/* Hero card */}
      <div className="relative rounded-3xl overflow-hidden lg:col-span-2">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B4FD8]/20 via-[#1B4FD8]/5 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1B4FD820,_transparent_60%)]" />
        <div className="relative p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">
                {now.toLocaleDateString(t.loc, { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <h1 className="text-2xl font-bold text-white font-playfair">
                {t("Bonjour,")}{" "}{t(livreur.nom.split(" ")[0])}
              </h1>
              <p className="text-gray-400 text-sm mt-1 flex items-center gap-1">
                <VehiculeIcon vehicule={livreur.vehicule} />
                {t(VEHICULE_LABELS[livreur.vehicule]) || t("Livraison")}{livreur.zone ? ` · ${livreur.zone}` : ""}
              </p>
            </div>
            {livreur.disponible ? (
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-xl">
                <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium">{t("Actif")}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-xl">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                <span className="text-red-400 text-xs font-medium">{t("Hors service")}</span>
              </div>
            )}
          </div>

          {/* Stats du jour */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-[#1B4FD8]">{commandesActives.length}</p>
              <p className="text-gray-400 text-xs mt-1">{t("En cours")}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-green-400">{t(livraisonsJour)}</p>
              <p className="text-gray-400 text-xs mt-1">{t("Auj.")}</p>
            </div>
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-3 text-center border border-white/10">
              <p className="text-2xl font-bold text-[#a78bfa]">{t(livraisonsSemaine)}</p>
              <p className="text-gray-400 text-xs mt-1">{t("Cette semaine")}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Espèces à reverser */}
      {aReverser.length > 0 && (
        <div className="lg:col-span-2 rounded-3xl border border-[#F5A623]/25 bg-[#F5A623]/[0.07] p-5">
          <p className="text-[#F5A623] font-semibold text-sm">{t("Espèces à reverser")}</p>
          <div className="mt-3 space-y-2">
            {aReverser.map(r => (
              <div key={`${r.boutique}|${r.devise}`} className="flex items-center justify-between gap-3">
                <span className="text-gray-300 text-sm truncate">{t(r.boutique)}{" "}<span className="text-gray-500 text-xs">· {t("{0} livraison(s)", r.nb)}</span></span>
                <span className="text-white font-bold whitespace-nowrap">{formatMontant(r.total, r.devise)}</span>
              </div>
            ))}
          </div>
          <p className="text-gray-500 text-xs mt-3">{t("Le montant disparaît dès que la boutique confirme avoir reçu l'argent.")}</p>
        </div>
      )}

      {/* Commande prioritaire avec carte */}
      {commandePrioritaire && (
        <div className={`space-y-3 ${commandesActives.length === 1 ? "lg:col-span-2" : ""}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold flex items-center gap-2">
              <Zap size={16} className="text-[#1B4FD8]" />
              {t("Livraison en cours")}
            </h2>
            <span className="text-xs px-2 py-1 rounded-lg font-medium"
              style={{ color: STATUT[commandePrioritaire.statut]?.color, backgroundColor: STATUT[commandePrioritaire.statut]?.bg }}>
              {t(STATUT[commandePrioritaire.statut]?.label)}
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
          {/* Pas de lien dans un lien (HTML invalide → erreur d'hydratation, et Maps/WhatsApp ouvraient la fiche) */}
          <div className="bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 hover:border-[#1B4FD8]/30 rounded-2xl p-4 transition-all">
              <Link href={`/livreur/commande/${commandePrioritaire.id}`} className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-white font-bold">{t(commandePrioritaire.clientNom)}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                    <MapPin size={12} />
                    <span>{t(commandePrioritaire.adresseLivraison)}, {t(commandePrioritaire.ville)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 text-gray-400 text-sm">
                    <Phone size={12} />
                    <span>{t(commandePrioritaire.clientTelephone)}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[#1B4FD8] font-bold text-lg">{formatMontant(commandePrioritaire.montantTotal, commandePrioritaire.devise)}</p>
                  <p className="text-gray-500 text-xs">{commandePrioritaire.lignes.length} article{commandePrioritaire.lignes.length > 1 ? "s" : ""}</p>
                </div>
              </Link>

              <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${commandePrioritaire.adresseLivraison}, ${commandePrioritaire.ville}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] py-2.5 rounded-xl text-sm"
                >
                  <Map size={14} />{" "}{t("Maps")}
                </a>
                <a
                  href={`https://wa.me/${commandePrioritaire.clientTelephone.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 py-2.5 rounded-xl text-sm"
                >
                  <MessageCircle size={14} /> WhatsApp
                </a>
                <Link href={`/livreur/commande/${commandePrioritaire.id}`} className="flex items-center gap-1 text-gray-400 text-sm ml-auto px-3">
                  {t("Détails")}{" "}<ChevronRight size={14} />
                </Link>
              </div>
          </div>
        </div>
      )}

      {/* Autres commandes actives */}
      {commandesActives.length > 1 && (
        <div>
          <h2 className="text-white font-semibold mb-3 text-sm">{t("Autres en attente")}</h2>
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
                      <p className="text-white text-sm font-medium truncate">{t(cmd.clientNom)}</p>
                      <p className="text-gray-500 text-xs flex items-center gap-1 mt-0.5">
                        <MapPin size={9} />{t(cmd.ville)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <p className="text-[#1B4FD8] text-sm font-bold">{formatMontant(cmd.montantTotal, cmd.devise)}</p>
                      <span className="text-[10px] mt-0.5" style={{ color: st.color }}>{t(st.label)}</span>
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
        <div className="lg:col-span-2 bg-gradient-to-br from-[#141414] to-[#0d0d0d] border border-white/5 rounded-3xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#1B4FD8]/10 flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-[#1B4FD8]" />
          </div>
          <p className="text-white font-semibold">{t("Aucune livraison assignée")}</p>
          <p className="text-gray-500 text-sm mt-2">{t("Votre responsable vous assignera la prochaine commande")}</p>
          {livreur.disponible && (
            <div className="flex items-center justify-center gap-2 mt-4 text-green-400 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              {t("Vous êtes disponible")}
            </div>
          )}
        </div>
      )}

      {/* Lien vers historique */}
      <Link href="/livreur/commandes" className="lg:col-span-2 flex items-center justify-center gap-2 w-full text-gray-500 hover:text-gray-300 text-sm py-3 transition-colors">
        <TrendingUp size={14} />
        {t("Voir tout l'historique (")}{t(livraisonsSemaine)}{" "}{t("cette semaine)")}
      </Link>
    </div>
  );
}
