// Certification Intelligence — fonctions pures.
// 1. Quelles certifications sont POTENTIELLEMENT nécessaires pour une famille
//    de produits (repères généraux, jamais un avis réglementaire : à confirmer
//    auprès de l'autorité du pays et du transitaire).
// 2. Où en est chaque certification chez un fournisseur : vérifiée, seulement
//    déclarée, introuvable ou expirée. Une certification n'est jamais « valide »
//    parce que le vendeur l'affirme : il faut un document vérifié, non expiré.
import type { DocumentFournisseur } from "@prisma/client";
import { niveauConfiance, type EtatCertification, type NiveauConfiance } from "./types";

export interface Exigence {
  code: string;
  /** Autres intitulés acceptés pour la même exigence. */
  equivalents?: string[];
  note: string;
}

const FAMILLES: { cle: string; libelle: string; motif: RegExp; exigences: Exigence[] }[] = [
  {
    cle: "batteries", libelle: "Batteries et produits à batterie",
    motif: /batter|pile|power ?bank|lithium|accu|sans fil|bluetooth|rechargeable/i,
    exigences: [
      { code: "UN38.3", note: "Essais de transport des batteries au lithium — demandé par les transporteurs aériens et maritimes." },
      { code: "MSDS", equivalents: ["SDS", "FDS"], note: "Fiche de données de sécurité — demandée par le transporteur pour les batteries." },
    ],
  },
  {
    cle: "electronique", libelle: "Électronique",
    motif: /[ée]lectron|bluetooth|[ée]couteur|casque|t[ée]l[ée]phone|chargeur|cam[ée]ra|\bled\b|usb|smart|montre connect|audio|enceinte|ordinateur|informatique|\btech/i,
    exigences: [
      { code: "CE", note: "Conformité européenne — référence courante pour l'électronique importée." },
      { code: "RoHS", note: "Limitation des substances dangereuses dans les équipements électriques." },
      { code: "FCC", note: "Exigée pour le marché américain ; hors États-Unis, simple indice de sérieux." },
    ],
  },
  {
    cle: "alimentaire", libelle: "Alimentaire",
    motif: /aliment|food|boisson|[ée]pice|\bth[ée]\b|caf[ée]|snack|nutrition|compl[ée]ment/i,
    exigences: [
      { code: "Certificat sanitaire", equivalents: ["Health certificate", "Certificat phytosanitaire"], note: "Exigences sanitaires du pays de destination — à confirmer auprès de l'autorité compétente." },
      { code: "HACCP", equivalents: ["ISO 22000", "FSSC 22000"], note: "Maîtrise de la sécurité des aliments chez le producteur." },
    ],
  },
  {
    cle: "cosmetiques", libelle: "Cosmétiques",
    motif: /cosm[ée]t|beaut[ée]|maquillage|cr[èe]me|parfum|\bsoin|savon|shampo/i,
    exigences: [
      { code: "MSDS", equivalents: ["SDS", "FDS", "CPSR"], note: "Fiche de données de sécurité / rapport de sécurité du produit." },
      { code: "GMP", equivalents: ["ISO 22716", "BPF"], note: "Bonnes pratiques de fabrication cosmétique." },
      { code: "Autorisation locale", note: "Exigences réglementaires du pays de destination — à confirmer auprès de l'autorité compétente." },
    ],
  },
  {
    cle: "jouets", libelle: "Jouets et articles pour enfants",
    motif: /jouet|\btoys?\b|enfant|b[ée]b[ée]|pu[ée]riculture/i,
    exigences: [{ code: "CE", equivalents: ["EN 71", "EN71"], note: "Sécurité des jouets (norme EN 71)." }],
  },
];

// Programmes d'évaluation de la conformité avant embarquement — simple repère,
// toujours présenté « à confirmer avec votre transitaire ».
const PROGRAMMES_PAYS: Record<string, string> = {
  CM: "PECAE (ANOR)", NG: "SONCAP (SON)", KE: "PVoC (KEBS)", CI: "VOC", GA: "PROGEC (AGANOR)",
};

/** Certifications potentiellement nécessaires pour ce produit, dans ce pays. */
export function certificationsRequises(categorie?: string | null, nomProduit?: string | null, pays?: string | null) {
  const texte = `${categorie ?? ""} ${nomProduit ?? ""}`;
  const familles = FAMILLES.filter((f) => f.motif.test(texte));
  const exigences: Exigence[] = [];
  for (const f of familles) for (const e of f.exigences) if (!exigences.some((x) => x.code === e.code)) exigences.push(e);
  const programme = pays ? PROGRAMMES_PAYS[pays.toUpperCase()] : undefined;
  return {
    familles: familles.map((f) => f.libelle),
    exigences,
    notePays: programme && exigences.length
      ? `Un certificat de conformité avant embarquement peut être exigé à l'arrivée (${programme}) — à confirmer avec votre transitaire.`
      : undefined,
  };
}

const JOUR = 86_400_000;
const norme = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

type Doc = Pick<DocumentFournisseur, "id" | "type" | "certification" | "nom" | "url" | "organismeEmetteur" | "numero" | "dateEmission" | "dateExpiration" | "statutVerification" | "sourceVerification">;

/** État d'un document à une date : confiance effective, expiration et message d'alerte. */
export function etatDocument(doc: Pick<Doc, "dateExpiration" | "statutVerification">, maintenant = new Date()) {
  const joursRestants = doc.dateExpiration ? Math.ceil((doc.dateExpiration.getTime() - maintenant.getTime()) / JOUR) : null;
  const expire = joursRestants !== null && joursRestants < 0;
  const rejete = doc.statutVerification === "rejete";
  // Expiré ou rejeté : ne compte plus comme vérifié, quoi qu'il ait été.
  const confiance: NiveauConfiance = expire || rejete ? "inconnu" : niveauConfiance(doc.statutVerification);
  const alerte = expire
    ? "Certification expirée — ne plus considérer comme vérifiée."
    : joursRestants !== null && joursRestants <= 60
      ? `Certification expire dans ${joursRestants} jour${joursRestants > 1 ? "s" : ""}.`
      : undefined;
  return { joursRestants, expire, rejete, confiance, alerte };
}

/** Une certification ne peut être contrôlée que si le document porte de quoi la retrouver. */
export const documentVerifiable = (doc: Pick<Doc, "url" | "numero" | "organismeEmetteur">) =>
  !!doc.url && !!doc.numero && !!doc.organismeEmetteur;

/**
 * Statut de chaque certification attendue chez ce fournisseur. Sans exigence
 * connue pour le produit, on liste les certificats que le fournisseur présente.
 */
export function etatCertifications(documents: Doc[], exigences: Exigence[], maintenant = new Date()): EtatCertification[] {
  const certificats = documents.filter((d) => d.certification && d.statutVerification !== "rejete");
  const attendues: Exigence[] = exigences.length
    ? exigences
    : [...new Set(certificats.map((d) => d.certification!))].map((code) => ({ code, note: "Présentée par le fournisseur." }));

  return attendues.map((e) => {
    const codes = [e.code, ...(e.equivalents ?? [])].map(norme);
    const candidats = certificats
      .filter((d) => codes.includes(norme(d.certification!)))
      .map((d) => ({ d, etat: etatDocument(d, maintenant) }));
    // Le meilleur document disponible : vérifié et valide d'abord, expiré en dernier.
    const rang = (c: (typeof candidats)[number]) => (c.etat.expire ? 3 : c.etat.confiance === "verifie" ? 0 : c.etat.confiance === "partiellement_verifie" ? 1 : 2);
    const meilleur = candidats.sort((a, b) => rang(a) - rang(b))[0];
    if (!meilleur) return { code: e.code, note: e.note, statut: "non_trouvee", source: "Aucun document fourni" };
    const { d, etat } = meilleur;
    const statut = etat.expire ? "expiree" : etat.confiance === "verifie" ? "verifiee" : "declaree";
    const source = statut === "verifiee"
      ? d.sourceVerification || "Vérification AXSO"
      : statut === "expiree"
        ? "Document expiré"
        : !d.url ? "Affirmée sans document" : documentVerifiable(d) ? "Document fourni, en attente de vérification" : "Document fourni, numéro ou organisme manquant";
    return { code: e.code, note: e.note, statut, source, documentId: d.id, alerte: etat.alerte };
  });
}
