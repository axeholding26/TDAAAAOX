// POS — Créer une commande en boutique physique
// ANCIENNE route de la caisse (POSPanel), gardée pour les boutiques qui n'ont pas
// encore activé la caisse 2.0 (drapeau caisse_v2 éteint). Dès qu'il est allumé,
// cette route REFUSE : toute vente passe alors par POST /api/pos/ventes
// (lib/pos/vente.ts — paiements multiples, client réel, session de caisse), sinon
// elle échapperait à la session ouverte et au stock du magasin.
// Tant qu'elle sert, elle applique les mêmes garde-fous que la 2.0 : clé
// d'idempotence (champ `cle`), droit et plafond de remise, entrée d'audit.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CANAL, PAIEMENT } from "@/lib/commandes";
import { RuptureStock, compterVentes, sortirStock } from "@/lib/stock";
import { genererNumeroCommande, genererNumeroFacture } from "@/lib/utils";
import { avecIdempotence, avecRepriseCollision, mutationConnue } from "@/lib/pos/idempotence";
import { droitsUtilisateur } from "@/lib/pos/acces";
import { journaliserAudit } from "@/lib/pos/audit";
import { ErreurPos, reponseErreurPos } from "@/lib/pos/erreurs";
import { lireReglagesPos } from "@/lib/pos/flags";
import { quotaCommandesAtteint } from "@/lib/abonnement";

export async function POST(req: Request) {
  const session = await auth();
  if (!(session?.user as any)?.tenantId) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const tenantId = (session?.user as any)?.tenantId;
  const userId = (session?.user as any)?.id as string;

  const [acces, reglagesPos] = await Promise.all([droitsUtilisateur(tenantId, userId), lireReglagesPos(tenantId)]);
  if (!acces?.droits.vendre) return NextResponse.json({ error: "Votre compte n'a pas le droit de vendre en caisse. Demandez à un responsable." }, { status: 403 });
  if (reglagesPos.flags.caisse_v2) {
    return NextResponse.json({ error: "La nouvelle caisse est activée pour cette boutique : cette vente n'a pas été enregistrée. Ouvrez Caisse (menu Point de vente) pour l'encaisser.", code: "caisse_v2", lien: "/dashboard/pos/caisse" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const cleRecue = typeof body?.cle === "string" && body.cle.length >= 8 && body.cle.length <= 200 ? body.cle : null;
  // Vente déjà enregistrée sous cette clé (réponse perdue) : rendue par avecIdempotence, même quota atteint.
  if (!(cleRecue && (await mutationConnue(tenantId, cleRecue, "vente.ancienne_caisse").catch(() => null))) && (await quotaCommandesAtteint(tenantId))) {
    return NextResponse.json({ error: "Quota de commandes du Palier 0 atteint ce mois-ci — passez à un palier supérieur pour continuer à vendre en boutique.", code: "quota_atteint" }, { status: 403 });
  }
  const itemsClient = Array.isArray(body?.items) ? body.items.slice(0, 500) : [];
  if (!itemsClient.length) return NextResponse.json({ error: "Panier vide" }, { status: 400 });
  // Champs obligatoires de Commande : jamais undefined (sinon erreur 500 de Prisma).
  const texte = (v: unknown, defaut: string, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : defaut);
  const clientNom = texte(body.clientNom, "Client POS", 120);
  const clientTelephone = texte(body.clientTelephone, "—", 30);
  const methode = texte(body.methode, "especes", 40);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, pays: true } });
  const devise = tenant?.devise ?? "XAF";

  // Prix recalculés depuis la base (prix du marchand, sans commission : la vente
  // se fait en main propre) — seule la remise manuelle vient de la caisse.
  const produits = await prisma.produit.findMany({
    where: { id: { in: itemsClient.map((i: any) => String(i.produitId)) }, tenantId },
    select: { id: true, nom: true, prix: true, images: true, variantes: { select: { nom: true, valeur: true, prix: true } } },
  });
  const items: { produitId: string; nom: string; prix: number; quantite: number; imageUrl: string | null; variante: string | null }[] = [];
  for (const i of itemsClient) {
    const p = produits.find((x) => x.id === String(i.produitId));
    if (!p) return NextResponse.json({ error: "Produit introuvable dans cette boutique" }, { status: 400 });
    const variante = i.variante ? p.variantes.find((v) => `${v.nom}: ${v.valeur}` === i.variante) : null;
    if (i.variante && !variante) return NextResponse.json({ error: `Variante « ${i.variante} » introuvable pour ${p.nom}` }, { status: 400 });
    items.push({
      produitId: p.id, nom: p.nom + (variante ? ` — ${i.variante}` : ""), prix: variante?.prix ?? p.prix,
      quantite: Math.max(1, Math.floor(Number(i.quantite) || 1)), imageUrl: p.images[0] ?? null, variante: variante ? i.variante : null,
    });
  }
  const sousTotal = items.reduce((s, i) => s + i.prix * i.quantite, 0);
  const montantReduction = Math.min(Math.max(Number(body.montantReduction) || 0, 0), sousTotal);
  const montantTotal = sousTotal - montantReduction;
  // Remise : mêmes droits que la caisse 2.0 (« remise », puis « remise_hors_plafond » au-delà du plafond des réglages).
  if (montantReduction > 0) {
    const plafond = reglagesPos.reglages.remises.plafondPct;
    if (!acces.droits.remise) return NextResponse.json({ error: "Vous n'avez pas le droit d'accorder une remise. Demandez à un responsable." }, { status: 403 });
    if ((montantReduction / sousTotal) * 100 > plafond + 1e-6 && !acces.droits.remise_hors_plafond) {
      return NextResponse.json({ error: `Cette remise dépasse le plafond autorisé (${plafond} %). Demandez à un responsable.` }, { status: 403 });
    }
  }

  // Auto-create or find client
  let client = await prisma.client.findFirst({ where: { tenantId, OR: [{ email: "pos@local" }] } });
  if (!client) {
    client = await prisma.client.create({ data: { tenantId, nom: clientNom, email: "pos@local", telephone: clientTelephone } });
  }

  // Clé d'idempotence envoyée par la caisse : un nouvel essai après une coupure rend la vente
  // d'origine au lieu d'en créer une seconde. Écran resté ouvert d'avant (sans clé) : une clé par requête.
  const cle = cleRecue ?? crypto.randomUUID();
  let commande: { id: string; numero: string };
  let rejoue = false;
  try {
    // Numéro déjà pris (unique sur toute la plateforme) : la transaction repart avec un nouveau numéro.
    ({ resultat: commande, rejoue } = await avecRepriseCollision(() => avecIdempotence(tenantId, cle, "vente.ancienne_caisse", async (tx) => {
      const c = await tx.commande.create({
        data: {
          tenantId,
          numero: genererNumeroCommande(),
          canal: CANAL.POS,
          clientId: client.id,
          clientNom,
          clientEmail: "pos@local",
          clientTelephone,
          adresseLivraison: "Vente en boutique",
          ville: "Local",
          pays: tenant?.pays ?? "CM",
          montantSousTotal: sousTotal,
          montantLivraison: 0,
          montantReduction,
          montantTotal,
          devise,
          statut: "livree",
          paiementStatut: PAIEMENT.PAYE,
          methodePaiement: methode,
          livraisonStatut: "livree",
          livreeAt: new Date(),
          lignes: { create: items },
        },
      });
      // Stock (lots FIFO + journal) et compteur de ventes : mêmes règles que la vitrine.
      await sortirStock(tx, { tenantId, commandeId: c.id, motif: `Vente caisse #${c.numero}`, creePar: userId });
      await compterVentes(tx, c.id, 1);
      await journaliserAudit(tx, { tenantId, userId, userNom: acces.nom ?? session?.user?.name ?? session?.user?.email ?? "Utilisateur" }, {
        action: "vente.creee", entite: "Commande", entiteId: c.id,
        apres: { numero: c.numero, total: montantTotal, sousTotal, remises: montantReduction, methode, ancienneCaisse: true },
      });
      return { id: c.id, numero: c.numero };
    }, { userId })));
  } catch (err) {
    if (err instanceof RuptureStock) return NextResponse.json({ error: err.message }, { status: err.status });
    // Erreurs de la caisse (clé déjà utilisée pour autre chose…) : phrase humaine { error, code }.
    if (err instanceof ErreurPos) return reponseErreurPos(err);
    throw err;
  }
  // Rejeu : la vente et sa facture existent déjà.
  if (rejoue) return NextResponse.json({ ok: true, commandeId: commande.id, numero: commande.numero, rejoue: true });

  // Facture de la vente. Facture.numero est unique sur TOUTE la plateforme alors
  // que le rang est compté par boutique : l'ancien « FAC-année-rang » échouait en
  // silence dès la deuxième boutique (« Unique constraint failed on numero ») et
  // la vente restait sans facture. genererNumeroFacture ajoute un suffixe unique ;
  // un échec n'annule pas la vente mais n'est plus avalé sans trace.
  try {
    const rang = (await prisma.facture.count({ where: { tenantId } })) + 1;
    await avecRepriseCollision(() => prisma.facture.create({
      data: {
        tenantId, commandeId: commande.id, numero: genererNumeroFacture(rang),
        clientNom, clientEmail: "pos@local", clientAdresse: "Vente en boutique",
        montantHT: montantTotal, tauxTVA: 0, montantTVA: 0, montantTTC: montantTotal, devise,
        lignes: items.map((i: any) => ({ nom: i.nom, quantite: i.quantite, prixHT: i.prix, tauxTVA: 0, prixTTC: i.prix })),
        statut: "payee",
      },
    }));
  } catch (e) {
    console.error("[pos-creer] facture non créée pour la vente", commande.numero, e);
  }

  return NextResponse.json({ ok: true, commandeId: commande.id, numero: commande.numero });
}
