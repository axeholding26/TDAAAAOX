// Import / export de la caisse : colonnes des fichiers et validation des
// lignes. Fonctions pures (aucun accès base) : la validation reçoit en
// `Reference` ce que la boutique contient déjà.
//
// Cinq fichiers : produits (fiches), prix, stock, clients, fournisseurs.
// Chaque ligne valide dit si elle CRÉE ou MODIFIE (`cible` = identifiant
// existant), ce qui rend un réimport sans danger : la même ligne retrouve la
// même fiche au lieu d'en créer une seconde.
import { slugify } from "../../utils";

export const ENTITES = ["produits", "prix", "stock", "clients", "fournisseurs"] as const;
export type Entite = (typeof ENTITES)[number];

type Colonne = { titre: string; requis?: boolean; aide?: string; exemple: string | number; /** Autres en-têtes acceptés. */ alias?: string[] };

export const DEFINITIONS: Record<Entite, { libelle: string; description: string; colonnes: Colonne[] }> = {
  produits: {
    libelle: "Produits",
    description: "Crée les fiches produit ou met à jour celles qui existent. Un produit est reconnu par son SKU ou son code-barres ; sans l'un ni l'autre, par son nom exact. Le stock s'importe à part, avec le fichier Stock.",
    colonnes: [
      { titre: "Nom", requis: true, exemple: "Riz parfumé 5 kg" },
      { titre: "Prix", requis: true, aide: "Prix de vente. Au kilo pour un produit au poids.", exemple: 4500, alias: ["prix de vente"] },
      { titre: "Prix d'achat", exemple: 3600, alias: ["cout", "coût"] },
      { titre: "Catégorie", exemple: "Épicerie" },
      { titre: "Marque", exemple: "Royal" },
      { titre: "SKU", exemple: "RIZ-5KG", alias: ["reference", "référence"] },
      { titre: "Code-barres", aide: "Mettez la colonne au format Texte pour garder les zéros de tête.", exemple: "6111234567890", alias: ["ean", "code barres"] },
      { titre: "Unité", aide: "« piece » ou « kg » (vendu au poids).", exemple: "piece", alias: ["unite de vente"] },
      { titre: "TVA (%)", aide: "Vide = taux de la boutique.", exemple: "", alias: ["tva"] },
      { titre: "Description", exemple: "" },
      { titre: "Actif", aide: "« oui » ou « non ».", exemple: "oui" },
    ],
  },
  prix: {
    libelle: "Prix",
    description: "Met à jour le prix de vente et le prix d'achat d'articles existants (produits ou variantes), retrouvés par leur SKU ou leur code-barres. Ne crée rien.",
    colonnes: [
      { titre: "SKU", exemple: "RIZ-5KG", alias: ["reference", "référence"] },
      { titre: "Code-barres", exemple: "", alias: ["ean", "code barres"] },
      { titre: "Nom", aide: "Pour vous repérer : ignoré à l'import.", exemple: "Riz parfumé 5 kg" },
      { titre: "Prix", exemple: 4700, alias: ["prix de vente"] },
      { titre: "Prix d'achat", exemple: 3650, alias: ["cout", "coût"] },
    ],
  },
  stock: {
    libelle: "Stock",
    description: "Fixe la quantité réellement présente de chaque article dans un entrepôt. Chaque écart avec le stock connu est écrit au journal comme un mouvement d'inventaire.",
    colonnes: [
      { titre: "SKU", exemple: "RIZ-5KG", alias: ["reference", "référence"] },
      { titre: "Code-barres", exemple: "", alias: ["ean", "code barres"] },
      { titre: "Nom", aide: "Pour vous repérer : ignoré à l'import.", exemple: "Riz parfumé 5 kg" },
      { titre: "Variante", aide: "Pour vous repérer : ignoré à l'import.", exemple: "" },
      { titre: "Quantité", requis: true, aide: "Quantité présente (nombre entier). En grammes pour un produit au poids.", exemple: 48, alias: ["stock", "quantite comptee"] },
      { titre: "Entrepôt", aide: "Nom exact de l'entrepôt. Obligatoire si la boutique en a plusieurs.", exemple: "", alias: ["magasin"] },
    ],
  },
  clients: {
    libelle: "Clients",
    description: "Crée les clients ou met à jour ceux qui existent. Un client est reconnu par son e-mail, sinon son téléphone, sinon son code client.",
    colonnes: [
      { titre: "Nom", requis: true, exemple: "Awa Diallo" },
      { titre: "Téléphone", exemple: "+237 6 99 00 11 22", alias: ["tel", "telephone portable"] },
      { titre: "E-mail", exemple: "", alias: ["email", "mail"] },
      { titre: "Adresse", exemple: "" },
      { titre: "Ville", exemple: "Douala" },
      { titre: "Code client", aide: "Numéro de la carte client, s'il y en a une.", exemple: "" },
    ],
  },
  fournisseurs: {
    libelle: "Fournisseurs",
    description: "Crée les fournisseurs ou met à jour ceux qui existent. Un fournisseur est reconnu par son nom.",
    colonnes: [
      { titre: "Nom", requis: true, exemple: "Grossiste Mboppi" },
      { titre: "Pays", exemple: "Cameroun" },
      { titre: "Téléphone", exemple: "+237 6 77 00 11 22", alias: ["tel"] },
      { titre: "E-mail", exemple: "", alias: ["email", "mail"] },
      { titre: "Délai de livraison (jours)", exemple: 2, alias: ["delai", "delai de livraison"] },
      { titre: "Notes", exemple: "" },
    ],
  },
};

export const estEntite = (v: unknown): v is Entite => (ENTITES as readonly string[]).includes(v as string);
/** En-tête comparé sans accents, casse ni ponctuation : « PRIX D'ACHAT », « prix d achat »… passent. */
export const cleColonne = (titre: unknown) => slugify(String(titre ?? ""));
export const entetes = (entite: Entite) => DEFINITIONS[entite].colonnes.map((c) => c.titre);

/** Ce que la boutique contient déjà, pour reconnaître les fiches et repérer les conflits. */
export type Reference = {
  /** SKU ou code-barres (en minuscules) → article. */
  codes: Map<string, { produitId: string; varianteId: string | null; aVariantes: boolean; physique: boolean }>;
  /** Codes portés par plusieurs articles : inutilisables pour désigner une ligne. */
  ambigus: Set<string>;
  /** Nom normalisé → produit. */
  nomsProduits: Map<string, string>;
  /** Nom normalisé → entrepôt actif. */
  entrepots: Map<string, string>;
  /** « email:… », « tel:… », « code:… » → client. */
  clients: Map<string, string>;
  /** Nom normalisé → fournisseur. */
  fournisseurs: Map<string, string>;
};
export const referenceVide = (): Reference => ({ codes: new Map(), ambigus: new Set(), nomsProduits: new Map(), entrepots: new Map(), clients: new Map(), fournisseurs: new Map() });

export type ErreurLigne = { ligne: number; colonne: string; message: string };
export type LigneValide = {
  /** Numéro de la ligne dans le fichier (la ligne 1 porte les en-têtes). */
  ligne: number;
  /** Fiche existante à modifier ; null = création. */
  cible: string | null;
  varianteId?: string | null;
  entrepotId?: string | null;
  /** Champs à écrire : seules les cellules remplies y figurent. */
  donnees: Record<string, string | number | boolean>;
};
export type Validation = { total: number; valides: LigneValide[]; erreurs: ErreurLigne[] };

const texte = (v: unknown) => (v == null || String(v).trim() === "" ? undefined : String(v).trim());
/** « 12 500 », « 12500,50 », 12500 → nombre ; vide → undefined ; illisible → NaN. */
const nombre = (v: unknown) => {
  if (v === "" || v == null) return undefined;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[\s  ]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
export const normaliserNom = (s: string) => slugify(s);
export const cleTelephone = (s: string) => s.replace(/\D/g, "");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

class Refus extends Error { constructor(public colonne: string, message: string) { super(message); } }

/**
 * Colonnes obligatoires absentes du fichier (titres) : le fichier n'est alors
 * pas celui de cette entité, inutile de valider ligne à ligne.
 */
export function colonnesManquantes(entite: Entite, clesPresentes: string[]): string[] {
  const presentes = new Set(clesPresentes);
  const def = DEFINITIONS[entite];
  const a = (c: Colonne) => [c.titre, ...(c.alias ?? [])].some((t) => presentes.has(cleColonne(t)));
  const manquantes = def.colonnes.filter((c) => c.requis && !a(c)).map((c) => c.titre);
  if ((entite === "prix" || entite === "stock") && !def.colonnes.filter((c) => c.titre === "SKU" || c.titre === "Code-barres").some(a)) manquantes.push("SKU ou Code-barres");
  return manquantes;
}

/**
 * Valide les lignes d'un fichier (clés = en-têtes passés par cleColonne) sans
 * rien écrire. Une ligne entièrement vide est ignorée ; une ligne en erreur
 * porte UNE erreur (la première), pour que « 28 erreurs » = 28 lignes à corriger.
 */
export function validerLignes(entite: Entite, lignes: Record<string, unknown>[], ref: Reference): Validation {
  const def = DEFINITIONS[entite];
  const lire = (l: Record<string, unknown>, titre: string) => {
    const c = def.colonnes.find((x) => x.titre === titre)!;
    for (const t of [c.titre, ...(c.alias ?? [])]) { const v = l[cleColonne(t)]; if (v != null && String(v).trim() !== "") return v; }
    return undefined;
  };
  const valides: LigneValide[] = [];
  const erreurs: ErreurLigne[] = [];
  const vus = new Map<string, number>();
  let total = 0;

  /** Refuse une clé déjà rencontrée plus haut dans le fichier. */
  const unique = (cle: string, colonne: string, quoi: string, ligne: number) => {
    const deja = vus.get(cle);
    if (deja) throw new Refus(colonne, `${quoi} figure déjà à la ligne ${deja} du fichier.`);
    vus.set(cle, ligne);
  };
  const montant = (l: Record<string, unknown>, titre: string, o: { requis?: boolean; strict?: boolean } = {}) => {
    const n = nombre(lire(l, titre));
    if (n === undefined) { if (o.requis) throw new Refus(titre, `« ${titre} » est obligatoire.`); return undefined; }
    if (Number.isNaN(n) || n < 0 || (o.strict && n === 0)) throw new Refus(titre, `« ${titre} » doit être un nombre ${o.strict ? "supérieur à zéro" : "positif"}.`);
    return n;
  };
  const email = (l: Record<string, unknown>) => {
    const e = texte(lire(l, "E-mail"))?.toLowerCase();
    if (e && !EMAIL.test(e)) throw new Refus("E-mail", "Cette adresse e-mail n'est pas valide.");
    return e;
  };
  /** Article désigné par le SKU ou le code-barres de la ligne. */
  const article = (l: Record<string, unknown>) => {
    const sku = texte(lire(l, "SKU")), cb = texte(lire(l, "Code-barres"));
    if (!sku && !cb) throw new Refus("SKU", "Indiquez le SKU ou le code-barres de l'article.");
    const trouves = [sku, cb].flatMap((code) => {
      if (!code) return [];
      if (ref.ambigus.has(code.toLowerCase())) throw new Refus(code === sku ? "SKU" : "Code-barres", `Le code « ${code} » désigne plusieurs articles de la boutique : corrigez les fiches avant d'importer.`);
      const a = ref.codes.get(code.toLowerCase());
      return a ? [a] : [];
    });
    if (!trouves.length) throw new Refus(sku ? "SKU" : "Code-barres", `Aucun article de la boutique ne porte le code « ${sku ?? cb} ».`);
    if (trouves.length === 2 && (trouves[0].produitId !== trouves[1].produitId || trouves[0].varianteId !== trouves[1].varianteId)) {
      throw new Refus("Code-barres", "Le SKU et le code-barres de cette ligne désignent deux articles différents.");
    }
    // Le code le plus précis l'emporte (celui d'une variante).
    return trouves.find((a) => a.varianteId) ?? trouves[0];
  };

  lignes.forEach((l, i) => {
    if (Object.values(l).every((v) => v == null || String(v).trim() === "")) return;
    total++;
    const ligne = i + 2;
    try {
      const donnees: LigneValide["donnees"] = {};
      const poser = (champ: string, v: string | number | boolean | undefined) => { if (v !== undefined) donnees[champ] = v; };

      if (entite === "produits") {
        const nom = texte(lire(l, "Nom"));
        if (!nom) throw new Refus("Nom", "Le nom du produit est obligatoire.");
        if (nom.length > 200) throw new Refus("Nom", "Le nom du produit dépasse 200 caractères.");
        const sku = texte(lire(l, "SKU")), codeBarres = texte(lire(l, "Code-barres"));
        const cibles = [["SKU", sku], ["Code-barres", codeBarres]].flatMap(([colonne, code]) => {
          if (!code) return [];
          if (ref.ambigus.has(code.toLowerCase())) throw new Refus(colonne!, `Le code « ${code} » désigne plusieurs articles de la boutique : corrigez les fiches avant d'importer.`);
          const a = ref.codes.get(code.toLowerCase());
          if (a?.varianteId) throw new Refus(colonne!, `Le code « ${code} » est celui d'une variante : ce fichier ne modifie que des produits.`);
          unique(`code:${code.toLowerCase()}`, colonne!, `Le code « ${code} »`, ligne);
          return a ? [a.produitId] : [];
        });
        if (new Set(cibles).size > 1) throw new Refus("Code-barres", "Le SKU et le code-barres de cette ligne appartiennent à deux produits différents.");
        if (!sku && !codeBarres) unique(`nom:${normaliserNom(nom)}`, "Nom", `Le produit « ${nom} » (sans SKU ni code-barres)`, ligne);
        const unite = texte(lire(l, "Unité"))?.toLowerCase();
        if (unite && !/^(pi[eè]ces?|unit[eé]s?|kg|kilos?|poids)$/.test(unite)) throw new Refus("Unité", "L'unité doit être « piece » ou « kg ».");
        const tva = montant(l, "TVA (%)");
        if (tva !== undefined && tva > 100) throw new Refus("TVA (%)", "La TVA est un pourcentage entre 0 et 100.");
        const actif = texte(lire(l, "Actif"))?.toLowerCase();
        poser("nom", nom);
        poser("prix", montant(l, "Prix", { requis: true, strict: true }));
        poser("cout", montant(l, "Prix d'achat"));
        poser("categorie", texte(lire(l, "Catégorie")));
        poser("marque", texte(lire(l, "Marque")));
        poser("sku", sku);
        poser("codeBarres", codeBarres);
        poser("uniteVente", unite ? (/^(kg|kilos?|poids)$/.test(unite) ? "kg" : "piece") : undefined);
        poser("tauxTVA", tva === undefined ? undefined : tva / 100);
        poser("description", texte(lire(l, "Description")));
        poser("actif", actif ? !["non", "no", "0", "false", "faux"].includes(actif) : undefined);
        valides.push({ ligne, cible: cibles[0] ?? (!sku && !codeBarres ? ref.nomsProduits.get(normaliserNom(nom)) ?? null : null), donnees });
      } else if (entite === "prix") {
        const a = article(l);
        poser("prix", montant(l, "Prix", { strict: true }));
        poser("cout", montant(l, "Prix d'achat"));
        if (!Object.keys(donnees).length) throw new Refus("Prix", "Indiquez un prix de vente ou un prix d'achat.");
        unique(`article:${a.produitId}:${a.varianteId ?? ""}`, "SKU", "Cet article", ligne);
        valides.push({ ligne, cible: a.produitId, varianteId: a.varianteId, donnees });
      } else if (entite === "stock") {
        const a = article(l);
        if (!a.physique) throw new Refus("SKU", "Cet article n'a pas de stock suivi (produit digital ou dropshipping).");
        if (a.aVariantes && !a.varianteId) throw new Refus("SKU", "Ce produit existe en plusieurs variantes : indiquez le SKU ou le code-barres de la variante comptée.");
        const quantite = montant(l, "Quantité", { requis: true })!;
        if (!Number.isInteger(quantite)) throw new Refus("Quantité", "La quantité doit être un nombre entier (en grammes pour un produit au poids).");
        const entrepot = texte(lire(l, "Entrepôt"));
        const entrepotId = entrepot ? ref.entrepots.get(normaliserNom(entrepot)) : null;
        if (entrepot && !entrepotId) throw new Refus("Entrepôt", `Aucun entrepôt actif ne s'appelle « ${entrepot} ».`);
        if (!entrepot && ref.entrepots.size > 1) throw new Refus("Entrepôt", "La boutique a plusieurs entrepôts : indiquez celui de cette quantité.");
        unique(`stock:${a.produitId}:${a.varianteId ?? ""}:${entrepotId ?? ""}`, "SKU", "Cet article (même entrepôt)", ligne);
        valides.push({ ligne, cible: a.produitId, varianteId: a.varianteId, entrepotId: entrepotId ?? null, donnees: { quantite } });
      } else if (entite === "clients") {
        const nom = texte(lire(l, "Nom"));
        if (!nom) throw new Refus("Nom", "Le nom du client est obligatoire.");
        const mail = email(l), telephone = texte(lire(l, "Téléphone")), codeClient = texte(lire(l, "Code client"));
        const tel = telephone ? cleTelephone(telephone) : "";
        if (telephone && tel.length < 6) throw new Refus("Téléphone", "Ce numéro de téléphone est trop court.");
        const cles = [mail && `email:${mail}`, tel && `tel:${tel}`, codeClient && `code:${codeClient.toLowerCase()}`].filter((c): c is string => !!c);
        if (!cles.length) throw new Refus("Téléphone", "Indiquez un téléphone, un e-mail ou un code client : sans cela, le client ne pourrait pas être reconnu.");
        cles.forEach((c) => unique(c, c.startsWith("email") ? "E-mail" : c.startsWith("tel") ? "Téléphone" : "Code client", "Ce client", ligne));
        const cibles = [...new Set(cles.flatMap((c) => ref.clients.get(c) ?? []))];
        if (cibles.length > 1) throw new Refus("Téléphone", "L'e-mail, le téléphone et le code de cette ligne appartiennent à des clients différents.");
        poser("nom", nom); poser("email", mail); poser("telephone", telephone); poser("codeClient", codeClient);
        poser("adresse", texte(lire(l, "Adresse"))); poser("ville", texte(lire(l, "Ville")));
        valides.push({ ligne, cible: cibles[0] ?? null, donnees });
      } else {
        const nom = texte(lire(l, "Nom"));
        if (!nom) throw new Refus("Nom", "Le nom du fournisseur est obligatoire.");
        unique(`fournisseur:${normaliserNom(nom)}`, "Nom", `Le fournisseur « ${nom} »`, ligne);
        const delai = montant(l, "Délai de livraison (jours)");
        if (delai !== undefined && (!Number.isInteger(delai) || delai > 365)) throw new Refus("Délai de livraison (jours)", "Le délai est un nombre entier de jours (365 au plus).");
        poser("nom", nom); poser("pays", texte(lire(l, "Pays"))); poser("telephone", texte(lire(l, "Téléphone")));
        poser("email", email(l)); poser("delaiLivraison", delai); poser("notes", texte(lire(l, "Notes")));
        valides.push({ ligne, cible: ref.fournisseurs.get(normaliserNom(nom)) ?? null, donnees });
      }
    } catch (e) {
      if (!(e instanceof Refus)) throw e;
      erreurs.push({ ligne, colonne: e.colonne, message: e.message });
    }
  });
  return { total, valides, erreurs };
}
