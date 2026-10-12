// Outils AXIA de la caisse (§42-44) — tous préfixés `pos_`.
//
// - LECTURE : ventes, marge et ses causes, ruptures, dormants, caisse la plus
//   active, quoi commander, comparaison de fournisseurs, rapport. Les chiffres
//   viennent des mêmes fonctions que les écrans (lib/pos/analytics) : AXIA ne
//   calcule rien lui-même, il lit et il explique.
// - ACTIONS PRÉPARÉES : bon de commande, promotion, inventaire, transfert.
//   Elles sont dans SENSIBLES (./confirmation.ts) : l'appel du modèle ne crée
//   qu'une demande dans la bulle AXIA, et `executerOutilPos` ne tourne qu'après
//   le clic « Valider » du marchand. Même validée, une action ne fait que
//   PRÉPARER : bon en brouillon, promotion inactive, transfert en brouillon,
//   inventaire ouvert — aucun stock ne bouge, rien n'est envoyé.
// - `pos_relance_client` rédige un message ; il n'envoie rien.
//
// DROITS : l'exécuteur AXIA ne connaît que la boutique, pas la personne. Le
// filtre se fait donc en amont, par ./droits.ts (grille des modules du membre) :
// chiffres et marge = « finance », stock = « produits », préparation d'achats,
// d'inventaire, de transfert et comparaison de prix d'achat = « produits » en
// écriture, promotion = « marketing » en écriture. Un caissier ne voit donc
// aucun de ces chiffres par AXIA et ne peut valider aucune de ces actions.
// Tout est éteint tant que le drapeau `axia_pos` l'est.
import { randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AgentTool, ToolExecutor } from "@/lib/agent-runner";
import { flagActif } from "@/lib/pos/flags";
import { TOUS_DROITS } from "@/lib/pos/droits";
import { ErreurPos } from "@/lib/pos/erreurs";
import { assurerMagasinParDefaut } from "@/lib/pos/magasins";
import { journaliserAudit } from "@/lib/pos/audit";
import type { ContextePos } from "@/lib/pos/types";
import { agregerVentes, produitsDormants, totalVentes, type Agregat, type FiltresVentes } from "@/lib/pos/analytics/ventes";
import { calculerAlertes } from "@/lib/pos/alertes";
import { recommandationsReappro } from "@/lib/pos/achats/reappro";
import { comparerFournisseursProduit } from "@/lib/pos/achats/fournisseurs";
import { creerBons } from "@/lib/pos/achats/bons";
import { creerInventaire } from "@/lib/pos/operations/inventaire";
import { creerTransfert } from "@/lib/pos/operations/transferts";
import { schemaPromotion } from "@/lib/pos/promotions/schema";

const PERIODE = { type: "string", enum: ["aujourd_hui", "7j", "30j"], description: "Période : aujourd'hui (défaut), 7 ou 30 derniers jours" };
const LIGNES = {
  type: "array", description: "Articles et quantités",
  items: { type: "object", properties: { produit: { type: "string", description: "Nom exact ou identifiant du produit" }, quantite: { type: "number" } }, required: ["produit", "quantite"] },
};
const outil = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []): AgentTool =>
  ({ name, description, parameters: { type: "object" as const, properties, required } }) as AgentTool;

export const AXIA_POS_TOOLS: AgentTool[] = [
  // ─── Lecture ────────────────────────────────────────────────────────────────
  outil("pos_ventes_jour", "Ventes du magasin physique (caisse) : chiffre d'affaires, nombre de ventes, panier moyen, remises, retours, et comparaison avec la période précédente.", { periode: PERIODE }),
  outil("pos_marge", "Marge du magasin physique et CAUSES d'une baisse : remises, retours, coûts, produits à faible marge. À utiliser pour « pourquoi ma marge baisse ».", { periode: PERIODE }),
  outil("pos_caisse_performante", "Chiffre d'affaires et nombre de ventes par caisse et par magasin, pour dire quelle caisse vend le plus.", { periode: PERIODE }),
  outil("pos_produits_rupture", "Produits en rupture ou proches de la rupture, avec les jours de stock restants (estimation sur les ventes des 30 derniers jours)."),
  outil("pos_produits_dormants", "Produits en stock qui ne se vendent plus (aucune vente depuis 60 jours)."),
  outil("pos_quoi_commander", "Quoi commander : quantités de réassort recommandées par produit, avec le fournisseur retenu (estimation calculée, pas une certitude)."),
  outil("pos_comparer_fournisseurs", "Compare les fournisseurs connus d'un produit : prix, délai, fiabilité, quantité minimale, et lequel AXSO recommande.", { produit: { type: "string", description: "Nom exact ou identifiant du produit" }, quantite: { type: "number", description: "Quantité visée" } }, ["produit"]),
  outil("pos_rapport", "Rapport du magasin physique sur une période : ventes, marge, meilleurs produits, alertes en cours.", { periode: PERIODE }),
  outil("pos_relance_client", "Rédige un message de relance pour un client qui doit de l'argent (crédit en magasin). N'ENVOIE RIEN : rend le texte, que le marchand envoie lui-même.", { client: { type: "string", description: "Nom ou téléphone du client" } }, ["client"]),
  // ─── Actions préparées (confirmation obligatoire) ───────────────────────────
  outil("pos_preparer_bon_commande", "Prépare un bon de commande fournisseur EN BROUILLON (réassort). Appelle d'abord pos_quoi_commander pour les quantités. Le marchand valide, puis relit et envoie le bon lui-même.", { lignes: LIGNES, fournisseur: { type: "string", description: "Nom du fournisseur ; par défaut, le fournisseur recommandé de chaque produit" } }, ["lignes"]),
  outil("pos_preparer_promotion", "Prépare une promotion en pourcentage sur des produits ou des catégories. Elle est créée INACTIVE : le marchand l'active dans l'écran Promotions.", {
    nom: { type: "string" }, pourcentage: { type: "number", description: "Remise en %, de 1 à 100" },
    produits: { type: "array", items: { type: "string" }, description: "Noms exacts ou identifiants des produits" },
    categories: { type: "array", items: { type: "string" } }, date_fin: { type: "string", description: "Date de fin, AAAA-MM-JJ" },
  }, ["nom", "pourcentage"]),
  outil("pos_preparer_inventaire", "Ouvre un inventaire à compter : complet, par catégories, ou cyclique (quelques articles proposés). Aucun stock n'est modifié tant que le comptage n'est pas validé.", {
    type: { type: "string", enum: ["complet", "categorie", "cyclique"] }, categories: { type: "array", items: { type: "string" } }, nombre: { type: "number", description: "Nombre d'articles (inventaire cyclique)" },
  }, ["type"]),
  outil("pos_preparer_transfert", "Prépare un transfert de stock EN BROUILLON entre deux magasins ou entrepôts. Aucun stock ne bouge tant qu'il n'est pas expédié.", {
    depuis: { type: "string", description: "Nom du magasin ou de l'entrepôt de départ" }, vers: { type: "string", description: "Nom du magasin ou de l'entrepôt d'arrivée" }, lignes: LIGNES,
  }, ["depuis", "vers", "lignes"]),
];

// ─── Aides ────────────────────────────────────────────────────────────────────

type Resultat = { succes: boolean; resultat: string };
const ok = (resultat: string): Resultat => ({ succes: true, resultat });
const refus = (resultat: string): Resultat => ({ succes: false, resultat });
const nb = (n: number) => Math.round(n).toLocaleString("fr-FR");
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

/** ponytail: « aujourd'hui » commence à minuit UTC (la boutique n'a pas de fuseau enregistré) ; la réponse le dit. */
function periode(tenantId: string, p: unknown): { f: FiltresVentes; libelle: string } {
  const fin = new Date();
  const jours = p === "7j" ? 7 : p === "30j" ? 30 : 0;
  const debut = jours ? new Date(fin.getTime() - jours * 86_400_000) : new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate()));
  return { f: { tenantId, debut, fin, tz: "UTC", magasinsAutorises: [] }, libelle: jours ? `${jours} derniers jours` : "aujourd'hui (depuis 00:00 UTC)" };
}
const precedente = (f: FiltresVentes): FiltresVentes => ({ ...f, debut: new Date(2 * f.debut.getTime() - f.fin.getTime()), fin: f.debut });
const variation = (a: number, b: number) => (b > 0 ? ` (${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} % vs période précédente)` : "");

/** Contexte des fonctions des autres lots : elles ne tournent ici qu'APRÈS la validation du marchand dans la bulle AXIA. */
async function contexteAxia(tenantId: string): Promise<ContextePos> {
  const { magasinId, caisseId } = await assurerMagasinParDefaut(tenantId);
  return { tenantId, userId: "axia", userNom: "AXIA (validé par le marchand)", magasinId, caisseId, droits: TOUS_DROITS };
}

/** Produit désigné par son identifiant ou son nom. Plusieurs produits au même nom : refus, avec la liste. */
async function trouverProduit(tenantId: string, texte: unknown) {
  const q = String(texte ?? "").trim();
  if (!q) throw new ErreurPos("invalide", 400, "Produit non précisé.");
  const select = { id: true, nom: true, cout: true, categorie: true } as const;
  const parId = await prisma.produit.findFirst({ where: { id: q, tenantId }, select });
  if (parId) return parId;
  const exacts = await prisma.produit.findMany({ where: { tenantId, nom: { equals: q, mode: "insensitive" } }, select, take: 2 });
  if (exacts.length === 1) return exacts[0];
  const proches = await prisma.produit.findMany({ where: { tenantId, actif: true, nom: { contains: q, mode: "insensitive" } }, select, take: 6 });
  if (proches.length === 1) return proches[0];
  throw new ErreurPos("introuvable", 404, proches.length ? `Plusieurs produits correspondent à « ${q} » : ${proches.map((p) => p.nom).join(", ")}. Précise lequel.` : `Aucun produit ne s'appelle « ${q} ».`);
}

/** Entrepôt désigné par le nom d'un magasin ou par son propre nom. */
async function trouverLieu(tenantId: string, texte: unknown): Promise<{ id: string; nom: string }> {
  const q = String(texte ?? "").trim();
  const magasin = await prisma.magasin.findFirst({ where: { tenantId, nom: { contains: q, mode: "insensitive" } }, select: { nom: true, entrepotId: true } });
  if (q && magasin) return { id: magasin.entrepotId, nom: magasin.nom };
  const entrepot = q ? await prisma.entrepot.findFirst({ where: { tenantId, nom: { contains: q, mode: "insensitive" } }, select: { id: true, nom: true } }) : null;
  if (entrepot) return entrepot;
  throw new ErreurPos("introuvable", 404, `Aucun magasin ni entrepôt ne s'appelle « ${q} ».`);
}

const resumeVentes = (a: Agregat, devise: string) =>
  `CA ${nb(a.ca)} ${devise} | ${a.transactions} vente(s) | panier moyen ${nb(a.transactions ? a.ca / a.transactions : 0)} ${devise} | remises ${nb(a.remises)} ${devise} | retours ${nb(a.retours)} ${devise}`;

// ─── Exécuteur ────────────────────────────────────────────────────────────────

/** Exécute un outil `pos_*`. Pour une action préparée : à n'appeler qu'après l'accord du marchand (lib/axia/tools.ts s'en charge). */
export const executerOutilPos: ToolExecutor = async (nom, args, tenantId) => {
  try {
    if (!(await flagActif(tenantId, "axia_pos"))) return refus("AXIA n'est pas activé pour la caisse de cette boutique. Le marchand peut l'activer dans Caisse & magasin → Réglages de la caisse → « AXIA dans la caisse ».");
    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { devise: true, nomBoutique: true } });
    const devise = tenant?.devise ?? "XAF";

    switch (nom) {
      case "pos_ventes_jour": {
        const { f, libelle } = periode(tenantId, args.periode);
        const [a, b] = await Promise.all([totalVentes(f), totalVentes(precedente(f))]);
        if (!a.transactions) return ok(`Aucune vente en caisse ${libelle}.${b.transactions ? ` Période précédente : ${resumeVentes(b, devise)}.` : ""}`);
        return ok(`Ventes en caisse, ${libelle} — ${resumeVentes(a, devise)}${variation(a.ca, b.ca)}. Chiffres nets des remises et des retours.`);
      }

      case "pos_marge": {
        const { f, libelle } = periode(tenantId, args.periode);
        const [a, b, produits] = await Promise.all([totalVentes(f), totalVentes(precedente(f)), agregerVentes(f, "produit")]);
        if (!a.transactions) return ok(`Aucune vente en caisse ${libelle} : pas de marge à analyser.`);
        if (a.cout <= 0) return ok(`Marge non calculable ${libelle} : aucun prix d'achat n'est saisi sur les produits vendus (CA ${nb(a.ca)} ${devise}). Saisis les coûts sur les fiches produit ou à la réception.`);
        const mA = pct(a.marge, a.caHT), mB = pct(b.marge, b.caHT);
        const causes: string[] = [];
        if (b.transactions && b.cout > 0) {
          const remA = pct(a.remises, a.ca + a.remises), remB = pct(b.remises, b.ca + b.remises);
          if (remA > remB + 1) causes.push(`remises plus fortes (${remA} % du prix affiché contre ${remB} %)`);
          const retA = pct(a.retours, a.ca + a.retours), retB = pct(b.retours, b.ca + b.retours);
          if (retA > retB + 1) causes.push(`plus de retours (${retA} % contre ${retB} %)`);
          const cA = pct(a.cout, a.caHT), cB = pct(b.cout, b.caHT);
          if (cA > cB + 1) causes.push(`coût d'achat plus lourd dans les ventes (${cA} % du CA hors taxes contre ${cB} %) : prix d'achat en hausse ou produits moins rentables davantage vendus`);
        }
        const faibles = produits.filter((p) => p.caHT > 0 && p.cout > 0).map((p) => ({ nom: p.nom ?? "Produit", m: pct(p.marge, p.caHT), ca: p.ca })).sort((x, y) => x.m - y.m).slice(0, 5);
        return ok([
          `Marge en caisse, ${libelle} : ${nb(a.marge)} ${devise}, soit ${mA} % du CA hors taxes (${nb(a.caHT)} ${devise}).`,
          b.transactions && b.cout > 0 ? `Période précédente : ${mB} %.` : "Pas de période précédente comparable.",
          causes.length ? `Causes visibles dans les chiffres : ${causes.join(" ; ")}.` : mA < mB ? "Aucune cause nette ne ressort des remises, des retours ni des coûts." : "",
          faibles.length ? `Produits vendus aux marges les plus faibles : ${faibles.map((p) => `${p.nom} (${p.m} %, CA ${nb(p.ca)})`).join(", ")}.` : "",
          a.lignesCoutApproche ? `Attention : ${a.lignesCoutApproche} ligne(s) utilisent le coût ACTUEL du produit (ventes d'avant la nouvelle caisse) — marge approchée.` : "",
        ].filter(Boolean).join("\n"));
      }

      case "pos_caisse_performante": {
        const { f, libelle } = periode(tenantId, args.periode);
        const [parCaisse, caisses] = await Promise.all([
          agregerVentes(f, "caisse"),
          prisma.caisse.findMany({ where: { tenantId }, select: { id: true, nom: true, magasin: { select: { nom: true } } } }),
        ]);
        if (!parCaisse.length) return ok(`Aucune vente en caisse ${libelle}.`);
        const lignes = parCaisse.sort((x, y) => y.ca - x.ca).map((a) => {
          const c = caisses.find((x) => x.id === a.cle);
          return `• ${c ? `${c.nom} (${c.magasin.nom})` : "Ancienne caisse"} — ${nb(a.ca)} ${devise}, ${a.transactions} vente(s), panier moyen ${nb(a.transactions ? a.ca / a.transactions : 0)} ${devise}`;
        });
        return ok(`Ventes par caisse, ${libelle} :\n${lignes.join("\n")}`);
      }

      case "pos_produits_rupture":
      case "pos_quoi_commander": {
        const { aCommander, sansRecommandation, analyses } = await recommandationsReappro(tenantId);
        if (nom === "pos_produits_rupture") {
          const proches = [...aCommander, ...sansRecommandation].filter((l) => l.niveau === "rupture" || l.niveau === "urgent").slice(0, 20);
          if (!proches.length) return ok(`Aucun produit en rupture ni proche de la rupture (${analyses} produits analysés).`);
          return ok(`Produits en rupture ou proches (estimation sur les ventes des 30 derniers jours) :\n${proches.map((l) => `• ${l.nom} — stock ${l.stock}${l.niveau === "rupture" ? ", EN RUPTURE" : `, environ ${l.joursRestants} jour(s) de stock`} ; délai fournisseur ${l.delaiJours} j${l.delaiConnu ? "" : " (par défaut)"}${l.enCommande ? ` ; ${l.enCommande} déjà en commande` : ""}`).join("\n")}`);
        }
        if (!aCommander.length) return ok(`Rien à commander pour l'instant (${analyses} produits analysés).`);
        return ok(`Réassort recommandé (ESTIMATION : rythme de vente, délai fournisseur, 14 jours de sécurité, déjà en commande déduit) :\n${aCommander.slice(0, 20).map((l) => `• ${l.nom} — commander ${l.calcul.quantite} (stock ${l.stock}, ${l.ventes30j} vendus en 30 j) — fournisseur : ${l.fournisseur?.nom ?? "aucun fournisseur renseigné"}`).join("\n")}\nPour créer les bons de commande : pos_preparer_bon_commande avec ces lignes.`);
      }

      case "pos_produits_dormants": {
        const d = await produitsDormants(tenantId, { limite: 15, voirCouts: true });
        if (!d.total) return ok(`Aucun produit dormant : tout ce qui est en stock s'est vendu dans les ${d.jours} derniers jours.`);
        return ok(`${d.total} produit(s) en stock sans vente depuis ${d.jours} jours. Plus gros stocks immobilisés :\n${d.produits.map((p) => `• ${p.nom} — stock ${p.stock}${p.valeur !== null ? `, ${nb(p.valeur)} ${devise} au prix d'achat` : ""}${p.derniereVente ? `, dernière vente le ${new Date(p.derniereVente).toLocaleDateString("fr-FR")}` : ", jamais vendu"}`).join("\n")}`);
      }

      case "pos_comparer_fournisseurs": {
        const produit = await trouverProduit(tenantId, args.produit);
        const c = await comparerFournisseursProduit(tenantId, produit.id, Number(args.quantite) || undefined);
        if (!c.offres.length) return ok(`Aucune offre fournisseur n'est enregistrée pour « ${produit.nom} ». Ajoute des offres dans Sourcing pour pouvoir comparer.`);
        const lignes = c.offres.map((o) => `• ${o.nom}${o.principal ? " (principal)" : ""} — ${o.prixAnnonce ? `${o.prixAnnonce.montant} ${o.prixAnnonce.devise} annoncé` : "prix inconnu"}${o.coutRendu ? `, coût rendu estimé ${nb(o.coutRendu.montant)} ${o.coutRendu.devise}` : ""} ; délai ${o.delaiJours} j${o.delaiConstate ? " (constaté)" : " (déclaré)"} ; minimum ${o.moq ?? "non précisé"} ; score ${o.score}/100${o.dernierPrixPaye !== null ? ` ; dernier prix payé ${nb(o.dernierPrixPaye)} ${c.devise}` : ""}`);
        const r = c.recommandation;
        return ok(`Fournisseurs de « ${produit.nom} » pour ${c.quantite} unité(s) :\n${lignes.join("\n")}\n${r ? `Recommandation AXSO : ${r.nom}${r.ferme ? "" : " (meilleur disponible, mais données insuffisantes ou risque élevé)"} — ${r.explication}` : "Pas assez de données pour recommander un fournisseur."}`);
      }

      case "pos_rapport": {
        const { f, libelle } = periode(tenantId, args.periode);
        const [a, b, produits, alertes] = await Promise.all([totalVentes(f), totalVentes(precedente(f)), agregerVentes(f, "produit"), calculerAlertes(tenantId)]);
        const top = produits.sort((x, y) => y.ca - x.ca).slice(0, 5);
        return ok([
          `RAPPORT DU MAGASIN — ${tenant?.nomBoutique ?? ""} — ${libelle}`,
          a.transactions ? `Ventes : ${resumeVentes(a, devise)}${variation(a.ca, b.ca)}.` : "Ventes : aucune vente en caisse sur la période.",
          a.cout > 0 ? `Marge : ${nb(a.marge)} ${devise} (${pct(a.marge, a.caHT)} % du CA hors taxes)${a.lignesCoutApproche ? ", approchée" : ""}.` : "Marge : non calculable (aucun prix d'achat saisi).",
          top.length ? `Meilleures ventes : ${top.map((p) => `${p.nom} (${nb(p.ca)} ${devise})`).join(", ")}.` : "",
          alertes.length ? `Alertes en cours :\n${alertes.slice(0, 8).map((x) => `• ${x.titre} — ${x.message}`).join("\n")}` : "Aucune alerte en cours.",
        ].filter(Boolean).join("\n"));
      }

      case "pos_relance_client": {
        const q = String(args.client ?? "").trim();
        const clients = await prisma.client.findMany({
          where: { tenantId, creditUtilise: { gt: 0 }, OR: [{ nom: { contains: q, mode: "insensitive" } }, { telephone: { contains: q.replace(/\s/g, "") } }] },
          select: { nom: true, telephone: true, creditUtilise: true }, take: 3,
        });
        if (!clients.length) return ok(`Aucun client nommé « ${q} » n'a de dette en cours dans ce magasin.`);
        if (clients.length > 1) return ok(`Plusieurs clients correspondent : ${clients.map((c) => `${c.nom} (${nb(c.creditUtilise)} ${devise})`).join(", ")}. Précise lequel.`);
        const c = clients[0];
        const message = `Bonjour ${c.nom}, c'est ${tenant?.nomBoutique ?? "votre magasin"}. Sauf erreur de notre part, il reste ${nb(c.creditUtilise)} ${devise} à régler sur votre compte. Vous pouvez passer au magasin quand cela vous arrange. Merci et à bientôt !`;
        return ok(`MESSAGE PRÊT (rien n'a été envoyé) pour ${c.nom}${c.telephone ? ` — ${c.telephone}` : ""}, qui doit ${nb(c.creditUtilise)} ${devise} :\n« ${message} »\nLe marchand peut le copier, ou l'envoyer depuis Crédit clients.`);
      }

      // ─── Actions préparées — exécutées seulement après validation ─────────────
      case "pos_preparer_bon_commande": {
        const demandes = Array.isArray(args.lignes) ? args.lignes : [];
        if (!demandes.length) return refus("Aucune ligne à commander.");
        const reappro = await recommandationsReappro(tenantId);
        const connus = new Map([...reappro.aCommander, ...reappro.sansRecommandation].map((l) => [l.produitId, l]));
        const impose = args.fournisseur
          ? await prisma.fournisseur.findFirst({ where: { tenantId, actif: true, nom: { contains: String(args.fournisseur), mode: "insensitive" } }, select: { id: true, nom: true } })
          : null;
        if (args.fournisseur && !impose) return refus(`Aucun fournisseur actif ne s'appelle « ${args.fournisseur} ».`);
        const parFournisseur = new Map<string, { produitId: string; quantite: number; prixUnitaire: number }[]>();
        const sansFournisseur: string[] = [];
        for (const d of demandes) {
          const produit = await trouverProduit(tenantId, d.produit);
          const quantite = Math.floor(Number(d.quantite));
          if (!(quantite > 0)) return refus(`Quantité invalide pour « ${produit.nom} ».`);
          const fournisseurId = impose?.id ?? connus.get(produit.id)?.fournisseur?.id;
          if (!fournisseurId) { sansFournisseur.push(produit.nom); continue; }
          parFournisseur.set(fournisseurId, [...(parFournisseur.get(fournisseurId) ?? []), { produitId: produit.id, quantite, prixUnitaire: connus.get(produit.id)?.prixEstime ?? produit.cout ?? 0 }]);
        }
        if (!parFournisseur.size) return refus(`Aucun bon créé : aucun fournisseur n'est renseigné pour ${sansFournisseur.join(", ")}. Indique le fournisseur, ou renseigne-le sur la fiche produit.`);
        const ctx = await contexteAxia(tenantId);
        const r = await creerBons(ctx, [...parFournisseur].map(([fournisseurId, lignes]) => ({ fournisseurId, lignes, notes: "Préparé par AXIA, validé par le marchand." })), "reappro", `axia:${randomUUID()}`);
        return ok(`${r.bons.length} bon(s) de commande créé(s) EN BROUILLON : ${r.bons.map((b) => `${b.numero} — ${b.fournisseur}, ${b.lignes} ligne(s), ${nb(b.montantTotal)} ${devise}`).join(" ; ")}. Rien n'a été envoyé au fournisseur : le marchand relit les prix et envoie depuis Achats & réassort.${sansFournisseur.length ? ` Non commandés, faute de fournisseur : ${sansFournisseur.join(", ")}.` : ""}`);
      }

      case "pos_preparer_promotion": {
        const produits = [];
        for (const p of Array.isArray(args.produits) ? args.produits : []) produits.push(await trouverProduit(tenantId, p));
        const categories = (Array.isArray(args.categories) ? args.categories : []).map(String).filter(Boolean);
        const donnees = schemaPromotion.safeParse({
          nom: String(args.nom ?? ""), type: "pourcentage", valeur: Number(args.pourcentage), actif: false,
          dateFin: args.date_fin ? String(args.date_fin) : null,
          regles: {
            ...(produits.length ? { produitIds: produits.map((p) => p.id), libelles: Object.fromEntries(produits.map((p) => [p.id, p.nom])) } : {}),
            ...(categories.length ? { categories } : {}),
          },
        });
        if (!donnees.success) return refus(`Promotion refusée : ${donnees.error.issues[0]?.message ?? "informations incomplètes"}`);
        const d = donnees.data;
        const promotion = await prisma.$transaction(async (tx) => {
          const cree = await tx.promotion.create({
            data: { tenantId, nom: d.nom, type: d.type, valeur: d.valeur ?? null, regles: d.regles as Prisma.InputJsonValue, cumulable: d.cumulable, priorite: d.priorite, dateDebut: d.dateDebut ?? null, dateFin: d.dateFin ?? null, magasinIds: d.magasinIds, actif: false },
            select: { id: true, nom: true },
          });
          await journaliserAudit(tx, { tenantId, userNom: "AXIA (validé par le marchand)" }, { action: "promotion.creee", entite: "Promotion", entiteId: cree.id, apres: { nom: d.nom, type: d.type, valeur: d.valeur, actif: false, source: "axia" } });
          return cree;
        });
        const actif = await flagActif(tenantId, "smart_promotions");
        return ok(`Promotion « ${promotion.nom} » (−${d.valeur} %${produits.length || categories.length ? "" : ", sur tout le magasin"}) créée INACTIVE. Le marchand la relit et l'active dans Caisse & magasin → Promotions.${actif ? "" : " Attention : le moteur de promotions est éteint dans les réglages de la caisse ; il faudra aussi l'allumer."}`);
      }

      case "pos_preparer_inventaire": {
        const type = ["complet", "categorie", "cyclique"].includes(args.type) ? (args.type as "complet" | "categorie" | "cyclique") : "cyclique";
        const ctx = await contexteAxia(tenantId);
        const r = await creerInventaire(ctx, {
          cle: `axia:${randomUUID()}`, type, notes: "Préparé par AXIA, validé par le marchand.",
          perimetre: { ...(Array.isArray(args.categories) && args.categories.length ? { categories: args.categories.map(String) } : {}), ...(type === "cyclique" ? { nombre: Math.min(Math.max(Math.floor(Number(args.nombre)) || 20, 1), 500) } : {}) },
        });
        return ok(`Inventaire ${type} ouvert avec ${r.lignes} article(s) à compter. Aucun stock n'est modifié : le comptage se fait dans Caisse & magasin → Inventaires, puis un responsable le valide.`);
      }

      case "pos_preparer_transfert": {
        const [source, destination] = await Promise.all([trouverLieu(tenantId, args.depuis), trouverLieu(tenantId, args.vers)]);
        const lignes = [];
        for (const d of Array.isArray(args.lignes) ? args.lignes : []) {
          const produit = await trouverProduit(tenantId, d.produit);
          lignes.push({ produitId: produit.id, quantite: Math.max(1, Math.floor(Number(d.quantite)) || 1) });
        }
        if (!lignes.length) return refus("Aucun article à transférer.");
        const ctx = await contexteAxia(tenantId);
        const r = await creerTransfert(ctx, { cle: `axia:${randomUUID()}`, entrepotSourceId: source.id, entrepotDestinationId: destination.id, lignes, notes: "Préparé par AXIA, validé par le marchand.", demander: false });
        return ok(`Transfert ${r.numero} créé EN BROUILLON : ${source.nom} → ${destination.nom}, ${lignes.length} article(s). Aucun stock n'a bougé : il reste à le demander, l'approuver et l'expédier dans Caisse & magasin → Transferts de stock.`);
      }

      default:
        return refus("Fonction indisponible : cet outil de caisse n'existe pas sur cette version.");
    }
  } catch (err: any) {
    // Les refus métier (ErreurPos) sont des phrases prêtes à dire ; le reste est masqué.
    if (err instanceof ErreurPos || typeof err?.status === "number") return refus(err.message);
    console.error("[axia-pos]", nom, err);
    return refus("Fonction indisponible pour le moment : la caisse n'a pas pu répondre. Réessaie dans un instant.");
  }
};
