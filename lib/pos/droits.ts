// Droits fins de la caisse — CLIENT-SAFE (aucun import de Prisma).
//
// La grille d'équipe (lib/permissions.ts : 9 modules × aucun/lecture/écriture)
// dit QUI entre dans la caisse ; cette grille-ci dit CE QU'IL PEUT Y FAIRE
// (remise, annulation, fermeture de caisse…). Elle part du rôle du membre et
// se retouche action par action dans MembreEquipe.droitsPos.
// Le propriétaire a tous les droits. Un appareil appairé (téléphone-scanner)
// hérite des droits de celui qui l'a appairé, bornés à ACTIONS_APPAREIL.
import { ACTIONS_POS, type ActionPos, type ContextePos, type DroitsPos } from "./types";
import { ErreurPos } from "./erreurs";
import { grillePourMembre } from "../permissions";

export { ACTIONS_POS };
export type { ActionPos, DroitsPos };

const grille = (actions: readonly ActionPos[]): DroitsPos =>
  Object.fromEntries(ACTIONS_POS.map((a) => [a, actions.includes(a)])) as DroitsPos;

export const TOUS_DROITS: DroitsPos = grille(ACTIONS_POS);
export const AUCUN_DROIT: DroitsPos = grille([]);

const CAISSIER: ActionPos[] = [
  "vendre", "encaisser", "remise", "suspendre_panier", "ouvrir_caisse", "fermer_caisse",
  "scanner", "voir_stock", "inventaire_compter", "gerer_clients",
];
const LECTURE: ActionPos[] = ["voir_stock", "voir_analytics"];
const COMPTABLE: ActionPos[] = ["voir_stock", "voir_caisse", "voir_couts", "rapprochement", "voir_analytics", "voir_audit", "import_export"];

/** Droits de départ par rôle d'équipe. Le gérant fait tout sauf régler la caisse et ses magasins. */
export const DROITS_PAR_ROLE: Record<string, DroitsPos> = {
  proprietaire: TOUS_DROITS,
  gerant: grille(ACTIONS_POS.filter((a) => a !== "gerer_reglages" && a !== "gerer_magasins")),
  caissier: grille(CAISSIER),
  comptable: grille(COMPTABLE),
  lecture: grille(LECTURE),
};

/** Ce qu'un appareil appairé peut faire au plus, quels que soient les droits de son propriétaire. */
export const ACTIONS_APPAREIL: ActionPos[] = ["scanner", "voir_stock", "inventaire_compter", "reception", "transfert_recevoir"];

/** Libellés pour les messages de refus et l'écran de réglage des droits. */
export const LIBELLES_ACTIONS: Record<ActionPos, string> = {
  vendre: "enregistrer une vente",
  encaisser: "encaisser un paiement",
  remise: "accorder une remise",
  remise_hors_plafond: "accorder une remise au-delà du plafond",
  prix_personnalise: "modifier le prix d'un article",
  produit_offert: "offrir un article",
  vente_credit: "vendre à crédit",
  suspendre_panier: "mettre un panier en attente",
  annuler_vente: "annuler une vente",
  retour: "enregistrer un retour",
  rembourser: "rembourser un client",
  ouvrir_caisse: "ouvrir la caisse",
  fermer_caisse: "fermer la caisse",
  mouvement_caisse: "enregistrer une entrée ou une sortie d'espèces",
  voir_caisse: "consulter les sessions de caisse",
  scanner: "scanner des articles",
  voir_stock: "consulter le stock",
  ajuster_stock: "corriger le stock",
  inventaire_compter: "compter un inventaire",
  inventaire_valider: "valider un inventaire",
  transfert_creer: "demander un transfert de stock",
  transfert_approuver: "approuver un transfert de stock",
  transfert_recevoir: "réceptionner un transfert de stock",
  achat_creer: "préparer une commande fournisseur",
  achat_valider: "valider une commande fournisseur",
  reception: "réceptionner une livraison",
  voir_couts: "voir les prix d'achat et les marges",
  creer_produit: "créer un produit",
  gerer_clients: "gérer les clients",
  gerer_credit: "gérer le crédit des clients",
  gerer_promotions: "gérer les promotions",
  gerer_fidelite: "gérer la fidélité",
  rapprochement: "rapprocher les paiements",
  voir_analytics: "consulter les chiffres",
  voir_audit: "consulter le journal d'audit",
  gerer_appareils: "gérer les appareils connectés",
  gerer_magasins: "gérer les magasins et les caisses",
  gerer_reglages: "modifier les réglages de la caisse",
  import_export: "importer ou exporter des données",
};

/**
 * Droits effectifs d'une personne. Rôle « personnalisé » : on part de sa grille
 * de modules (pos en écriture = caissier, en lecture = lecture ; finance ajoute
 * les droits du comptable), puis `droitsPos` retouche action par action.
 */
export function droitsPour(p: { proprietaire: boolean; role?: string | null; permissions?: unknown; droitsPos?: unknown }): DroitsPos {
  if (p.proprietaire) return TOUS_DROITS;
  let base: DroitsPos;
  if (p.role && p.role !== "personnalise" && DROITS_PAR_ROLE[p.role]) {
    base = DROITS_PAR_ROLE[p.role];
  } else {
    const g = grillePourMembre({ role: p.role ?? "lecture", permissions: p.permissions });
    const actions = new Set<ActionPos>(g.pos === "ecriture" ? CAISSIER : g.pos === "lecture" ? LECTURE : []);
    if (g.finance !== "aucun") COMPTABLE.forEach((a) => actions.add(a));
    base = grille([...actions]);
  }
  if (!p.droitsPos || typeof p.droitsPos !== "object") return base;
  const retouches = p.droitsPos as Record<string, unknown>;
  return Object.fromEntries(ACTIONS_POS.map((a) => [a, typeof retouches[a] === "boolean" ? (retouches[a] as boolean) : base[a]])) as DroitsPos;
}

/** Droits d'un appareil appairé : ceux de son propriétaire, bornés à ACTIONS_APPAREIL. */
export function droitsAppareil(droitsProprietaire: DroitsPos): DroitsPos {
  return grille(ACTIONS_APPAREIL.filter((a) => droitsProprietaire[a]));
}

export function aDroit(ctx: Pick<ContextePos, "droits">, action: ActionPos): boolean {
  return ctx.droits[action] === true;
}

/** Lève ErreurPos 403 (code « non_autorise ») si le droit manque. */
export function exigerDroit(ctx: Pick<ContextePos, "droits">, action: ActionPos): void {
  if (!aDroit(ctx, action)) {
    const libelle = LIBELLES_ACTIONS[action];
    // « de ouvrir » → « d'ouvrir »
    const de = /^[aeiouyéèê]/i.test(libelle) ? "d'" : "de ";
    throw new ErreurPos("non_autorise", 403, `Vous n'avez pas le droit ${de}${libelle}. Demandez à un responsable.`, { action });
  }
}

/** Passe si AU MOINS UN des droits est accordé (lecture utile à plusieurs métiers) ; sinon refuse au nom du premier. */
export function exigerUnDroit(ctx: Pick<ContextePos, "droits">, ...actions: ActionPos[]): void {
  if (!actions.some((a) => aDroit(ctx, a))) exigerDroit(ctx, actions[0]);
}

// ─── Cloisonnement par magasin ────────────────────────────────────────────────
// Un membre limité à certains magasins (ContextePos.magasinIds non vide) n'agit
// que sur leurs ventes et sur leur stock. Propriétaire et membre non limité : tout.

type CtxMagasins = Pick<ContextePos, "tenantId" | "magasinIds">;

/** Refuse (403) une vente, un panier… rattaché à un magasin hors de ceux du membre. Sans magasin (ancienne caisse) : accepté. */
export function exigerMagasin(ctx: Pick<ContextePos, "magasinIds">, magasinId: string | null | undefined): void {
  if (ctx.magasinIds?.length && magasinId && !ctx.magasinIds.includes(magasinId)) {
    throw new ErreurPos("non_autorise", 403, "Cette opération concerne un magasin auquel vous n'êtes pas affecté. Demandez à un responsable.", { magasinId });
  }
}

/** Le membre peut-il agir sur ce lieu de stock ? Oui s'il n'est pas limité, ou si c'est l'entrepôt d'un de ses magasins. */
export async function lieuAutorise(db: { magasin: { count: (args: { where: object }) => Promise<number> } }, ctx: CtxMagasins, entrepotId: string | null | undefined): Promise<boolean> {
  if (!ctx.magasinIds?.length) return true;
  return !!entrepotId && (await db.magasin.count({ where: { tenantId: ctx.tenantId, id: { in: ctx.magasinIds }, entrepotId } })) > 0;
}

/** Refuse (403) une opération de stock (inventaire, ajustement, réception, transfert…) hors des magasins du membre. */
export async function exigerLieu(db: Parameters<typeof lieuAutorise>[0], ctx: CtxMagasins, ...entrepotIds: (string | null | undefined)[]): Promise<void> {
  for (const id of entrepotIds) {
    if (!(await lieuAutorise(db, ctx, id))) {
      throw new ErreurPos("non_autorise", 403, "Ce lieu de stock n'appartient pas à vos magasins. Demandez à un responsable.", { entrepotId: id ?? null });
    }
  }
}
