// Observabilité de la caisse (§66). SERVEUR uniquement.
//
// Chaque métrique dit d'où elle vient et ce qu'elle vaut VRAIMENT. Une métrique
// sans source fiable est rendue `valeur: null` avec la raison (« non mesuré ») —
// jamais un chiffre inventé.
//
// Ce que le serveur peut mesurer : ce qui est écrit en base (ScanPos,
// MutationPos, PaiementVente). Ce qu'il ne peut pas : ce qui reste sur le
// poste (file hors ligne dans IndexedDB, erreurs d'affichage, requêtes qui
// n'arrivent jamais).
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

export type Metrique = {
  nom: "scan_success_rate" | "scan_latency" | "sync_latency" | "offline_queue_size" | "payment_success_rate" | "pos_error_rate";
  libelle: string;
  /** null = non mesuré (voir `note`). */
  valeur: number | null;
  unite: "%" | "ms" | "opérations";
  /** Nombre d'observations derrière la valeur. */
  echantillon: number;
  /** Source, limites, ou raison de l'absence de mesure. */
  note: string;
};

const mediane = (ms: number | null | undefined) => (ms === null || ms === undefined ? null : Math.round(ms));

/** Métriques d'une boutique sur les `heures` dernières heures (24 par défaut, 720 au plus). */
export async function metriquesPos(tenantId: string, heures = 24): Promise<{ periodeHeures: number; calculeAt: string; metriques: Metrique[] }> {
  const periodeHeures = Math.min(Math.max(Math.round(heures) || 24, 1), 720);
  const depuis = new Date(Date.now() - periodeHeures * 3_600_000);

  const [scans, latenceScan, sync, paiements, mutations] = await Promise.all([
    prisma.scanPos.groupBy({ by: ["resultat"], where: { tenantId, createdAt: { gte: depuis } }, _count: { _all: true } }),
    // Scans des téléphones : heure du scan sur l'appareil → heure d'enregistrement. Les écarts négatifs ou
    // de plus d'une minute (horloge déréglée, scan gardé hors ligne puis renvoyé) sont écartés.
    prisma.$queryRaw<{ mediane: number | null; nombre: bigint }[]>(Prisma.sql`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (s."createdAt" - s."scanneAt")) * 1000) AS mediane, COUNT(*) AS nombre
      FROM "ScanPos" s
      WHERE s."tenantId" = ${tenantId} AND s."createdAt" >= ${depuis} AND s."source" = 'mobile'
        AND s."createdAt" > s."scanneAt" AND s."createdAt" - s."scanneAt" < INTERVAL '60 seconds'`),
    // Opérations saisies sur un appareil (creeLocalAt) → reçues par le serveur (recueAt).
    prisma.$queryRaw<{ mediane: number | null; nombre: bigint; retard: bigint }[]>(Prisma.sql`
      SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (m."recueAt" - m."creeLocalAt")) * 1000) AS mediane, COUNT(*) AS nombre,
        COUNT(*) FILTER (WHERE m."recueAt" - m."creeLocalAt" > INTERVAL '60 seconds') AS retard
      FROM "MutationPos" m
      WHERE m."tenantId" = ${tenantId} AND m."recueAt" >= ${depuis} AND m."creeLocalAt" IS NOT NULL AND m."recueAt" >= m."creeLocalAt"`),
    prisma.paiementVente.groupBy({ by: ["statut"], where: { tenantId, createdAt: { gte: depuis }, montant: { gt: 0 } }, _count: { _all: true } }),
    prisma.mutationPos.groupBy({ by: ["statut"], where: { tenantId, recueAt: { gte: depuis }, type: { not: "alerte" } }, _count: { _all: true } }),
  ]);

  const compte = (g: { _count: { _all: number } }[]) => g.reduce((s, x) => s + x._count._all, 0);
  const de = <K extends string>(g: ({ _count: { _all: number } } & Record<K, string>)[], cle: K, valeur: string) => g.find((x) => x[cle] === valeur)?._count._all ?? 0;
  const pct = (n: number, d: number) => Math.round((n / d) * 1000) / 10;

  const totalScans = compte(scans);
  const nbLatence = Number(latenceScan[0]?.nombre ?? 0);
  const nbSync = Number(sync[0]?.nombre ?? 0);
  const confirmes = de(paiements, "statut", "confirme"), echoues = de(paiements, "statut", "echoue");
  const totalMutations = compte(mutations), conflits = de(mutations, "statut", "conflit"), rejetees = de(mutations, "statut", "rejetee");

  return {
    periodeHeures, calculeAt: new Date().toISOString(),
    metriques: [
      {
        nom: "scan_success_rate", libelle: "Scans reconnus", unite: "%", echantillon: totalScans,
        valeur: totalScans ? pct(de(scans, "resultat", "trouve"), totalScans) : null,
        note: totalScans ? "Part des codes lus qui correspondent à un article du catalogue (les autres sont inconnus ou ambigus). Les scans du poste faits hors ligne ne sont pas tracés." : "Aucun scan enregistré sur la période.",
      },
      {
        nom: "scan_latency", libelle: "Délai d'un scan de téléphone", unite: "ms", echantillon: nbLatence,
        valeur: nbLatence ? mediane(latenceScan[0].mediane) : null,
        note: nbLatence ? "Médiane entre l'heure du scan sur le téléphone et son enregistrement. Indicatif : elle dépend de l'horloge du téléphone, et ne compte pas l'affichage sur le poste." : "Non mesuré : aucun scan de téléphone exploitable sur la période.",
      },
      {
        nom: "sync_latency", libelle: "Délai de synchronisation", unite: "ms", echantillon: nbSync,
        valeur: nbSync ? mediane(sync[0].mediane) : null,
        note: nbSync ? `Médiane entre la saisie sur l'appareil et la réception par le serveur. ${Number(sync[0].retard)} opération(s) reçue(s) avec plus d'une minute de retard (saisies hors ligne).` : "Non mesuré : aucune opération horodatée par un appareil sur la période.",
      },
      {
        nom: "offline_queue_size", libelle: "File d'attente hors ligne", unite: "opérations", echantillon: 0, valeur: null,
        note: "Non mesurable côté serveur : la file vit sur chaque poste tant qu'il est hors ligne. Chaque poste affiche la sienne ; le serveur ne voit les opérations qu'à leur arrivée (voir le délai de synchronisation).",
      },
      {
        nom: "payment_success_rate", libelle: "Paiements aboutis", unite: "%", echantillon: confirmes + echoues,
        // Les moyens de la caisse sont déclarés par le caissier : aucun prestataire ne renvoie d'échec.
        valeur: echoues > 0 ? pct(confirmes, confirmes + echoues) : null,
        note: echoues > 0 ? "Paiements confirmés sur l'ensemble confirmés + échoués." : `Non mesuré : aucun échec n'est enregistré, parce qu'aucun moyen de paiement de la caisse n'est relié à un prestataire (${confirmes} paiement(s) saisi(s) sur la période, déclarés par le caissier).`,
      },
      {
        nom: "pos_error_rate", libelle: "Erreurs de la caisse", unite: "%", echantillon: totalMutations, valeur: null,
        note: `Non mesuré : une opération refusée n'est pas enregistrée, et les erreurs d'affichage restent sur le poste. Seul chiffre fiable : ${conflits} conflit(s) et ${rejetees} rejet(s) parmi ${totalMutations} opération(s) enregistrée(s).`,
      },
    ],
  };
}
