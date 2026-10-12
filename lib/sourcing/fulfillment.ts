// Livraison locale derrière une seule interface, FulfillmentProvider : plusieurs
// transporteurs par pays, sans coupler le cœur d'Axso à l'un d'eux. SERVEUR uniquement.
//
// ÉTAT RÉEL DES INTÉGRATIONS :
// - « livreurs_axso » : ACTIF. Adapter au-dessus de l'existant — livreurs de la
//   boutique et de la plateforme, tarifs ReglePort, code de remise à 4 chiffres,
//   remise des espèces (lib/cycle-livraison.ts, lib/livraison.ts).
// - « sandbox » : réponses fictives, pour essayer une intégration. N'écrit rien.
// - Aucun transporteur tiers (API) n'est branché : en ajouter un = écrire un
//   adapter ici et l'ajouter à PRESTATAIRES_LIVRAISON.
import { prisma } from "../prisma";
import { calculerOptionsLivraison } from "../livraison";
import { assignerLivreurCommande, changerStatutCommande, marquerEspecesRemises } from "../cycle-livraison";
import type { CodePays } from "./pays";
import type { StatutIntegration } from "./connecteurs";

export interface SuiviLivraison {
  statut: string;
  livreur?: string | null;
  position?: unknown;
  dateLivraison?: Date | null;
}

export interface FulfillmentProvider {
  id: string;
  nom: string;
  statut: StatutIntegration;
  /** Pays desservis ; "tous" = partout où la boutique a des livreurs ou des tarifs. */
  pays: CodePays[] | "tous";
  /** Frais de livraison proposés pour une destination. */
  fraisLivraison(p: { tenantId: string; pays: string; zone?: string; poidsKg?: number; montant?: number }): Promise<{ nom: string; frais: number; delai: string }[]>;
  /** Crée la livraison d'une commande (assignation à un livreur). */
  creerLivraison(p: { tenantId: string; commandeId: string; livreurId: string }): Promise<{ reference: string }>;
  /** Enlèvement du colis (départ en livraison). */
  enlever(p: { tenantId: string; commandeId: string }): Promise<void>;
  /** Remise au client ; `code` = preuve de livraison saisie par le client. */
  livrer(p: { tenantId: string; commandeId: string; code?: string }): Promise<void>;
  suivre(p: { tenantId: string; commandeId: string }): Promise<SuiviLivraison>;
  /** Preuve de livraison disponible. */
  preuveLivraison(p: { tenantId: string; commandeId: string }): Promise<{ type: string; valide: boolean; date: Date | null }>;
  /** Échec ou refus à la livraison : le colis revient. */
  retourner(p: { tenantId: string; commandeId: string; raison: string }): Promise<void>;
  /** Paiement à la livraison : le marchand confirme avoir reçu les espèces. */
  encaisserALaLivraison(p: { tenantId: string; commandeId: string; userId: string | null }): Promise<void>;
}

/** Fait remonter les refus du cycle de livraison (transition invalide, mauvais code…) comme des erreurs. */
function exiger<T extends { ok: boolean }>(r: T): asserts r is Extract<T, { ok: true }> {
  if (!r.ok) throw Object.assign(new Error((r as any).error), { status: (r as any).status });
}

const statut = async (tenantId: string, commandeId: string, cible: string, extra: { code?: string; echecRaison?: string } = {}) =>
  exiger(await changerStatutCommande({ commandeId, statut: cible, acteur: { type: "marchand", tenantId, source: "interface" }, ...extra }));

const livreursAxso: FulfillmentProvider = {
  id: "livreurs_axso",
  nom: "Livreurs Axso (boutique et plateforme)",
  statut: "actif",
  pays: "tous",
  fraisLivraison: async (p) =>
    (await calculerOptionsLivraison({ tenantId: p.tenantId, pays: p.pays, zone: p.zone, poids: p.poidsKg, montantCommande: p.montant }))
      .map((o) => ({ nom: o.transporteur ?? o.nom, frais: o.frais, delai: o.delai })),
  creerLivraison: async (p) => {
    exiger(await assignerLivreurCommande({ ...p, source: "interface" }));
    return { reference: p.commandeId };
  },
  enlever: (p) => statut(p.tenantId, p.commandeId, "expediee"),
  livrer: (p) => statut(p.tenantId, p.commandeId, "livree", { code: p.code }),
  suivre: async (p) => {
    const c = await prisma.commande.findFirst({
      where: { id: p.commandeId, tenantId: p.tenantId },
      select: { livraisonStatut: true, livreurNom: true, livreurPosition: true, livreeAt: true },
    });
    if (!c) throw Object.assign(new Error("Commande introuvable"), { status: 404 });
    return { statut: c.livraisonStatut, livreur: c.livreurNom, position: c.livreurPosition, dateLivraison: c.livreeAt };
  },
  preuveLivraison: async (p) => {
    const c = await prisma.commande.findFirst({ where: { id: p.commandeId, tenantId: p.tenantId }, select: { statut: true, livreeAt: true } });
    return { type: "code de remise à 4 chiffres", valide: c?.statut === "livree", date: c?.livreeAt ?? null };
  },
  retourner: (p) => statut(p.tenantId, p.commandeId, "tentative_echouee", { echecRaison: p.raison }),
  encaisserALaLivraison: async (p) => exiger(await marquerEspecesRemises({ tenantId: p.tenantId, userId: p.userId, commandeIds: [p.commandeId] })),
};

const sandbox: FulfillmentProvider = {
  id: "sandbox",
  nom: "Transporteur sandbox (fictif)",
  statut: "sandbox",
  pays: "tous",
  fraisLivraison: async () => [{ nom: "Sandbox — tarif fictif", frais: 0, delai: "—" }],
  creerLivraison: async (p) => ({ reference: `SANDBOX-${p.commandeId}` }),
  enlever: async () => {},
  livrer: async () => {},
  suivre: async () => ({ statut: "sandbox" }),
  preuveLivraison: async () => ({ type: "sandbox", valide: false, date: null }),
  retourner: async () => {},
  encaisserALaLivraison: async () => {},
};

export const PRESTATAIRES_LIVRAISON: FulfillmentProvider[] = [livreursAxso, sandbox];

/** Prestataires utilisables pour un pays (le sandbox n'est jamais proposé pour une vraie commande). */
export function prestatairesLivraison(pays: string): FulfillmentProvider[] {
  return PRESTATAIRES_LIVRAISON.filter((p) => p.statut === "actif" && (p.pays === "tous" || p.pays.includes(pays as CodePays)));
}
