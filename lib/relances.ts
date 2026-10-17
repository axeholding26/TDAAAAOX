// Moteur des relances automatiques (Campagnes → Relances, AutomationWorkflow) : à chaque passage
// de la tâche planifiée, chaque workflow actif cherche les événements arrivés à échéance (délai
// écoulé) et envoie son message, une seule fois par événement (RelanceEnvoyee).
//
// Ce qui se déclenche :
//   - bienvenue        : nouveau client, X heures après sa création
//   - apres_achat      : commande livrée, X heures après la livraison
//   - panier_abandonne : paiement en ligne commencé mais jamais payé, X heures après
//   - inactif          : client sans commande depuis X heures (une fois par période d'inactivité)
// Pas d'anniversaire (aucune date de naissance) ni de SMS (aucun fournisseur) : ignorés.
// Seuls les événements postérieurs à la création du workflow comptent (pas d'envoi en masse sur
// l'historique), dans une fenêtre de 7 jours (un passage manqué n'est pas perdu, un vieux non plus renvoyé).
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { planActif } from "@/lib/abonnement";
import { palierAuMoins } from "@/lib/plans";
import { PAIEMENT } from "@/lib/commandes";
import { emailReel, envoyerEmailTexte } from "@/lib/email";
import { envoyerWhatsApp } from "@/lib/whatsapp";
import { lienBoutique, origineAxso } from "@/lib/origine-site";

export const TYPES_RELANCE = ["bienvenue", "apres_achat", "panier_abandonne", "inactif"] as const;
export const CANAUX_RELANCE = ["email", "whatsapp"] as const;

const HEURE = 3_600_000;
const FENETRE = 7 * 24 * HEURE;
const MAX_PAR_PASSAGE = 50; // par workflow : le reste part au passage suivant
const PAIEMENTS_EN_LIGNE = ["notchpay", "stripe"];

interface Cible { cle: string; clientId: string; nom: string; email: string | null; telephone: string | null }

// ─── Désinscription (lien en bas de chaque message) ─────────────────────────
const secret = () => process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "";
const signer = (clientId: string) => createHmac("sha256", secret()).update(`relance:${clientId}`).digest("base64url");

export async function lienDesinscription(clientId: string) {
  return `${await origineAxso()}/api/relances/desabonner?c=${encodeURIComponent(clientId)}&s=${signer(clientId)}`;
}
export function signatureValide(clientId: string, signature: string) {
  if (!secret() || !clientId || !signature) return false;
  const a = Buffer.from(signer(clientId)), b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Cibles de chaque type ─────────────────────────────────────────────────
type Workflow = { id: string; tenantId: string; type: string; delaiHeures: number; createdAt: Date };

async function cibles(wf: Workflow, maintenant: Date): Promise<Cible[]> {
  const delai = Math.max(0, wf.delaiHeures) * HEURE;
  const fin = new Date(maintenant.getTime() - delai); // échéance atteinte
  const debut = new Date(Math.max(wf.createdAt.getTime(), fin.getTime() - FENETRE));
  if (debut >= fin) return [];
  const client = { id: true, nom: true, email: true, telephone: true, relancesRefuseesLe: true } as const;

  if (wf.type === "bienvenue") {
    const clients = await prisma.client.findMany({ where: { tenantId: wf.tenantId, createdAt: { gte: debut, lt: fin } }, select: client, take: 500 });
    return clients.map((c) => ({ cle: c.id, clientId: c.id, nom: c.nom, email: c.email, telephone: c.telephone, refus: c.relancesRefuseesLe })).filter((c) => !c.refus);
  }

  if (wf.type === "apres_achat" || wf.type === "panier_abandonne") {
    const where = wf.type === "apres_achat"
      ? { tenantId: wf.tenantId, statut: "livree", livreeAt: { gte: debut, lt: fin } }
      : { tenantId: wf.tenantId, statut: "en_attente", paiementStatut: PAIEMENT.ATTENTE, methodePaiement: { in: PAIEMENTS_EN_LIGNE }, createdAt: { gte: debut, lt: fin } };
    const commandes = await prisma.commande.findMany({
      where: { ...where, clientId: { not: null } },
      select: { id: true, clientNom: true, clientEmail: true, clientTelephone: true, client: { select: client } },
      take: 500,
    });
    return commandes.filter((c) => c.client && !c.client.relancesRefuseesLe).map((c) => ({
      cle: c.id, clientId: c.client!.id, nom: c.clientNom || c.client!.nom,
      email: c.clientEmail || c.client!.email, telephone: c.clientTelephone || c.client!.telephone,
    }));
  }

  if (wf.type === "inactif") {
    // Dernière commande de chaque client ; inactif quand elle a franchi le délai dans la fenêtre.
    const dernieres = await prisma.commande.groupBy({
      by: ["clientId"], where: { tenantId: wf.tenantId, clientId: { not: null }, statut: { not: "annulee" } },
      _max: { createdAt: true },
    });
    const echus = dernieres.filter((d) => d._max.createdAt && d._max.createdAt >= new Date(debut.getTime() - delai) && d._max.createdAt < fin);
    if (!echus.length) return [];
    const clients = await prisma.client.findMany({ where: { id: { in: echus.map((d) => d.clientId!) }, relancesRefuseesLe: null }, select: client });
    const derniere = new Map(echus.map((d) => [d.clientId!, d._max.createdAt!.getTime()]));
    // La clé change à chaque nouvelle commande : une relance par période d'inactivité, pas une seule à vie.
    return clients.map((c) => ({ cle: `${c.id}:${derniere.get(c.id)}`, clientId: c.id, nom: c.nom, email: c.email, telephone: c.telephone }));
  }

  return []; // anniversaire : aucune date de naissance enregistrée
}

/** {{nom}} (prénom), {{boutique}}, {{lien}} ; texte simple, borné. */
export function remplir(modele: string, v: { nom: string; boutique: string; lien: string }) {
  const prenom = v.nom.trim().split(/\s+/)[0] || v.nom;
  return modele.replace(/\{\{\s*nom\s*\}\}/gi, prenom).replace(/\{\{\s*boutique\s*\}\}/gi, v.boutique).replace(/\{\{\s*lien\s*\}\}/gi, v.lien).slice(0, 2000);
}

// ─── Passage ───────────────────────────────────────────────────────────────
export async function passeRelances(maintenant = new Date()) {
  const bilan = { workflows: 0, envoyes: 0, echecs: 0, ignores: 0 };
  const workflows = await prisma.automationWorkflow.findMany({
    where: { actif: true, type: { in: [...TYPES_RELANCE] }, canal: { in: [...CANAUX_RELANCE] } },
  });
  const plans = new Map<string, boolean>();

  for (const wf of workflows) {
    if (!plans.has(wf.tenantId)) plans.set(wf.tenantId, palierAuMoins((await planActif(wf.tenantId)).plan, "palier1"));
    if (!plans.get(wf.tenantId)) { bilan.ignores++; continue; } // relances : Palier Pro
    const tenant = await prisma.tenant.findUnique({ where: { id: wf.tenantId }, select: { nomBoutique: true, slug: true, email: true, statut: true } });
    if (!tenant || tenant.statut !== "active") { bilan.ignores++; continue; }
    bilan.workflows++;

    const toutes = await cibles(wf, maintenant);
    const contactables = toutes.filter((c) => (wf.canal === "email" ? emailReel(c.email) : !!c.telephone));
    const deja = new Set((await prisma.relanceEnvoyee.findMany({ where: { workflowId: wf.id, cle: { in: contactables.map((c) => c.cle) } }, select: { cle: true } })).map((r) => r.cle));
    const lien = await lienBoutique(tenant.slug);
    let envoyes = 0;

    for (const c of contactables.filter((x) => !deja.has(x.cle)).slice(0, MAX_PAR_PASSAGE)) {
      // Réservée avant l'envoi : deux passages simultanés n'envoient pas deux fois.
      const reserve = await prisma.relanceEnvoyee.create({ data: { workflowId: wf.id, cle: c.cle } }).catch(() => null);
      if (!reserve) continue;
      const texte = `${remplir(wf.message, { nom: c.nom, boutique: tenant.nomBoutique, lien })}\n\n—\nNe plus recevoir ces messages de ${tenant.nomBoutique} : ${await lienDesinscription(c.clientId)}`;
      const parti = wf.canal === "email"
        ? await envoyerEmailTexte({ a: c.email!, repondreA: tenant.email || "noreply@axsoafrica.com", boutique: tenant.nomBoutique, sujet: remplir(wf.sujet || `Un message de ${tenant.nomBoutique}`, { nom: c.nom, boutique: tenant.nomBoutique, lien }).slice(0, 200), texte }).catch(() => false)
        : await envoyerWhatsApp(c.telephone!, texte, wf.tenantId).catch(() => false);
      if (parti) { envoyes++; continue; }
      // Pas parti (service indisponible) : réservation retirée, nouvel essai au passage suivant tant que l'événement est dans la fenêtre.
      bilan.echecs++;
      await prisma.relanceEnvoyee.delete({ where: { id: reserve.id } }).catch(() => {});
    }

    if (envoyes) {
      bilan.envoyes += envoyes;
      await prisma.automationWorkflow.update({ where: { id: wf.id }, data: { declenchements: { increment: envoyes } } });
    }
  }
  return bilan;
}
