import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { formatDate, dateRelative } from "@/lib/utils";
import { Truck, MapPin, CheckCircle, XCircle, Bike, Car, Package, Navigation, UserCheck, ExternalLink } from "lucide-react";
import { getAdminSession, estAdminComplet } from "@/lib/admin-auth";
import { changerActivationLivreur } from "@/lib/admin-actions";
import { revalidatePath } from "next/cache";
import { getT } from "@/lib/i18n/serveur";

// Valider (activer) ou suspendre un livreur. Un livreur qui s'inscrit seul
// arrive inactif et ne peut pas être assigné tant qu'un admin ne l'a pas validé.
async function basculerActif(formData: FormData) {
  "use server";
  if (!estAdminComplet(await getAdminSession())) return;
  const id = String(formData.get("id"));
  const livreur = await prisma.livreur.findUnique({ where: { id }, select: { actif: true } });
  if (!livreur) return;
  await changerActivationLivreur(id, !livreur.actif); // partagé avec AXIA admin
  revalidatePath("/admin/livreurs");
  revalidatePath("/admin");
}

const VEHICULES: Record<string, { label: string; icon: any }> = {
  moto: { label: "Moto", icon: Bike },
  voiture: { label: "Voiture", icon: Car },
  velo: { label: "Vélo", icon: Bike },
  a_pied: { label: "À pied", icon: Package }, // valeur enregistrée par /api/livreurs/inscription
  pied: { label: "À pied", icon: Package },
};

// Au-delà, la position n'est plus "en direct" (le GeoTracker envoie toutes les 30 s).
const POSITION_FRAICHE_MS = 5 * 60_000;
// Une course en ville dépasse rarement 1 h : au-delà, la ligne passe en rouge.
const LIVRAISON_LONGUE_MS = 60 * 60_000;

// Palette alignée sur la charte Axso (accent unique + sémantiques officiels).
const C = {
  accent: "#F5A623",
  success: "#16A34A",
  error: "#DC2626",
  warning: "#D97706",
  text1: "#FFFFFF",
  text2: "#AAAAAA",
  text3: "#666666",
  carte: "#1A1A1A",
  bordure: "rgba(255,255,255,0.08)",
};

export default async function AdminLivreursPage() {
  const t = await getT();
  const session = await getAdminSession();
  if (!session) redirect("/dashboard");
  const peutModifier = estAdminComplet(session);

  const [livreurs, livrees, echecs, enCours] = await Promise.all([
    prisma.livreur.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { email: true } },
        tenant: { select: { nomBoutique: true, slug: true } },
        _count: { select: { commandes: true } },
      },
    }),
    prisma.commande.groupBy({ by: ["livreurId"], where: { livreurId: { not: null }, statut: "livree" }, _count: true }),
    prisma.commande.groupBy({ by: ["livreurId"], where: { livreurId: { not: null }, echecCount: { gt: 0 } }, _sum: { echecCount: true } }),
    prisma.commande.findMany({
      where: { livreurId: { not: null }, statut: { in: ["expediee", "tentative_echouee"] } },
      orderBy: [{ expedieeAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      take: 100,
      select: {
        id: true, numero: true, statut: true, ville: true, createdAt: true, expedieeAt: true, echecCount: true,
        livreurPosition: true, trackingToken: true,
        tenant: { select: { nomBoutique: true, slug: true } },
        livreur: { select: { nom: true, telephone: true } },
      },
    }),
  ]);

  const nbLivrees = new Map(livrees.map(g => [g.livreurId, g._count]));
  const nbEchecs = new Map(echecs.map(g => [g.livreurId, g._sum.echecCount ?? 0]));

  const aValider = livreurs.filter(l => !l.actif && !l.valideAt);
  const independants = livreurs.filter(l => !l.tenantId);
  const disponibles = livreurs.filter(l => l.disponible && l.actif).length;

  const stats = [
    { label: "Total livreurs", value: livreurs.length, color: C.accent },
    { label: "À valider", value: aValider.length, color: aValider.length ? C.warning : C.text2 },
    { label: "Disponibles", value: disponibles, color: C.success },
    { label: "Livraisons en cours", value: enCours.length, color: C.text2 },
    { label: "Indépendants", value: independants.length, color: C.text2 },
  ];

  const th = "px-5 py-3 text-left text-xs font-medium";
  const maintenant = Date.now();

  const boutonActif = (id: string, actif: boolean) => peutModifier && (
    <form action={basculerActif}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
        style={actif
          ? { background: "rgba(220,38,38,0.1)", color: C.error, border: "1px solid rgba(220,38,38,0.25)" }
          : { background: "rgba(22,163,74,0.12)", color: C.success, border: "1px solid rgba(22,163,74,0.3)" }}>
        {actif ? t("Suspendre") : t("Valider")}
      </button>
    </form>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: C.text1 }}>{t("Livreurs")}</h1>
        <p className="text-sm mt-1" style={{ color: C.text2 }}>{livreurs.length}{" "}{t("livreurs sur la plateforme")}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((s, i) => (
          <div key={i} className="rounded-2xl p-5 border" style={{ background: C.carte, borderColor: C.bordure }}>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{t(s.value)}</p>
            <p className="text-xs mt-1" style={{ color: C.text2 }}>{t(s.label)}</p>
          </div>
        ))}
      </div>

      {/* À valider */}
      {aValider.length > 0 && (
        <div className="rounded-2xl overflow-hidden border" style={{ background: C.carte, borderColor: "rgba(217,119,6,0.35)" }}>
          <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: C.bordure }}>
            <UserCheck size={15} style={{ color: C.warning }} />
            <h2 className="font-semibold" style={{ color: C.text1 }}>{t("En attente de validation")}</h2>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(217,119,6,0.15)", color: C.warning }}>{aValider.length}</span>
          </div>
          <div className="divide-y" style={{ borderColor: C.bordure }}>
            {aValider.map(l => (
              <div key={l.id} className="px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                <div className="min-w-[180px] flex-1">
                  <p className="font-medium" style={{ color: C.text1 }}>{t(l.nom)}</p>
                  <p className="text-xs" style={{ color: C.text2 }}>{l.user.email}</p>
                </div>
                <a href={`tel:${l.telephone}`} className="font-mono text-xs" style={{ color: C.text2 }}>{l.telephone}</a>
                <span className="text-xs" style={{ color: C.text2 }}>{t((VEHICULES[l.vehicule] || VEHICULES.moto).label)}{l.zone ? ` · ${l.zone}` : ""}</span>
                <span className="text-xs" style={{ color: C.text3 }}>{t("Inscrit")}{" "}{dateRelative(l.createdAt).toLowerCase()}</span>
                {boutonActif(l.id, false)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Livraisons en cours */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: C.carte, borderColor: C.bordure }}>
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: C.bordure }}>
          <Navigation size={15} style={{ color: C.accent }} />
          <h2 className="font-semibold" style={{ color: C.text1 }}>{t("Livraisons en cours")}</h2>
        </div>
        {enCours.length === 0 ? (
          <p className="px-6 py-8 text-sm text-center" style={{ color: C.text3 }}>{t("Aucune livraison en route pour le moment")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: C.bordure }}>
                  {["Commande", "Boutique", "Livreur", "Statut", "Parti", "Dernière position", "Suivi"].map(h => (
                    <th key={h} className={th} style={{ color: C.text2 }}>{t(h)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: C.bordure }}>
                {enCours.map(c => {
                  const pos = c.livreurPosition as { updatedAt?: string } | null;
                  const majPos = pos?.updatedAt ? new Date(pos.updatedAt) : null;
                  const fraiche = majPos && maintenant - majPos.getTime() < POSITION_FRAICHE_MS;
                  const enRetard = c.statut === "expediee" && c.expedieeAt && maintenant - c.expedieeAt.getTime() > LIVRAISON_LONGUE_MS;
                  return (
                    <tr key={c.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs" style={{ color: C.text1 }}>#{c.numero}</p>
                        <p className="text-xs" style={{ color: C.text3 }}>{t(c.ville)}</p>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: C.text2 }}>{t(c.tenant.nomBoutique)}</td>
                      <td className="px-5 py-3">
                        <p className="text-xs" style={{ color: C.text1 }}>{t(c.livreur?.nom)}</p>
                        {c.livreur?.telephone && <a href={`tel:${c.livreur.telephone}`} className="font-mono text-[11px]" style={{ color: C.text3 }}>{c.livreur.telephone}</a>}
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={c.statut === "expediee"
                            ? { background: "rgba(245,166,35,0.12)", color: C.accent }
                            : { background: "rgba(220,38,38,0.12)", color: C.error }}>
                          {c.statut === "expediee" ? t("En route") : t("Échec ×{0}", c.echecCount)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: enRetard ? C.error : C.text2 }}>
                        {c.expedieeAt ? (
                          <>
                            {c.expedieeAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            <span className="block text-[11px]" style={{ color: enRetard ? C.error : C.text3 }}>{dateRelative(c.expedieeAt)}</span>
                          </>
                        ) : (
                          <span style={{ color: C.text3 }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {majPos ? (
                          <span className="flex items-center gap-1.5" style={{ color: fraiche ? C.success : C.warning }}>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: fraiche ? C.success : C.warning }} />
                            {dateRelative(majPos)}
                          </span>
                        ) : (
                          <span style={{ color: C.text3 }}>{t("Jamais partagée")}</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        {c.trackingToken && (
                          <a href={`/${c.tenant.slug}/tracking/${c.trackingToken}`} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs" style={{ color: C.accent }}>
                            {t("Voir")}{" "}<ExternalLink size={11} />
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table livreurs */}
      <div className="rounded-2xl overflow-hidden border" style={{ background: C.carte, borderColor: C.bordure }}>
        <div className="px-6 py-4 border-b flex items-center gap-2" style={{ borderColor: C.bordure }}>
          <Truck size={15} style={{ color: C.accent }} />
          <h2 className="font-semibold" style={{ color: C.text1 }}>{t("Tous les livreurs")}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: C.bordure }}>
                {["Livreur", "Téléphone", "Véhicule", "Zone", "Boutique", "Livrées", "Échecs", "Position", "Statut", "Inscrit le"].map(h => (
                  <th key={h} className={th} style={{ color: C.text2 }}>{t(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: C.bordure }}>
              {livreurs.map(l => {
                const vehicule = VEHICULES[l.vehicule] || VEHICULES.moto;
                const VehiculeIcon = vehicule.icon;
                const fraiche = l.positionAt && maintenant - l.positionAt.getTime() < POSITION_FRAICHE_MS;
                const nbEchec = nbEchecs.get(l.id) ?? 0;
                return (
                  <tr key={l.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(245,166,35,0.12)", color: C.accent }}>
                          {l.nom.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium" style={{ color: C.text1 }}>{t(l.nom)}</p>
                          <p className="text-[11px]" style={{ color: C.text3 }}>{l.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs" style={{ color: C.text2 }}>{l.telephone}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5" style={{ color: C.text2 }}>
                        <VehiculeIcon size={13} />
                        <span className="text-xs">{t(vehicule.label)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: C.text2 }}>{t(l.zone) || "—"}</td>
                    <td className="px-5 py-4">
                      {l.tenant ? (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(245,166,35,0.1)", color: C.accent, border: "1px solid rgba(245,166,35,0.2)" }}>
                          {t(l.tenant.nomBoutique)}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(255,255,255,0.06)", color: C.text2, border: `1px solid ${C.bordure}` }}>
                          {t("Plateforme")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ color: C.text1 }}>{t(nbLivrees.get(l.id) ?? 0)}</td>
                    <td className="px-5 py-4 text-center" style={{ color: nbEchec ? C.error : C.text3 }}>{t(nbEchec)}</td>
                    <td className="px-5 py-4">
                      {l.latitude && l.longitude && l.positionAt ? (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${l.latitude},${l.longitude}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs" style={{ color: fraiche ? C.success : C.warning }}>
                          <MapPin size={11} />
                          <span>{dateRelative(l.positionAt)}</span>
                        </a>
                      ) : (
                        <span className="text-xs" style={{ color: C.text3 }}>{t("Non partagée")}</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {l.actif
                            ? <CheckCircle size={11} style={{ color: C.success }} />
                            : <XCircle size={11} style={{ color: C.error }} />}
                          <span className="text-[10px]" style={{ color: l.actif ? C.success : C.error }}>
                            {l.actif ? t("Actif") : l.valideAt ? t("Suspendu") : t("En attente")}
                          </span>
                        </div>
                        {boutonActif(l.id, l.actif)}
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full"
                            style={{ background: l.disponible ? C.success : C.text3 }} />
                          <span className="text-[10px]" style={{ color: l.disponible ? C.success : C.text3 }}>
                            {l.disponible ? t("Dispo") : t("Occupé")}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: C.text2 }}>{formatDate(l.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {livreurs.length === 0 && (
            <div className="py-16 text-center" style={{ color: C.text3 }}>
              <Truck size={32} className="mx-auto mb-3 opacity-30" />
              <p>{t("Aucun livreur inscrit")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
