// Essai de 7 jours du plan Illimité : état du compte, démarrage, réponses et
// rappels. Les règles sont dans lib/essai-regles.ts ; l'essai compte comme
// Illimité dans lib/abonnement.ts::planActif (tous les cadenas le suivent).
import { prisma } from "./prisma";
import { boutiquesDuMemeCompte, planActif } from "./abonnement";
import { calculerEssai, finEssaiDepuis, rappelDu, type EtatEssai } from "./essai-regles";
import { envoyerRappelEssai } from "./email";
import { pousserMarchands } from "./push";

export async function etatEssai(tenantId: string): Promise<EtatEssai> {
  const [boutiques, { planPaye }] = await Promise.all([
    boutiquesDuMemeCompte(tenantId, { essaiStatut: true, essaiFinLe: true }),
    planActif(tenantId),
  ]);
  return calculerEssai(boutiques, planPaye);
}

/** Démarre l'essai (une seule fois par compte). Renvoie sa fin, ou null s'il a déjà été utilisé. */
export async function demarrerEssai(tenantId: string): Promise<Date | null> {
  if ((await etatEssai(tenantId)).phase !== "disponible") return null;
  const finLe = finEssaiDepuis();
  // essaiFinLe: null : deux clics simultanés ne démarrent pas deux essais.
  const { count } = await prisma.tenant.updateMany({ where: { id: tenantId, essaiFinLe: null }, data: { essaiStatut: "accepte", essaiFinLe: finLe, essaiRappel: null } });
  return count ? finLe : null;
}

/** « Non merci » à la proposition, ou fenêtre de fin d'essai vue : elles ne reviennent plus. */
export async function repondreEssai(tenantId: string, reponse: "refuse" | "fin_vue") {
  const etat = await etatEssai(tenantId);
  if (reponse === "refuse" ? etat.phase !== "disponible" : etat.phase !== "termine") return;
  await prisma.tenant.update({ where: { id: tenantId }, data: { essaiStatut: reponse } });
}

/** Tâche quotidienne : rappel 48 h avant la fin, puis à la fin (e-mail + notification). Chaque rappel part une fois. */
export async function passeRappelsEssai(): Promise<{ envoyes: number }> {
  const boutiques = await prisma.tenant.findMany({
    where: { essaiFinLe: { not: null }, essaiStatut: "accepte", OR: [{ essaiRappel: null }, { essaiRappel: "j2" }] },
    select: { id: true, nomBoutique: true, email: true, essaiFinLe: true, essaiRappel: true },
  });
  let envoyes = 0;
  for (const b of boutiques) {
    const rappel = rappelDu(b.essaiFinLe!, b.essaiRappel);
    if (!rappel) continue;
    // Déjà abonné (payé pendant l'essai) : rien à lui proposer.
    if ((await planActif(b.id)).planPaye !== "palier0") {
      await prisma.tenant.update({ where: { id: b.id }, data: { essaiRappel: "fin" } });
      continue;
    }
    await prisma.tenant.update({ where: { id: b.id }, data: { essaiRappel: rappel } });
    const titre = rappel === "j2" ? "Ton essai Illimité se termine dans 2 jours" : "Ton essai Illimité est terminé";
    const message = rappel === "j2"
      ? "Choisis Pro ou Illimité pour garder tes avantages, ou continue gratuitement en Essentiel."
      : "Ta boutique est repassée en Essentiel. Choisis Pro ou Illimité pour retrouver tes avantages.";
    await Promise.allSettled([
      envoyerRappelEssai({ email: b.email, boutique: b.nomBoutique, titre, message }),
      pousserMarchands([b.id], { titre, message, lien: "/dashboard/abonnement", type: "essai" }),
    ]);
    envoyes++;
  }
  return { envoyes };
}
