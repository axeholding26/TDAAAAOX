// Règles pures de l'AI Course Studio et du tuteur IA : statuts, coût estimé et plafond,
// contrôle des références inventées, recherche dans les leçons autorisées.
// Sans base ni LLM : testées dans tests/academie.test.ts.

// ─── Statuts d'un élément ────────────────────────────────────────────────────

export const STATUTS = ["brouillon", "en_generation", "a_verifier", "valide", "publie", "archive"] as const;
export type Statut = (typeof STATUTS)[number];

const TRANSITIONS: Record<Statut, Statut[]> = {
  brouillon: ["en_generation", "a_verifier", "archive"],
  en_generation: ["a_verifier", "brouillon"], // brouillon = génération en échec
  a_verifier: ["valide", "en_generation", "brouillon", "archive"],
  valide: ["publie", "a_verifier", "en_generation", "archive"],
  publie: ["a_verifier", "en_generation", "archive"], // modifier une leçon publiée la repasse en vérification
  archive: ["brouillon"],
};

export const peutPasser = (de: string, vers: string) => (TRANSITIONS[de as Statut] ?? []).includes(vers as Statut);

export function transition(de: string, vers: string): Statut {
  if (!peutPasser(de, vers)) throw new Error(`Passage impossible : ${de} → ${vers}`);
  return vers as Statut;
}

// ─── Coût et plafond ─────────────────────────────────────────────────────────
// ponytail: tarifs publics « flash » de Gemini (le modèle de secours le plus cher de la chaîne),
// figés ici ; à brancher sur une grille de prix quand Axso en aura une.
export const USD_FCFA = 600;
export const TARIF_TEXTE = { entree: 0.3, sortie: 2.5 }; // USD par million de jetons
export const PLAFOND_DEFAUT = 2000; // FCFA par mois et par boutique, réglable par le marchand
export const PLAFOND_MAX = 200_000;
export const MAX_SOURCES = 40_000; // caractères de sources envoyés au modèle

/** Jetons d'un texte (≈ 4 caractères par jeton). */
export const jetons = (texte: string) => Math.ceil(texte.length / 4);

export const coutTexte = (entree: number, sortie: number) =>
  Math.round(((entree * TARIF_TEXTE.entree + sortie * TARIF_TEXTE.sortie) / 1e6) * USD_FCFA * 100) / 100;

/** Jetons prévus par type de tâche (sortie = plafond max_tokens demandé au modèle). */
export const GABARITS: Record<string, { entree: number; sortie: number }> = {
  studio_curriculum: { entree: 2500, sortie: 4000 },
  studio_lecon: { entree: 3000, sortie: 6000 },
  studio_vente: { entree: 2500, sortie: 4000 },
  tuteur: { entree: 3000, sortie: 700 },
};

/** Coût estimé AVANT lancement ; `sourceCaracteres` = texte fourni par le marchand ajouté au prompt. */
export function estimer(type: string, nombre = 1, sourceCaracteres = 0): number {
  const g = GABARITS[type];
  if (!g) throw new Error(`Tâche inconnue : ${type}`);
  return Math.round(coutTexte(g.entree + Math.ceil(Math.min(sourceCaracteres, MAX_SOURCES) / 4), g.sortie) * nombre * 100) / 100;
}

export function verifierBudget(p: { depense: number; estime: number; plafond: number | null | undefined }) {
  const plafond = p.plafond ?? PLAFOND_DEFAUT;
  const reste = Math.max(0, Math.round((plafond - p.depense) * 100) / 100);
  const ok = p.depense + p.estime <= plafond;
  return {
    ok, plafond, reste,
    message: ok ? null : `Plafond IA du mois atteint : ${reste} FCFA restants pour ${p.estime} FCFA estimés. Augmente le plafond ou attends le mois prochain.`,
  };
}

export const periodeCourante = (d = new Date()) => d.toISOString().slice(0, 7);

/** Délai avant la prochaine tentative d'une tâche en échec : 1, 2, 4 min… plafonné à 30 min. */
export const delaiReprise = (tentatives: number) => Math.min(30, 2 ** Math.max(0, tentatives - 1)) * 60_000;

// ─── Contrôle qualité : références et certifications inventées ──────────────
// Le prompt interdit d'en inventer ; ce contrôle signale ce qui y ressemble quand le marchand
// ne l'a pas fourni dans ses sources. Il signale, il ne juge pas : le marchand tranche.

export interface Alerte { type: "reference" | "certification" | "statistique" | "lien" | "source_manquante"; extrait: string; raison: string }

export const MARQUE_SOURCE = "[SOURCE À FOURNIR]";

const MOTIFS: { type: Alerte["type"]; re: RegExp; raison: string }[] = [
  { type: "lien", re: /\bhttps?:\/\/[^\s)"'<]+|\bwww\.[a-z0-9-]+\.[a-z]{2,}[^\s)"'<]*/gi, raison: "Lien non fourni par le formateur : vérifie qu'il existe." },
  { type: "reference", re: /\bdoi:\s*10\.\d{4,}\/\S+|\b10\.\d{4,9}\/[-._;()/:a-z0-9]+|\bISBN[-: ]*[\d-]{10,17}/gi, raison: "Référence bibliographique non fournie : peut être inventée." },
  { type: "reference", re: /\(([A-ZÉ][\p{L}'-]+(?: et al\.?| (?:et|&) [A-ZÉ][\p{L}'-]+)?),? (?:19|20)\d{2}\)/gu, raison: "Citation d'auteur non fournie : peut être inventée." },
  { type: "reference", re: /\b(?:selon|d'après) (?:une|l'|la|le|les|des)? ?(?:étude|enquête|rapport|recherche|sondage|chercheurs?)[^.;\n]{0,80}/gi, raison: "Étude citée sans source fournie." },
  { type: "reference", re: /\b(?:université|university|institut|institute) (?:de |d'|of )?[A-ZÉ][\p{L}-]+|\b(?:Harvard|Stanford|MIT|Oxford|Cambridge|OMS|WHO|UNESCO|OCDE|OECD|McKinsey|Gartner|Forbes)\b/gu, raison: "Institution citée : vérifie que l'affirmation vient bien d'elle." },
  { type: "certification", re: /\b(?:certifi(?:é|ée|ant|cation)|accrédit(?:é|ée|ation)|diplôm(?:e|ant)|agréé(?:e)? par|reconnu(?:e)? par l'État|homologué(?:e)?|label(?:lisé)?|norme ISO|ISO \d{3,5}|RNCP|Qualiopi|CPF|crédits ECTS)\b[^.;\n]{0,60}/gi, raison: "Certification ou reconnaissance officielle : n'en promets aucune que la formation n'a pas." },
  { type: "statistique", re: /\b\d{1,3}(?:[.,]\d+)? ?(?:%|pour ?cent) (?:des|de la|du|de) [^.;\n]{0,60}/gi, raison: "Chiffre précis sans source fournie : vérifie-le ou retire-le." },
];

/** Texte plat de n'importe quel contenu (objet JSON de leçon, HTML…). */
export function texteDe(x: unknown): string {
  if (x == null) return "";
  if (typeof x === "string") return x.replace(/<[^>]+>/g, " ");
  if (Array.isArray(x)) return x.map(texteDe).join("\n");
  if (typeof x === "object") return Object.values(x as Record<string, unknown>).map(texteDe).join("\n");
  return String(x);
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Alertes du contrôle qualité ; un passage présent tel quel dans les sources du marchand n'est pas signalé. */
export function controlerReferences(contenu: unknown, sources = ""): Alerte[] {
  const texte = texteDe(contenu);
  const src = norm(sources);
  const vues = new Set<string>();
  const alertes: Alerte[] = [];
  for (const m of MOTIFS) {
    for (const r of texte.matchAll(m.re)) {
      const extrait = r[0].trim().slice(0, 140);
      const cle = norm(extrait);
      if (vues.has(cle) || (src && src.includes(cle))) continue;
      vues.add(cle);
      alertes.push({ type: m.type, extrait, raison: m.raison });
    }
  }
  if (texte.includes(MARQUE_SOURCE)) alertes.push({ type: "source_manquante", extrait: MARQUE_SOURCE, raison: "L'IA a besoin d'une source que toi seul peux fournir." });
  return alertes;
}

/** Consigne commune à tous les prompts de génération. */
export const CONSIGNE_VERITE = `INTERDITS ABSOLUS :
- N'invente AUCUNE référence : ni étude, ni auteur, ni livre, ni lien, ni DOI, ni statistique chiffrée, ni citation, ni témoignage, ni partenaire.
- N'invente AUCUNE certification, accréditation, diplôme, label, reconnaissance officielle ou garantie de résultat (revenus, emploi…).
- Si une affirmation a besoin d'une source que tu n'as pas dans les SOURCES du formateur, écris ${MARQUE_SOURCE} à la place.
- Tu peux t'appuyer sur des connaissances générales largement admises, formulées sans chiffre ni nom propre inventé.`;

// ─── Tuteur : leçons autorisées et recherche ─────────────────────────────────

export interface LeconTuteur { id: string; titre: string; chapitre: string; type: string; contenu: string | null }
export interface Passage { leconId: string; titre: string; chapitre: string; texte: string }

/**
 * Seules les leçons que l'apprenant peut ouvrir entrent dans le contexte : visibles (publiées, actives),
 * débloquées, et jamais un quiz (ses réponses ne doivent pas fuiter). `ouvertes` vient du serveur.
 */
export function leconsAutorisees<T extends LeconTuteur>(lecons: T[], ouvertes: Set<string>): T[] {
  return lecons.filter((l) => ouvertes.has(l.id) && l.type !== "quiz");
}

const VIDES = new Set("le la les un une des de du d l et ou a au aux en dans pour par sur avec que qui quoi est sont ce cette ces mon ma mes ton ta tes son sa ses je tu il elle on nous vous ils elles ne pas plus comment pourquoi quel quelle quels quelles faire fait peut peux".split(" "));
const mots = (s: string) => norm(s).replace(/[^a-z0-9 ]/g, " ").split(" ").filter((m) => m.length > 2 && !VIDES.has(m));

/** Découpe les leçons en passages d'environ 700 caractères (par paragraphes). */
export function decouper(lecons: LeconTuteur[], taille = 700): Passage[] {
  const passages: Passage[] = [];
  for (const l of lecons) {
    const texte = texteDe(l.contenu ?? "").replace(/&nbsp;/g, " ").replace(/[ \t]+/g, " ");
    let bloc = "";
    for (const para of texte.split(/\n+/).map((p) => p.trim()).filter(Boolean)) {
      if (bloc && bloc.length + para.length > taille) { passages.push({ leconId: l.id, titre: l.titre, chapitre: l.chapitre, texte: bloc }); bloc = ""; }
      bloc = bloc ? `${bloc}\n${para}` : para;
    }
    if (bloc) passages.push({ leconId: l.id, titre: l.titre, chapitre: l.chapitre, texte: bloc });
  }
  return passages;
}

/** Passages les plus proches de la question (mots communs, bonus au titre ; leçon courante favorisée). */
export function rechercher(question: string, passages: Passage[], k = 4, leconCourante?: string): Passage[] {
  const q = new Set(mots(question));
  return passages
    .map((p) => {
      const corps = mots(p.texte);
      const titre = new Set(mots(p.titre));
      let score = 0;
      for (const m of q) {
        if (corps.includes(m)) score += 1;
        if (titre.has(m)) score += 2;
      }
      if (score && p.leconId === leconCourante) score += 1;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((x) => x.p);
}

// ─── Étape du studio, déduite des éléments ───────────────────────────────────
// 1 curriculum à générer · 2 curriculum à valider · 3 leçons à rédiger · 4 contrôle qualité
// (toutes rédigées, à vérifier) · 5 aperçu (tout validé) · 6 publiée.
export function etapeCourante(elements: { type: string; statut: string }[], publie = false): number {
  const actifs = elements.filter((e) => e.statut !== "archive");
  const cur = actifs.filter((e) => e.type === "positionnement" || e.type === "module");
  const lecons = actifs.filter((e) => e.type === "lecon");
  if (!cur.length) return 1;
  if (cur.some((e) => e.statut === "a_verifier" || e.statut === "brouillon")) return 2;
  if (lecons.some((e) => e.statut === "brouillon" || e.statut === "en_generation")) return 3;
  if (lecons.some((e) => e.statut === "a_verifier")) return 4;
  return publie && lecons.every((e) => e.statut === "publie") ? 6 : 5;
}
