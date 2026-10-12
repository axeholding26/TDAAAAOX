// Journal opérationnel du magasin (§62) : ce qui s'est passé, dans l'ordre,
// filtrable par famille. Lecture seule.
// GET /api/pos/journal?categorie=&magasinId=&caisseId=&debut=&fin=&avant=&limite=
//   → { entrees, curseurSuivant, categories }
// Droit : voir_caisse ou voir_audit.
//
// Deux sources, sans doublon :
// - JournalAudit (permanent) : ventes, annulations, retours, mouvements et
//   fermetures de caisse, stock, achats, réglages… Ce journal-ci n'en montre
//   que le résumé ; l'état avant / après se lit dans le journal d'audit.
// - EvenementPos (purgé après 24 h) : seulement ce que l'audit ne trace pas —
//   scans, connexion et déconnexion des scanners, alertes, synchronisation.
//   Les scans de plus de 24 h ne sont donc plus listés ici.
// Pagination par curseur `avant` (date de la dernière entrée reçue).
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { droitsUtilisateur, routePos } from "@/lib/pos/acces";
import { exigerUnDroit } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";

/** Familles du journal → préfixes d'actions d'audit et types d'événements. */
const FAMILLES: Record<string, { libelle: string; audit: string[]; evenements: string[] }> = {
  ventes: { libelle: "Ventes", audit: ["vente."], evenements: [] },
  remboursements: { libelle: "Retours et remboursements", audit: ["retour.", "avoir."], evenements: [] },
  caisse: { libelle: "Caisse et paiements", audit: ["caisse.", "paiement.", "charge.", "credit.rembourse"], evenements: [] },
  stock: { libelle: "Stock", audit: ["stock.", "inventaire.", "transfert.", "lot.", "serie.", "produit."], evenements: [] },
  achats: { libelle: "Commandes fournisseur", audit: ["achat.", "reception.", "bon_commande.", "fournisseur.", "import."], evenements: [] },
  scanners: { libelle: "Scanners", audit: ["appareil."], evenements: ["scan.created", "device.connected", "device.disconnected"] },
  autres: { libelle: "Réglages et autres", audit: [], evenements: ["alert.created", "sync.completed"] },
};
const EVENEMENTS_SANS_AUDIT = Object.values(FAMILLES).flatMap((f) => f.evenements);
const PREFIXES_CONNUS = Object.values(FAMILLES).flatMap((f) => f.audit);

const TITRES: Record<string, string> = {
  "vente.creee": "Vente enregistrée", "vente.remise": "Remise ou geste commercial", "vente.annulee": "Vente annulée",
  "retour.cree": "Retour enregistré", "retour.echange": "Échange enregistré",
  "caisse.ouverte": "Caisse ouverte", "caisse.fermee": "Caisse fermée", "caisse.mouvement": "Mouvement de caisse", "caisse.creee": "Caisse créée", "caisse.modifiee": "Caisse modifiée",
  "paiement.rapproche": "Paiement pointé", "credit.rembourse": "Dette client encaissée",
  "charge.creee": "Charge enregistrée", "charge.modifiee": "Charge modifiée", "charge.supprimee": "Charge supprimée",
  "lot.recu": "Lot reçu", "produit.cree": "Produit créé", "serie.enregistree": "Numéro de série enregistré",
  "appareil.appairage_ouvert": "Appairage d'un scanner demandé", "appareil.connecte": "Scanner appairé", "appareil.renomme": "Scanner renommé", "appareil.revoque": "Scanner révoqué",
  "magasin.cree": "Magasin créé", "magasin.modifie": "Magasin modifié", "reglages.modifies": "Réglages modifiés", "equipe.droits_modifies": "Droits d'un membre modifiés",
  "client.cree": "Client créé", "client.modifie": "Client modifié", "promotion.creee": "Promotion créée", "promotion.supprimee": "Promotion supprimée",
  "scan.created": "Scan", "device.connected": "Scanner connecté", "device.disconnected": "Scanner déconnecté", "alert.created": "Alerte", "sync.completed": "Synchronisation terminée",
};
const titre = (action: string) => TITRES[action] ?? action.replace(/[._]/g, " ").replace(/^./, (c) => c.toUpperCase());
const famille = (action: string) => Object.entries(FAMILLES).find(([, f]) => f.audit.some((p) => action.startsWith(p)) || f.evenements.includes(action))?.[0] ?? "autres";
const texte = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : null);

function lireDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new ErreurPos("invalide", 400, "La date demandée est illisible.");
  return d;
}

export const GET = routePos(async (ctx, req) => {
  exigerUnDroit(ctx, "voir_caisse", "voir_audit");
  const { tenantId } = ctx;
  const p = new URL(req.url).searchParams;
  const limite = Math.min(Math.max(Number(p.get("limite")) || 50, 1), 100);
  const categorie = p.get("categorie") && p.get("categorie")! in FAMILLES ? p.get("categorie")! : null;
  const debut = lireDate(p.get("debut")), fin = lireDate(p.get("fin")), avant = lireDate(p.get("avant"));
  const magasinsAutorises = (await droitsUtilisateur(tenantId, ctx.userId))?.magasinIds ?? [];
  const magasinId = p.get("magasinId") || null, caisseId = p.get("caisseId") || null;
  if (magasinId && magasinsAutorises.length && !magasinsAutorises.includes(magasinId)) throw new ErreurPos("non_autorise", 403, "Vous n'êtes pas affecté à ce magasin. Demandez à un responsable.");

  const periode = { ...(debut ? { gte: debut } : {}), ...(fin ? { lte: fin } : {}), ...(avant ? { lt: avant } : {}) };
  const lieu = {
    ...(magasinId ? { magasinId } : magasinsAutorises.length ? { OR: [{ magasinId: { in: magasinsAutorises } }, { magasinId: null }] } : {}),
    ...(caisseId ? { caisseId } : {}),
  };
  const f = categorie ? FAMILLES[categorie] : null;
  const filtreAudit: Prisma.JournalAuditWhereInput =
    !f ? {}
    : categorie === "autres" ? { NOT: PREFIXES_CONNUS.map((x) => ({ action: { startsWith: x } })) }
    : { OR: f.audit.map((x) => ({ action: { startsWith: x } })) };
  const typesEvenements = f ? f.evenements : EVENEMENTS_SANS_AUDIT;

  const [audit, evenements] = await Promise.all([
    f && !f.audit.length && categorie !== "autres" ? [] : prisma.journalAudit.findMany({
      where: { tenantId, createdAt: periode, AND: [lieu, filtreAudit] },
      orderBy: { createdAt: "desc" }, take: limite + 1,
      select: { id: true, action: true, entite: true, entiteId: true, userNom: true, magasinId: true, caisseId: true, motif: true, apres: true, createdAt: true },
    }),
    !typesEvenements.length ? [] : prisma.evenementPos.findMany({
      where: { tenantId, type: { in: typesEvenements }, createdAt: periode, ...lieu },
      orderBy: { seq: "desc" }, take: limite + 1,
    }),
  ]);

  const entrees = [
    ...audit.map((a) => {
      const apres = (a.apres ?? {}) as Record<string, unknown>;
      return {
        id: `a:${a.id}`, source: "audit" as const, action: a.action, categorie: famille(a.action), titre: titre(a.action),
        // Résumé seulement : numéro, montant et motif quand la ligne les porte.
        detail: [texte(apres.numero) && `n° ${texte(apres.numero)}`, a.motif].filter(Boolean).join(" — ") || null,
        montant: typeof apres.total === "number" ? apres.total : typeof apres.montant === "number" ? apres.montant : null,
        auteur: a.userNom, magasinId: a.magasinId, caisseId: a.caisseId, entite: a.entite, entiteId: a.entiteId, createdAt: a.createdAt,
      };
    }),
    ...evenements.map((e) => {
      const pl = (e.payload ?? {}) as Record<string, unknown>;
      const article = pl.article as { nom?: string } | null | undefined;
      return {
        id: `e:${e.seq}`, source: "evenement" as const, action: e.type, categorie: famille(e.type), titre: titre(e.type),
        detail: e.type === "scan.created" ? [texte(pl.code), article?.nom ?? texte(pl.message)].filter(Boolean).join(" — ") || null
          : texte(pl.titre) ?? texte(pl.nom) ?? texte(pl.message) ?? texte(pl.motif),
        montant: null, auteur: texte(pl.auteur), magasinId: e.magasinId, caisseId: e.caisseId, entite: null, entiteId: null, createdAt: e.createdAt,
      };
    }),
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const page = entrees.slice(0, limite);
  return {
    entrees: page.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    // ponytail: curseur à la milliseconde ; deux entrées de la même milliseconde à cheval sur deux pages : la seconde serait sautée. Passer à un curseur (date, id) si cela se voit.
    curseurSuivant: entrees.length > limite ? page[page.length - 1].createdAt.toISOString() : null,
    categories: Object.entries(FAMILLES).map(([id, x]) => ({ id, libelle: x.libelle })),
  };
});
