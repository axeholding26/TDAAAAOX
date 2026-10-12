// Supervision des caisses — LIVE OPERATIONS (§61).
// GET /api/pos/supervision?debut=&fin=&tz=            → toutes les caisses, scanners, transactions, alertes
// GET /api/pos/supervision?caisseId=…&debut=&fin=     → en plus, le détail de cette caisse
// Droit : voir_caisse.
//
// État d'une caisse :
// - "active"  🟢 session ouverte ET poste vu depuis moins de 2 minutes (le poste
//              donne signe de vie toutes les 15 s par son flux temps réel) ;
// - "muette"  🟠 session ouverte, mais poste silencieux : écran fermé, poste
//              éteint ou hors ligne — la caisse n'est pas forcément en panne ;
// - "fermee"  🔴 aucune session ouverte (ou caisse désactivée).
// Scanners : en ligne d'après AppareilPos.dernierSignalAt (seuil du lot scanner).
import { prisma } from "@/lib/prisma";
import { routePos } from "@/lib/pos/acces";
import { aDroit, exigerDroit } from "@/lib/pos/droits";
import { erreurs } from "@/lib/pos/erreurs";
import { nomsUtilisateurs } from "@/lib/pos/caisse/mouvements";
import { SEUIL_SIGNAL_MS } from "@/lib/pos/scanner/regles";
import { agregerVentes, lireFiltres, ouVente } from "@/lib/pos/analytics/ventes";
import { calculerAlertes } from "@/lib/pos/alertes";

const SEUIL_POSTE_MS = 120_000;

export const GET = routePos(async (ctx, req) => {
  exigerDroit(ctx, "voir_caisse");
  const p = new URL(req.url).searchParams;
  const f = await lireFiltres(ctx, p);
  const { tenantId } = ctx;
  const maintenant = Date.now();

  const [tenant, magasins, sessions, appareils, parCaisse, alertes] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { devise: true } }),
    prisma.magasin.findMany({
      where: { tenantId, ...(f.magasinsAutorises.length ? { id: { in: f.magasinsAutorises } } : {}) },
      orderBy: { createdAt: "asc" },
      select: { id: true, nom: true, demo: true, actif: true, caisses: { orderBy: { createdAt: "asc" }, select: { id: true, nom: true, actif: true, dernierSignalAt: true } } },
    }),
    prisma.sessionCaisse.findMany({ where: { tenantId, statut: "ouverte" }, select: { id: true, caisseId: true, ouvertePar: true, ouverteAt: true, fondsInitial: true, nbVentes: true } }),
    prisma.appareilPos.findMany({ where: { tenantId, statut: "actif" }, orderBy: { createdAt: "asc" }, select: { id: true, nom: true, type: true, caisseId: true, dernierSignalAt: true } }),
    agregerVentes(f, "caisse"),
    calculerAlertes(tenantId, { voirCouts: aDroit(ctx, "voir_couts") }),
  ]);
  const noms = await nomsUtilisateurs(tenantId, sessions.map((s) => s.ouvertePar));
  const enLigne = (d: Date | null) => !!d && maintenant - d.getTime() < SEUIL_SIGNAL_MS;

  const caisses = magasins.flatMap((m) => m.caisses.map((c) => {
    const session = sessions.find((s) => s.caisseId === c.id) ?? null;
    const vu = !!c.dernierSignalAt && maintenant - c.dernierSignalAt.getTime() < SEUIL_POSTE_MS;
    const ventes = parCaisse.find((a) => a.cle === c.id);
    const scanners = appareils.filter((a) => a.caisseId === c.id);
    return {
      id: c.id, nom: c.nom, actif: c.actif, magasinId: m.id, magasinNom: m.nom, demo: m.demo,
      etat: !c.actif || !session ? "fermee" as const : vu ? "active" as const : "muette" as const,
      dernierSignalAt: c.dernierSignalAt?.toISOString() ?? null,
      session: session && { id: session.id, ouverteAt: session.ouverteAt.toISOString(), caissier: noms[session.ouvertePar] ?? "Utilisateur", fondsInitial: session.fondsInitial, nbVentes: session.nbVentes },
      ventes: { transactions: ventes?.transactions ?? 0, ca: ventes?.ca ?? 0 },
      scanners: scanners.length, scannersEnLigne: scanners.filter((a) => enLigne(a.dernierSignalAt)).length,
    };
  }));

  // ─── Détail d'une caisse ────────────────────────────────────────────────────
  const caisseId = p.get("caisseId");
  let detail = null;
  if (caisseId) {
    const caisse = caisses.find((c) => c.id === caisseId);
    if (!caisse) throw erreurs.introuvable("Cette caisse");
    const ventes = await prisma.commande.findMany({
      where: { ...ouVente(f), caisseId, statut: undefined },
      orderBy: { createdAt: "desc" }, take: 15,
      select: { id: true, numero: true, montantTotal: true, statut: true, createdAt: true, vendeurId: true, clientNom: true },
    });
    const vendeurs = await nomsUtilisateurs(tenantId, ventes.map((v) => v.vendeurId));
    detail = {
      caisse,
      ventes: ventes.map((v) => ({ id: v.id, numero: v.numero, total: v.montantTotal, annulee: v.statut === "annulee", createdAt: v.createdAt.toISOString(), vendeur: v.vendeurId ? vendeurs[v.vendeurId] ?? "Utilisateur" : null, client: v.clientNom })),
      appareils: appareils.filter((a) => a.caisseId === caisseId).map((a) => ({ id: a.id, nom: a.nom, type: a.type, dernierSignalAt: a.dernierSignalAt?.toISOString() ?? null, enLigne: enLigne(a.dernierSignalAt) })),
    };
  }

  const reelles = caisses.filter((c) => !c.demo);
  return {
    devise: tenant.devise, serveurAt: new Date(maintenant).toISOString(),
    periode: { debut: f.debut.toISOString(), fin: f.fin.toISOString() },
    caisses,
    resume: {
      actives: reelles.filter((c) => c.etat === "active").length,
      muettes: reelles.filter((c) => c.etat === "muette").length,
      fermees: reelles.filter((c) => c.etat === "fermee").length,
      scanners: reelles.reduce((s, c) => s + c.scanners, 0),
      scannersEnLigne: reelles.reduce((s, c) => s + c.scannersEnLigne, 0),
      transactions: reelles.reduce((s, c) => s + c.ventes.transactions, 0),
      ca: reelles.reduce((s, c) => s + c.ventes.ca, 0),
    },
    alertes,
    detail,
  };
});
