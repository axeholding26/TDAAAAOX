// Import / export CSV et XLSX de la caisse : lecture du fichier, validation
// sans écriture, import par paquets, export. SERVEUR uniquement.
//
// DEUX TEMPS
// 1. validerImport : lit le fichier et rend « N lignes, V valides, E erreurs »
//    avec le détail par ligne. N'écrit rien.
// 2. appliquerImport : relit le MÊME fichier (une fonction serverless ne garde
//    rien entre deux appels), n'importe que les lignes valides, par paquets de
//    lignes du fichier. Chaque paquet est une transaction idempotente : sa clé
//    est « clé d'import : empreinte du fichier : numéro du paquet ».
//
// LIMITES RÉELLES (fonction serverless)
// - Fichier de 4 Mo au plus : Vercel refuse un corps de requête au-delà de 4,5 Mo.
// - 5 000 lignes par fichier.
// - Un appel travaille 45 s au plus (la route se déclare à 60 s). S'il reste
//   des paquets, il rend `termine: false` : renvoyer la même demande avec la
//   même clé reprend là où l'import s'est arrêté, les paquets déjà appliqués
//   étant reconnus et sautés.
//
// STOCK — type de mouvement « inventaire », pas « ajustement » : le fichier dit
// combien il Y A (une quantité comptée), pas de combien corriger. L'écart avec
// le stock connu est calculé à l'écriture, sous verrou de l'article ; réimporter
// le même fichier donne un écart nul et n'écrit donc aucun mouvement.
import { createHash } from "node:crypto";
import * as XLSX from "xlsx";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../prisma";
import { slugify } from "../../utils";
import { journaliserAudit } from "../audit";
import { ErreurPos, erreurs } from "../erreurs";
import { publierEvenement } from "../evenements";
import { avecIdempotence } from "../idempotence";
import { mouvementStock, resoudreLieu, stocksDuLieu, type LieuStock } from "../stock";
import { cleArticle, type ContextePos } from "../types";
import {
  DEFINITIONS, cleColonne, cleTelephone, colonnesManquantes, entetes, normaliserNom, referenceVide, validerLignes,
  type Entite, type LigneValide, type Reference, type Validation,
} from "./import-regles";

type Tx = Prisma.TransactionClient;

export const LIMITES_IMPORT = { octets: 4 * 1024 * 1024, lignes: 5000, paquet: 100, paquetStock: 50, budgetMs: 45_000, export: 20_000 };
const taillePaquet = (entite: Entite) => (entite === "stock" ? LIMITES_IMPORT.paquetStock : LIMITES_IMPORT.paquet);

// ─── Lecture du fichier ──────────────────────────────────────────────────────

export type FichierLu = { lignes: Record<string, unknown>[]; empreinte: string };

export async function lireFichier(entite: Entite, fichier: File): Promise<FichierLu> {
  if (fichier.size > LIMITES_IMPORT.octets) throw new ErreurPos("fichier_trop_lourd", 413, "Ce fichier dépasse 4 Mo. Découpez-le en plusieurs fichiers puis importez-les l'un après l'autre.");
  const octets = new Uint8Array(await fichier.arrayBuffer());
  let brut: Record<string, unknown>[];
  try {
    // Un CSV lu en binaire perd ses accents : on le décode en UTF-8 d'abord. `raw` garde les zéros de tête des codes-barres.
    const classeur = /\.csv$/i.test(fichier.name)
      ? XLSX.read(new TextDecoder("utf-8").decode(octets).replace(/^﻿/, ""), { type: "string", raw: true })
      : XLSX.read(octets, { type: "array" });
    brut = XLSX.utils.sheet_to_json<Record<string, unknown>>(classeur.Sheets[classeur.SheetNames[0]], { defval: "" });
  } catch {
    throw new ErreurPos("fichier_illisible", 400, "Ce fichier est illisible. Utilisez le modèle fourni, au format Excel (.xlsx) ou CSV.");
  }
  if (!brut.length) throw erreurs.invalide("Ce fichier ne contient aucune ligne sous les en-têtes.");
  if (brut.length > LIMITES_IMPORT.lignes) {
    throw new ErreurPos("trop_de_lignes", 413, `Ce fichier contient ${brut.length.toLocaleString("fr-FR")} lignes. La limite est de ${LIMITES_IMPORT.lignes.toLocaleString("fr-FR")} lignes par fichier : découpez-le puis importez les fichiers l'un après l'autre.`);
  }
  const lignes = brut.map((l) => Object.fromEntries(Object.entries(l).map(([k, v]) => [cleColonne(k), v])));
  const manquantes = colonnesManquantes(entite, Object.keys(lignes[0]));
  if (manquantes.length) {
    throw new ErreurPos("colonnes_manquantes", 400, `Ce fichier ne ressemble pas au modèle « ${DEFINITIONS[entite].libelle} » : colonne${manquantes.length > 1 ? "s" : ""} introuvable${manquantes.length > 1 ? "s" : ""} : ${manquantes.join(", ")}. Téléchargez le modèle et gardez sa première ligne.`);
  }
  return { lignes, empreinte: createHash("sha1").update(octets).digest("hex").slice(0, 16) };
}

// ─── Ce que la boutique contient déjà ────────────────────────────────────────

// ponytail: charge tout le catalogue (ou tous les clients) de la boutique en mémoire à chaque appel ;
// au-delà de ~100 000 fiches, ne charger que les codes présents dans le fichier.
async function chargerReference(tenantId: string, entite: Entite): Promise<Reference> {
  const ref = referenceVide();
  if (entite === "produits" || entite === "prix" || entite === "stock") {
    const produits = await prisma.produit.findMany({ where: { tenantId }, select: { id: true, nom: true, sku: true, codeBarres: true, type: true, variantes: { select: { id: true, sku: true, codeBarres: true } } } });
    const noter = (code: string | null, a: { produitId: string; varianteId: string | null; aVariantes: boolean; physique: boolean }) => {
      const c = code?.trim().toLowerCase();
      if (!c) return;
      const deja = ref.codes.get(c);
      if (deja && (deja.produitId !== a.produitId || deja.varianteId !== a.varianteId)) ref.ambigus.add(c);
      else ref.codes.set(c, a);
    };
    for (const p of produits) {
      const base = { produitId: p.id, aVariantes: p.variantes.length > 0, physique: p.type === "physique" };
      noter(p.sku, { ...base, varianteId: null });
      noter(p.codeBarres, { ...base, varianteId: null });
      for (const v of p.variantes) { noter(v.sku, { ...base, varianteId: v.id }); noter(v.codeBarres, { ...base, varianteId: v.id }); }
      ref.nomsProduits.set(normaliserNom(p.nom), p.id);
    }
  }
  if (entite === "stock") {
    for (const e of await prisma.entrepot.findMany({ where: { tenantId, actif: true }, select: { id: true, nom: true } })) ref.entrepots.set(normaliserNom(e.nom), e.id);
  }
  if (entite === "clients") {
    for (const c of await prisma.client.findMany({ where: { tenantId }, select: { id: true, email: true, telephone: true, codeClient: true } })) {
      if (c.email) ref.clients.set(`email:${c.email.toLowerCase()}`, c.id);
      if (c.telephone && cleTelephone(c.telephone)) ref.clients.set(`tel:${cleTelephone(c.telephone)}`, c.id);
      if (c.codeClient) ref.clients.set(`code:${c.codeClient.toLowerCase()}`, c.id);
    }
  }
  if (entite === "fournisseurs") {
    for (const f of await prisma.fournisseur.findMany({ where: { tenantId }, select: { id: true, nom: true } })) ref.fournisseurs.set(normaliserNom(f.nom), f.id);
  }
  return ref;
}

// ─── Temps 1 : validation ────────────────────────────────────────────────────

export async function validerImport(tenantId: string, entite: Entite, fichier: File) {
  const lu = await lireFichier(entite, fichier);
  const v = validerLignes(entite, lu.lignes, await chargerReference(tenantId, entite));
  return {
    entite, total: v.total, valides: v.valides.length, erreurs: v.erreurs,
    aCreer: v.valides.filter((l) => !l.cible).length, aModifier: v.valides.filter((l) => l.cible).length,
  };
}

// ─── Temps 2 : import ────────────────────────────────────────────────────────

type BilanPaquet = { crees: number; modifies: number; inchanges: number };

async function ecrirePaquet(tx: Tx, ctx: ContextePos, entite: Entite, lignes: LigneValide[], etat: { slugs: Set<string>; lieux: Map<string, LieuStock> }): Promise<BilanPaquet & { produitIds: string[] }> {
  const bilan = { crees: 0, modifies: 0, inchanges: 0, produitIds: [] as string[] };
  for (const l of lignes) {
    const d = l.donnees as Record<string, any>;
    if (entite === "produits") {
      if (l.cible) await tx.produit.update({ where: { id: l.cible }, data: d });
      else {
        // Adresse unique dans la boutique : riz-parfume, riz-parfume-2, …
        const base = slugify(d.nom) || "produit";
        let slug = base;
        for (let n = 2; etat.slugs.has(slug); n++) slug = `${base}-${n}`;
        etat.slugs.add(slug);
        await tx.produit.create({ data: { ...d, nom: d.nom, prix: d.prix, slug, tenantId: ctx.tenantId, type: "physique", stock: 0, images: [] } });
      }
      l.cible ? bilan.modifies++ : bilan.crees++;
    } else if (entite === "prix") {
      if (l.varianteId) await tx.variante.update({ where: { id: l.varianteId }, data: d });
      else await tx.produit.update({ where: { id: l.cible! }, data: d });
      bilan.modifies++;
    } else if (entite === "stock") {
      const produitId = l.cible!, varianteId = l.varianteId ?? null;
      // Verrou de l'article avant de lire son stock : une vente simultanée attend la fin du paquet.
      const { stock } = varianteId
        ? await tx.variante.update({ where: { id: varianteId }, data: { stock: { increment: 0 } }, select: { stock: true } })
        : await tx.produit.update({ where: { id: produitId }, data: { stock: { increment: 0 } }, select: { stock: true } });
      const lieu = etat.lieux.get(l.entrepotId ?? "") ?? null;
      const actuel = lieu ? (await stocksDuLieu(tx, ctx.tenantId, lieu.entrepotId, [{ produitId, varianteId, stock }])).get(cleArticle(produitId, varianteId)) ?? 0 : stock;
      const ecart = d.quantite - actuel;
      if (ecart === 0) { bilan.inchanges++; continue; }
      await mouvementStock(tx, { tenantId: ctx.tenantId, produitId, varianteId, type: "inventaire", quantite: ecart, motif: `Import de stock (fichier, ligne ${l.ligne})`, creePar: ctx.userId, lieu });
      bilan.modifies++;
      bilan.produitIds.push(produitId);
    } else if (entite === "clients") {
      if (l.cible) await tx.client.update({ where: { id: l.cible }, data: d });
      else await tx.client.create({ data: { ...d, nom: d.nom, tenantId: ctx.tenantId } });
      l.cible ? bilan.modifies++ : bilan.crees++;
    } else {
      if (l.cible) await tx.fournisseur.update({ where: { id: l.cible }, data: d });
      // Pays inconnu : on le dit, plutôt que de laisser la valeur par défaut du modèle (« Chine »).
      else await tx.fournisseur.create({ data: { ...d, nom: d.nom, tenantId: ctx.tenantId, type: "local", pays: d.pays ?? "Non renseigné" } });
      l.cible ? bilan.modifies++ : bilan.crees++;
    }
  }
  return bilan;
}

export async function appliquerImport(ctx: ContextePos, entite: Entite, fichier: File, cle: string | undefined) {
  if (!cle || cle.length < 8 || cle.length > 100) throw erreurs.invalide("L'import n'a pas d'identifiant valide. Rechargez la page puis recommencez.");
  const debut = Date.now();
  const lu = await lireFichier(entite, fichier);
  const validation: Validation = validerLignes(entite, lu.lignes, await chargerReference(ctx.tenantId, entite));

  const etat = { slugs: new Set<string>(), lieux: new Map<string, LieuStock>() };
  if (entite === "produits") for (const p of await prisma.produit.findMany({ where: { tenantId: ctx.tenantId }, select: { slug: true } })) etat.slugs.add(p.slug);
  if (entite === "stock") for (const id of new Set(validation.valides.map((l) => l.entrepotId ?? ""))) etat.lieux.set(id, await resoudreLieu(prisma, ctx.tenantId, id || null));

  // Paquets découpés sur les lignes DU FICHIER (pas sur les lignes valides) : leur numéro reste le même d'un appel à l'autre.
  const taille = taillePaquet(entite);
  const paquets = new Map<number, LigneValide[]>();
  for (const l of validation.valides) {
    const n = Math.floor((l.ligne - 2) / taille);
    paquets.set(n, [...(paquets.get(n) ?? []), l]);
  }
  const total: BilanPaquet = { crees: 0, modifies: 0, inchanges: 0 };
  let faits = 0, rejoues = 0;
  try {
    for (const [n, lignes] of [...paquets.entries()].sort((a, b) => a[0] - b[0])) {
      if (Date.now() - debut > LIMITES_IMPORT.budgetMs) break;
      const { resultat, rejoue } = await avecIdempotence<BilanPaquet>(ctx.tenantId, `${cle}:${lu.empreinte}:${n}`, `import.${entite}`, async (tx) => {
        const { produitIds, ...bilan } = await ecrirePaquet(tx, ctx, entite, lignes, etat);
        await journaliserAudit(tx, ctx, {
          action: "import.applique", entite: "Import", entiteId: cle,
          apres: { fichier: fichier.name, empreinte: lu.empreinte, type: entite, paquet: n + 1, deLigne: lignes[0].ligne, aLigne: lignes[lignes.length - 1].ligne, ...bilan },
        });
        if (produitIds.length) await publierEvenement(tx, { tenantId: ctx.tenantId, type: "inventory.updated", payload: { origine: "import", produitIds: [...new Set(produitIds)] } });
        return bilan;
      }, { userId: ctx.userId, appareilId: ctx.appareilId });
      total.crees += resultat.crees; total.modifies += resultat.modifies; total.inchanges += resultat.inchanges;
      faits++;
      if (rejoue) rejoues++;
    }
  } catch (e) {
    // Une fiche créée ailleurs pendant l'import (même code-barres, même e-mail) : le paquet en cours est annulé, les précédents restent acquis.
    if ((e as any)?.code === "P2002") throw erreurs.conflit(`Une fiche identique vient d'être créée par quelqu'un d'autre pendant l'import. ${faits} paquet(s) sur ${paquets.size} sont enregistrés ; relancez l'import pour terminer, sans risque de doublon.`, { faits, paquets: paquets.size });
    throw e;
  }
  return {
    entite, termine: faits === paquets.size, paquets: paquets.size, paquetsFaits: faits, dejaAppliques: rejoues,
    total: validation.total, valides: validation.valides.length, erreurs: validation.erreurs, ...total,
  };
}

// ─── Modèles et export ───────────────────────────────────────────────────────

export type Format = "xlsx" | "csv";

/** Fichier téléchargeable (réponse HTTP) à partir d'un tableau : première ligne = en-têtes. */
export function fichierTableur(nom: string, feuille: string, tableau: (string | number | null)[][], format: Format, enTetesHttp: Record<string, string> = {}): Response {
  const f = XLSX.utils.aoa_to_sheet(tableau);
  f["!cols"] = (tableau[0] ?? []).map((c) => ({ wch: Math.max(14, String(c ?? "").length + 4) }));
  if (format === "csv") {
    // Point-virgule + BOM : s'ouvre proprement dans Excel en français, accents compris.
    return new Response(`﻿${XLSX.utils.sheet_to_csv(f, { FS: ";" })}`, {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${nom}.csv"`, ...enTetesHttp },
    });
  }
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, f, feuille);
  return new Response(new Uint8Array(XLSX.write(classeur, { type: "buffer", bookType: "xlsx" }) as Buffer), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${nom}.xlsx"`, ...enTetesHttp },
  });
}

/** Modèle à remplir : les en-têtes et une ligne d'exemple. */
export const modeleImport = (entite: Entite, format: Format) =>
  fichierTableur(`modele-${entite}-axso`, DEFINITIONS[entite].libelle, [entetes(entite), DEFINITIONS[entite].colonnes.map((c) => c.exemple)], format);

/**
 * Lignes d'un export, dans les colonnes du modèle d'import (un export se
 * réimporte tel quel). Sans le droit de voir les coûts, la colonne « Prix
 * d'achat » sort vide. Au-delà de LIMITES_IMPORT.export lignes, `tronque`.
 */
export async function exporter(tenantId: string, entite: Entite, o: { voirCouts: boolean }): Promise<{ tableau: (string | number | null)[][]; lignes: number; tronque: boolean }> {
  const max = LIMITES_IMPORT.export;
  const cout = (c: number | null) => (o.voirCouts ? c : null);
  let lignes: (string | number | null)[][];
  if (entite === "clients") {
    const clients = await prisma.client.findMany({ where: { tenantId }, orderBy: { nom: "asc" }, take: max + 1, select: { nom: true, telephone: true, email: true, adresse: true, ville: true, codeClient: true } });
    lignes = clients.map((c) => [c.nom, c.telephone, c.email, c.adresse, c.ville, c.codeClient]);
  } else if (entite === "fournisseurs") {
    const fournisseurs = await prisma.fournisseur.findMany({ where: { tenantId }, orderBy: { nom: "asc" }, take: max + 1, select: { nom: true, pays: true, telephone: true, email: true, delaiLivraison: true, notes: true } });
    lignes = fournisseurs.map((f) => [f.nom, f.pays, f.telephone, f.email, f.delaiLivraison, f.notes]);
  } else {
    const produits = await prisma.produit.findMany({
      where: { tenantId, type: "physique" }, orderBy: { nom: "asc" }, take: max + 1,
      select: { id: true, nom: true, prix: true, cout: true, categorie: true, marque: true, sku: true, codeBarres: true, uniteVente: true, tauxTVA: true, description: true, actif: true, stock: true, variantes: { select: { id: true, nom: true, valeur: true, prix: true, cout: true, sku: true, codeBarres: true, stock: true } } },
    });
    // Un article = un produit sans variante, ou chacune de ses variantes.
    const articles = produits.flatMap((p) => (p.variantes.length
      ? p.variantes.map((v) => ({ produitId: p.id, varianteId: v.id as string | null, nom: p.nom, variante: `${v.nom}: ${v.valeur}`, sku: v.sku, codeBarres: v.codeBarres, prix: v.prix ?? p.prix, cout: v.cout ?? p.cout, stock: v.stock }))
      : [{ produitId: p.id, varianteId: null as string | null, nom: p.nom, variante: "", sku: p.sku, codeBarres: p.codeBarres, prix: p.prix, cout: p.cout, stock: p.stock }]));
    if (entite === "produits") {
      lignes = produits.map((p) => [p.nom, p.prix, cout(p.cout), p.categorie, p.marque, p.sku, p.codeBarres, p.uniteVente, p.tauxTVA == null ? null : Math.round(p.tauxTVA * 10000) / 100, p.description, p.actif ? "oui" : "non"]);
    } else if (entite === "prix") {
      lignes = articles.map((a) => [a.sku, a.codeBarres, a.variante ? `${a.nom} (${a.variante})` : a.nom, a.prix, cout(a.cout)]);
    } else {
      const entrepots = await prisma.entrepot.findMany({ where: { tenantId, actif: true }, orderBy: [{ principal: "desc" }, { createdAt: "asc" }], select: { id: true, nom: true } });
      if (!entrepots.length) lignes = articles.map((a) => [a.sku, a.codeBarres, a.nom, a.variante, a.stock, ""]);
      else {
        lignes = [];
        for (const e of entrepots) {
          const stocks = await stocksDuLieu(prisma, tenantId, e.id, articles);
          for (const a of articles) lignes.push([a.sku, a.codeBarres, a.nom, a.variante, stocks.get(cleArticle(a.produitId, a.varianteId)) ?? 0, e.nom]);
        }
      }
    }
  }
  const tronque = lignes.length > max;
  return { tableau: [entetes(entite), ...lignes.slice(0, max)], lignes: Math.min(lignes.length, max), tronque };
}
