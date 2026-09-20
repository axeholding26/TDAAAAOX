import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, Phone, Mail, Package, Clock, CheckCircle, Truck, XCircle, User, CreditCard, Lock, Unlock, FileText, Map, Share2 } from "lucide-react";
import { formatMontant, dateRelative } from "@/lib/utils";
import { StatutCommandeSelector } from "@/components/dashboard/StatutCommandeSelector";
import { AssignerLivreur } from "@/components/dashboard/AssignerLivreur";

const STATUT_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  en_attente:    { label: "En attente",      icon: Clock,        color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  confirmee:     { label: "Confirmée",       icon: CheckCircle,  color: "#60a5fa", bg: "rgba(96,165,250,0.1)" },
  en_preparation:{ label: "En préparation",  icon: Package,      color: "#FFD280", bg: "rgba(167,139,250,0.1)" },
  expediee:      { label: "Expédiée",        icon: Truck,        color: "#38bdf8", bg: "rgba(56,189,248,0.1)" },
  livree:        { label: "Livrée",          icon: CheckCircle,  color: "#34d399", bg: "rgba(52,211,153,0.1)" },
  annulee:       { label: "Annulée",         icon: XCircle,      color: "#f87171", bg: "rgba(248,113,113,0.1)" },
};

export default async function CommandeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/connexion");

  const tenantId = (session.user as any)?.tenantId;
  const { id } = await params;

  const [commande, livreurs] = await Promise.all([
    prisma.commande.findFirst({
      where: { id, tenantId },
      include: {
        lignes: { include: { produit: { select: { slug: true } } } },
        client: true,
        livreur: { include: { user: { select: { email: true } } } },
        commission: true,
        escrow: true,
        codePromo: true,
        tenant: { select: { slug: true, nomBoutique: true, logoUrl: true } },
      },
    }),
    prisma.livreur.findMany({
      where: { actif: true },
      include: { user: { select: { email: true } } },
      orderBy: { disponible: "desc" },
    }),
  ]);

  if (!commande) notFound();

  const statutInfo = STATUT_CONFIG[commande.statut] || STATUT_CONFIG.en_attente;
  const StatutIcon = statutInfo.icon;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/commandes" className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-400 hover:text-[#F5A623] hover:border-[#F5A623]/30 transition-all">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[#111111] font-mono">{commande.numero}</h1>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                style={{ color: statutInfo.color, backgroundColor: statutInfo.bg }}>
                <StatutIcon size={11} />
                {statutInfo.label}
              </div>
            </div>
            <p className="text-gray-500 text-xs mt-0.5">{dateRelative(commande.createdAt)}</p>
          </div>
        </div>
        <StatutCommandeSelector commandeId={commande.id} statutActuel={commande.statut} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-5">
          {/* Articles commandés */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="text-[#111111] font-semibold text-sm mb-4 flex items-center gap-2">
              <Package size={14} className="text-[#F5A623]" />
              Articles ({commande.lignes.length})
            </h2>
            <div className="space-y-4">
              {commande.lignes.map((ligne) => (
                <div key={ligne.id} className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-200 overflow-hidden flex-shrink-0">
                    {ligne.imageUrl ? (
                      <img src={ligne.imageUrl} alt={ligne.nom} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={24} className="text-gray-300" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#111111] font-medium text-sm truncate">{ligne.nom}</p>
                    {ligne.variante && <p className="text-gray-500 text-xs">{ligne.variante}</p>}
                    <p className="text-gray-400 text-xs mt-0.5">Qté : {ligne.quantite} × {formatMontant(ligne.prix, commande.devise)}</p>
                  </div>
                  <p className="text-[#F5A623] font-bold text-sm flex-shrink-0">
                    {formatMontant(ligne.prix * ligne.quantite, commande.devise)}
                  </p>
                </div>
              ))}
            </div>

            {/* Totaux */}
            <div className="border-t border-gray-100 mt-5 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Sous-total</span>
                <span className="text-[#111111]">{formatMontant(commande.montantSousTotal, commande.devise)}</span>
              </div>
              {commande.montantLivraison > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Livraison</span>
                  <span className="text-[#111111]">{formatMontant(commande.montantLivraison, commande.devise)}</span>
                </div>
              )}
              {commande.montantReduction > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Réduction {commande.codePromo && `(${commande.codePromo.code})`}</span>
                  <span className="text-green-400">−{formatMontant(commande.montantReduction, commande.devise)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-gray-100">
                <span className="text-[#111111]">Total</span>
                <span className="text-[#F5A623]">{formatMontant(commande.montantTotal, commande.devise)}</span>
              </div>
            </div>
          </div>

          {/* Paiement & Escrow */}
          <div className="bg-white border border-gray-100 rounded-2xl p-6">
            <h2 className="text-[#111111] font-semibold text-sm mb-4 flex items-center gap-2">
              <CreditCard size={14} className="text-[#F5A623]" />
              Paiement & Escrow
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Méthode</span>
                <span className="text-[#111111] capitalize">{commande.methodePaiement}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Statut paiement</span>
                <span className={`text-xs px-2 py-1 rounded-lg font-medium ${
                  commande.paiementStatut === "completed" ? "bg-green-500/20 text-green-400" :
                  commande.paiementStatut === "pending" ? "bg-yellow-500/20 text-yellow-400" :
                  "bg-red-500/20 text-red-400"
                }`}>
                  {commande.paiementStatut === "completed" ? "Payé" :
                   commande.paiementStatut === "pending" ? "En attente" : commande.paiementStatut}
                </span>
              </div>
              {commande.flutterwaveRef && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Référence</span>
                  <span className="text-[#111111] font-mono text-xs">{commande.flutterwaveRef}</span>
                </div>
              )}

              {commande.escrow && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2 mb-2">
                    {commande.escrow.statut === "released" ? (
                      <Unlock size={13} className="text-green-400" />
                    ) : (
                      <Lock size={13} className="text-[#F5A623]" />
                    )}
                    <span className="text-[#111111] text-xs font-medium">
                      Escrow : {commande.escrow.statut === "held" ? "Fonds retenus" :
                                commande.escrow.statut === "released" ? "Fonds libérés" : commande.escrow.statut}
                    </span>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Montant retenu</span>
                      <span className="text-[#F5A623]">{formatMontant(commande.escrow.montant, commande.devise)}</span>
                    </div>
                    {commande.escrow.releaseAt && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Libération</span>
                        <span className="text-[#111111]">{new Date(commande.escrow.releaseAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {commande.commission && (
                <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                  <p className="text-gray-400 font-medium">Commission Axso (6%)</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Commission brute</span>
                    <span className="text-[#111111]">{formatMontant(commande.commission.montantCommission, commande.devise)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Votre part</span>
                    <span className="text-green-400">{formatMontant(commande.commission.montantMarchand, commande.devise)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Note client */}
          {commande.noteClient && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <p className="text-gray-400 text-xs mb-2">Note du client</p>
              <p className="text-gray-600 text-sm italic">"{commande.noteClient}"</p>
            </div>
          )}
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {/* Client */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-[#111111] font-semibold text-sm mb-4 flex items-center gap-2">
              <User size={14} className="text-[#F5A623]" />
              Client
            </h2>
            <div className="space-y-3">
              <div>
                <p className="text-[#111111] font-medium">{commande.clientNom}</p>
                {commande.client && <p className="text-gray-500 text-xs mt-0.5">{commande.client.totalCommandes} commande(s)</p>}
              </div>
              <a href={`mailto:${commande.clientEmail}`} className="flex items-center gap-2 text-gray-400 hover:text-[#F5A623] text-sm transition-colors">
                <Mail size={13} className="text-gray-500" />
                {commande.clientEmail}
              </a>
              <a href={`tel:${commande.clientTelephone}`} className="flex items-center gap-2 text-gray-400 hover:text-[#F5A623] text-sm transition-colors">
                <Phone size={13} className="text-gray-500" />
                {commande.clientTelephone}
              </a>
            </div>
          </div>

          {/* Livraison */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-[#111111] font-semibold text-sm mb-4 flex items-center gap-2">
              <MapPin size={14} className="text-[#F5A623]" />
              Adresse de livraison
            </h2>
            <div className="space-y-1.5 text-sm">
              <p className="text-[#111111]">{commande.adresseLivraison}</p>
              <p className="text-gray-400">{commande.ville}, {commande.pays}</p>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${commande.adresseLivraison}, ${commande.ville}`)}`}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-[#60a5fa] py-2.5 rounded-xl text-xs justify-center hover:bg-[#3b82f6]/20 transition-all"
            >
              <MapPin size={12} /> Voir sur Maps
            </a>
          </div>

          {/* Livreur assigné */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-[#111111] font-semibold text-sm mb-4 flex items-center gap-2">
              <Truck size={14} className="text-[#F5A623]" />
              Livreur
            </h2>
            {commande.livreur ? (
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${commande.livreur.disponible ? "bg-green-400" : "bg-gray-500"}`} />
                  <p className="text-[#111111] font-medium text-sm">{commande.livreur.nom}</p>
                </div>
                <p className="text-gray-400 text-xs">{commande.livreur.telephone}</p>
                <a href={`tel:${commande.livreur.telephone}`} className="flex items-center gap-2 bg-gray-50 border border-gray-200 text-gray-600 py-2 px-3 rounded-xl text-xs hover:border-[#F5A623]/30 transition-all">
                  <Phone size={11} /> Appeler le livreur
                </a>
              </div>
            ) : (
              <p className="text-gray-500 text-xs mb-3">Aucun livreur assigné</p>
            )}
            <AssignerLivreur
              commandeId={commande.id}
              livreurActuelId={commande.livreurId || null}
              livreurs={livreurs.map(l => ({
                id: l.id,
                nom: l.nom,
                vehicule: l.vehicule,
                zone: l.zone,
                disponible: l.disponible,
              }))}
            />
          </div>

          {/* Suivi */}
          {(commande.numeroSuivi || commande.transporteur) && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <h2 className="text-[#111111] font-semibold text-sm mb-3">Suivi colis</h2>
              {commande.transporteur && <p className="text-gray-400 text-xs">{commande.transporteur}</p>}
              {commande.numeroSuivi && <p className="text-[#111111] font-mono text-sm mt-1">{commande.numeroSuivi}</p>}
            </div>
          )}

          {/* ─── Tracking temps réel & Livraison ─── */}
          {(commande as any).trackingToken && (
            <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-3">
              <h2 className="text-[#111111] font-semibold text-sm flex items-center gap-2">
                <Truck size={14} className="text-[#F5A623]" />
                Tracking & Livraison
              </h2>

              {/* Localisation client */}
              {((commande as any).latitudeClient || (commande as any).adresseExacte) && (
                <div className="bg-gray-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Position client GPS</p>
                  {(commande as any).adresseExacte && <p className="text-sm text-[#111111]">{(commande as any).adresseExacte}</p>}
                  {(commande as any).latitudeClient && (
                    <p className="text-xs text-gray-500 font-mono">{(commande as any).latitudeClient?.toFixed(5)}, {(commande as any).longitudeClient?.toFixed(5)}</p>
                  )}
                  {(commande as any).mapsLienClient && (
                    <a href={(commande as any).mapsLienClient} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[#60a5fa] text-xs hover:underline">
                      <MapPin size={11} /> Ouvrir Google Maps
                    </a>
                  )}
                </div>
              )}

              {/* Liens marchand */}
              <div className="space-y-2">
                {/* Facture */}
                <a href={`/${(commande as any).tenant?.slug ?? ""}/facture/${(commande as any).trackingToken}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-[#F5A623]/30 hover:text-[#F5A623] transition-all">
                  <FileText size={14} /> Voir la facture client
                </a>

                {/* Tracking client */}
                <a href={`/${(commande as any).tenant?.slug ?? ""}/tracking/${(commande as any).trackingToken}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 w-full py-2.5 px-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 hover:border-[#F5A623]/30 hover:text-[#F5A623] transition-all">
                  <Map size={14} /> Page de suivi (vue client)
                </a>

                {/* Lien livreur */}
                {(commande as any).livreurToken && (() => {
                  const slug = (commande as any).tenant?.slug ?? "";
                  const livreurUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${slug}/livreur/${(commande as any).livreurToken}`;
                  const clientTel = commande.clientTelephone?.replace(/\D/g, "");
                  const msg = encodeURIComponent(`🚚 *Livraison — ${(commande as any).tenant?.nomBoutique}*\n\nBonjour ! Vous êtes assigné à la livraison de la commande #${commande.numero}.\n\n👤 Client : ${commande.clientNom}\n📞 Tél : ${commande.clientTelephone}\n📍 Adresse : ${(commande as any).adresseExacte || commande.adresseLivraison}, ${commande.ville}\n${(commande as any).mapsLienClient ? `\n🗺️ Google Maps : ${(commande as any).mapsLienClient}\n` : ""}\n📡 Activez votre tracking GPS :\n${livreurUrl}\n\nMerci !`);
                  return (
                    <a href={`https://wa.me/?text=${msg}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition-all text-[#111111]"
                      style={{ background:"rgba(37,211,102,0.15)", border:"1px solid rgba(37,211,102,0.25)", color:"#25D366" }}>
                      <Share2 size={14} /> Partager avec le livreur (WhatsApp)
                    </a>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
