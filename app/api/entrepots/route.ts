// Entrepôts de la boutique (page Logistique → Entrepôts).
// La boutique vient TOUJOURS de la session : toute lecture, modification ou
// suppression par `id` vérifie que l'entrepôt lui appartient (aucune fuite
// entre boutiques). Forme des réponses inchangée : { entrepots }, { entrepot }, { ok }.
//
// STOCK — l'entrepôt principal est un reliquat (lib/pos/stock.ts) : son contenu
// est « le total moins les autres entrepôts ». Changer de principal sans
// précaution ferait donc glisser le stock d'un lieu à l'autre. Ici :
// - dès que le principal change (drapeau, désactivation, réactivation, création),
//   le contenu de l'ancien est écrit dans ses lignes (figerStockPrincipal) :
//   chaque entrepôt garde exactement ses quantités, et le changement est audité ;
// - un entrepôt qui contient du stock, des lots ou des numéros de série ne se
//   supprime pas et ne se désactive pas : on transfère d'abord.
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { journaliserAudit, verrouBoutique } from "@/lib/pos/audit";
import { ErreurPos, erreurs } from "@/lib/pos/erreurs";
import { entrepotPrincipal } from "@/lib/pos/magasins";
import { figerStockPrincipal, reliquatsDuPrincipal } from "@/lib/pos/stock";

type Tx = Prisma.TransactionClient;
type Auteur = { tenantId: string; userId?: string; userNom?: string };

async function auteur(): Promise<Auteur | null> {
  const u = (await auth())?.user as { id?: string; tenantId?: string | null; name?: string | null; email?: string | null } | undefined;
  return u?.tenantId ? { tenantId: u.tenantId, userId: u.id, userNom: u.name || u.email || undefined } : null;
}
const boutique = async () => (await auteur())?.tenantId ?? null;

const refus = (error: string, status: number) => NextResponse.json({ error }, { status });
const texte = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
// Figer le stock d'un gros catalogue écrit beaucoup de lignes : on laisse le temps à la transaction.
const LONGUE = { timeout: 60_000, maxWait: 10_000 };

/** Refus métier (ErreurPos) → sa phrase ; le reste remonte. */
function reponseRefus(e: unknown) {
  if (e instanceof ErreurPos) return refus(e.message, e.status);
  throw e;
}

/**
 * Applique `changer` puis, si l'entrepôt principal n'est plus le même, fige le
 * stock de l'ancien dans ses lignes et trace le changement.
 */
async function avecPrincipalStable<T>(tx: Tx, a: Auteur, changer: () => Promise<T>): Promise<T> {
  // Verrou de boutique : aucune vente de caisse ne s'écrit pendant la bascule.
  await verrouBoutique(tx, a.tenantId);
  const avant = await entrepotPrincipal(tx, a.tenantId);
  const resultat = await changer();
  const apres = await entrepotPrincipal(tx, a.tenantId);
  if (avant && avant.id !== apres?.id) {
    const reste = await tx.entrepot.count({ where: { id: avant.id } });
    const lignesFigees = reste ? await figerStockPrincipal(tx, a.tenantId, avant.id) : 0;
    await journaliserAudit(tx, a, { action: "entrepot.principal_change", entite: "Entrepot", entiteId: apres?.id ?? null, avant: { principalId: avant.id }, apres: { principalId: apres?.id ?? null, lignesFigees }, motif: "Le stock de chaque entrepôt est conservé à l'identique." });
  }
  return resultat;
}

/**
 * Lève un refus si l'entrepôt contient encore quelque chose. Sans autre
 * entrepôt dans la boutique, la quantité ne compte pas : rien ne peut glisser
 * ailleurs, le total de chaque article reste seul tenu.
 */
async function exigerVide(tx: Tx, tenantId: string, id: string, verbe: "supprimer" | "désactiver") {
  const principal = await entrepotPrincipal(tx, tenantId);
  const autres = await tx.entrepot.count({ where: { tenantId, id: { not: id } } });
  let stock: boolean, nonVendable: boolean;
  if (principal?.id === id) {
    const articles = await reliquatsDuPrincipal(tx, tenantId, id);
    stock = articles.some((x) => x.quantite !== 0);
    nonVendable = articles.some((x) => (x.ligne?.bloque ?? 0) > 0 || (x.ligne?.endommage ?? 0) > 0);
  } else {
    stock = (await tx.stockEntrepot.count({ where: { entrepotId: id, quantite: { not: 0 } } })) > 0;
    nonVendable = (await tx.stockEntrepot.count({ where: { entrepotId: id, OR: [{ bloque: { gt: 0 } }, { endommage: { gt: 0 } }] } })) > 0;
  }
  const lots = await tx.lotTracabilite.count({ where: { tenantId, entrepotId: id, quantiteRestante: { gt: 0 } } });
  const series = await tx.numeroSerie.count({ where: { tenantId, entrepotId: id, statut: { not: "vendu" } } });
  const contenu = [
    stock && autres > 0 ? "du stock" : null,
    nonVendable ? "des unités bloquées ou abîmées" : null,
    lots ? "des lots" : null,
    series ? "des numéros de série" : null,
  ].filter(Boolean);
  if (contenu.length) throw erreurs.conflit(`Cet entrepôt contient encore ${contenu.join(", ")}. Transférez-les vers un autre entrepôt (ou sortez-les du stock) avant de le ${verbe}.`);
}

export async function GET() {
  const tenantId = await boutique();
  if (!tenantId) return refus("Non autorisé", 401);

  const entrepots = await prisma.entrepot.findMany({
    where: { tenantId },
    include: { _count: { select: { stocks: true } } },
    orderBy: [{ principal: "desc" }, { nom: "asc" }],
  });
  return NextResponse.json({ entrepots });
}

export async function POST(req: Request) {
  const a = await auteur();
  if (!a) return refus("Non autorisé", 401);
  const { tenantId } = a;
  const body = await req.json().catch(() => ({}));
  const nom = texte(body.nom, 120);
  if (!nom) return refus("Donnez un nom à l'entrepôt.", 400);
  const principal = body.principal === true;

  const entrepot = await prisma.$transaction((tx) => avecPrincipalStable(tx, a, async () => {
    // Un seul entrepôt principal par boutique.
    if (principal) await tx.entrepot.updateMany({ where: { tenantId }, data: { principal: false } });
    return tx.entrepot.create({
      data: { tenantId, nom, adresse: texte(body.adresse) || null, ville: texte(body.ville, 120) || null, pays: texte(body.pays, 80) || "Cameroun", principal },
    });
  }), LONGUE);
  return NextResponse.json({ entrepot });
}

export async function PATCH(req: Request) {
  const a = await auteur();
  if (!a) return refus("Non autorisé", 401);
  const { tenantId } = a;
  const body = await req.json().catch(() => ({}));
  const id = texte(body.id, 64);
  if (!id) return refus("id requis", 400);

  // L'entrepôt doit appartenir à la boutique de la session AVANT toute écriture
  // (y compris le retrait du drapeau « principal » des autres).
  const existant = await prisma.entrepot.findFirst({ where: { id, tenantId }, select: { id: true, actif: true } });
  if (!existant) return refus("Cet entrepôt est introuvable dans cette boutique.", 404);
  if (body.nom !== undefined && !texte(body.nom, 120)) return refus("Donnez un nom à l'entrepôt.", 400);
  if (body.principal === true && (body.actif === false || (!existant.actif && body.actif !== true))) return refus("Un entrepôt désactivé ne peut pas être le principal. Réactivez-le d'abord.", 400);
  const desactive = body.actif === false && existant.actif;

  const entrepot = await prisma.$transaction((tx) => avecPrincipalStable(tx, a, async () => {
    if (desactive) {
      await exigerVide(tx, tenantId, id, "désactiver");
      await journaliserAudit(tx, a, { action: "entrepot.desactive", entite: "Entrepot", entiteId: id });
    }
    if (body.principal === true) await tx.entrepot.updateMany({ where: { tenantId }, data: { principal: false } });
    await tx.entrepot.updateMany({
      where: { id, tenantId },
      data: {
        nom: texte(body.nom, 120), adresse: texte(body.adresse), ville: texte(body.ville, 120), pays: texte(body.pays, 80) || undefined,
        principal: typeof body.principal === "boolean" ? body.principal : undefined,
        actif: typeof body.actif === "boolean" ? body.actif : undefined,
      },
    });
    return tx.entrepot.findFirst({ where: { id, tenantId } });
  }), LONGUE).catch(reponseRefus);
  if (entrepot instanceof NextResponse) return entrepot;
  return NextResponse.json({ entrepot });
}

export async function DELETE(req: Request) {
  const a = await auteur();
  if (!a) return refus("Non autorisé", 401);
  const { tenantId } = a;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return refus("id requis", 400);

  const existant = await prisma.entrepot.findFirst({ where: { id, tenantId }, select: { id: true, nom: true } });
  if (!existant) return refus("Cet entrepôt est introuvable dans cette boutique.", 404);
  // Un magasin vend le stock de son entrepôt, un transfert en cours y part ou y arrive : on ne le retire pas sous eux.
  const [magasins, transferts] = await Promise.all([
    prisma.magasin.count({ where: { tenantId, entrepotId: id } }),
    prisma.transfertStock.count({ where: { tenantId, statut: { in: ["demande", "approuve", "en_preparation", "expedie", "partiellement_recu"] }, OR: [{ entrepotSourceId: id }, { entrepotDestinationId: id }] } }),
  ]);
  if (magasins) return refus("Cet entrepôt est le lieu de stock d'un magasin. Rattachez d'abord le magasin à un autre entrepôt.", 409);
  if (transferts) return refus("Un transfert de stock est en cours avec cet entrepôt. Terminez-le ou annulez-le d'abord.", 409);

  const refuse = await prisma.$transaction((tx) => avecPrincipalStable(tx, a, async () => {
    await exigerVide(tx, tenantId, id, "supprimer");
    // Il ne reste que des lignes à zéro (ou, pour le dernier entrepôt de la boutique, une ventilation devenue sans objet).
    await tx.stockEntrepot.deleteMany({ where: { entrepotId: id, entrepot: { tenantId } } });
    await tx.entrepot.deleteMany({ where: { id, tenantId } });
    await journaliserAudit(tx, a, { action: "entrepot.supprime", entite: "Entrepot", entiteId: id, avant: { nom: existant.nom } });
    return null;
  }), LONGUE).catch(reponseRefus);
  if (refuse) return refuse;
  return NextResponse.json({ ok: true });
}
