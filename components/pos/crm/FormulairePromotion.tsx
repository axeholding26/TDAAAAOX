"use client";
// Création / modification guidée d'une promotion : choix du type, règle propre
// au type, conditions (articles, catégories, clients, panier), période,
// magasins, cumul — et APERÇU sur un panier d'exemple, calculé dans le
// navigateur par le vrai moteur (calculerPanier + expliquerPromotions, les
// fonctions mêmes qu'utilise le serveur à la vente).
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, FOCUS, Modale, Saisie } from "@/components/pos/ui";
import { cn } from "@/lib/utils";
import { AUCUN_DROIT } from "@/lib/pos/droits";
import { calculerPanier, decimalesDevise } from "@/lib/pos/tarification";
import { TYPES_PROMOTION, expliquerPromotions, type PromotionActive, type TypePromotion } from "@/lib/pos/promotions";
import { SEGMENTS, type Segment } from "@/lib/pos/promotions/segments";
import { appelPos } from "./appel";
import { LIBELLES_NIVEAU, LIBELLES_SEGMENT, NIVEAUX, TYPES_PROMO, resumePromotion } from "./libelles";
import { SelecteurArticles, type ArticleChoisi } from "./SelecteurArticles";

export type PromotionLue = {
  id: string; nom: string; type: string; valeur: number | null; regles: Record<string, any>;
  cumulable: boolean; priorite: number; dateDebut: string | null; dateFin: string | null;
  magasinIds: string[]; codePromoId: string | null; actif: boolean; utilisations: number;
  etat: "active" | "inactive" | "a_venir" | "terminee"; createdAt: string;
};

type Palier = { minQuantite: string; prix: string; pct: string };
type Brouillon = {
  nom: string; type: TypePromotion | null; valeur: string; cumulable: boolean; priorite: string;
  dateDebut: string; dateFin: string; magasinIds: string[]; codePromoId: string;
  articles: ArticleChoisi[]; categories: string[]; segments: Segment[]; minPanier: string;
  par: "unite" | "panier"; mode: "pourcentage" | "montant"; x: string; y: string; memeArticle: boolean;
  composants: ArticleChoisi[]; acheter: ArticleChoisi[]; acheterQte: string; obtenir: ArticleChoisi[]; obtenirQte: string;
  quantite: string; declencheur: ArticleChoisi[]; declencheurQte: string;
  niveaux: Record<string, string>; paliers: Palier[]; grossisteTous: boolean;
};

const VIDE: Brouillon = {
  nom: "", type: null, valeur: "", cumulable: false, priorite: "0", dateDebut: "", dateFin: "", magasinIds: [], codePromoId: "",
  articles: [], categories: [], segments: [], minPanier: "", par: "unite", mode: "pourcentage", x: "3", y: "2", memeArticle: false,
  composants: [], acheter: [], acheterQte: "2", obtenir: [], obtenirQte: "1", quantite: "1", declencheur: [], declencheurQte: "1",
  niveaux: { bronze: "", silver: "", gold: "", vip: "" }, paliers: [{ minQuantite: "", prix: "", pct: "" }], grossisteTous: false,
};

const nb = (s: string): number | undefined => (s.trim() === "" || !Number.isFinite(Number(s)) ? undefined : Number(s));
const jour = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-CA") : "");
const ids = (a: ArticleChoisi[]) => a.map((x) => x.produitId);
/** Articles rebâtis depuis des identifiants enregistrés : seul le nom est connu. */
const articlesDe = (liste: unknown, libelles: Record<string, string> = {}, quantites?: Record<string, number>): ArticleChoisi[] =>
  (Array.isArray(liste) ? liste : []).map((id: string) => ({ produitId: id, nom: libelles[id] ?? "Article", prix: 0, uniteVente: "piece", categorie: null, tauxTVA: null, quantite: quantites?.[id] ?? 1 }));

function depuisPromotion(p: PromotionLue): Brouillon {
  const r = p.regles ?? {}, l = r.libelles ?? {};
  const composants: { produitId: string; quantite: number }[] = Array.isArray(r.composants) ? r.composants : [];
  return {
    ...VIDE, nom: p.nom, type: (TYPES_PROMOTION as readonly string[]).includes(p.type) ? (p.type as TypePromotion) : null,
    valeur: p.valeur === null ? "" : String(p.valeur), cumulable: p.cumulable, priorite: String(p.priorite),
    dateDebut: jour(p.dateDebut), dateFin: jour(p.dateFin), magasinIds: p.magasinIds, codePromoId: p.codePromoId ?? "",
    articles: articlesDe(r.produitIds, l), categories: r.categories ?? [], segments: r.segments ?? [], minPanier: r.minPanier ? String(r.minPanier) : "",
    par: r.par === "panier" ? "panier" : "unite", mode: r.mode === "montant" ? "montant" : "pourcentage",
    x: String(r.x ?? 3), y: String(r.y ?? 2), memeArticle: r.memeArticle === true,
    composants: articlesDe(composants.map((c) => c.produitId), l, Object.fromEntries(composants.map((c) => [c.produitId, c.quantite]))),
    acheter: articlesDe(r.acheter?.produitIds, l), acheterQte: String(r.acheter?.quantite ?? 2),
    obtenir: articlesDe(r.obtenir?.produitIds, l), obtenirQte: String(r.obtenir?.quantite ?? 1),
    quantite: String(r.quantite ?? 1), declencheur: articlesDe(r.declencheur?.produitIds, l), declencheurQte: String(r.declencheur?.quantite ?? 1),
    niveaux: Object.fromEntries(NIVEAUX.map((n) => [n, r.niveaux?.[n] ? String(r.niveaux[n]) : ""])),
    paliers: Array.isArray(r.paliers) && r.paliers.length ? r.paliers.map((x: any) => ({ minQuantite: String(x.minQuantite ?? ""), prix: x.prix === undefined ? "" : String(x.prix), pct: x.pct ? String(x.pct) : "" })) : VIDE.paliers,
    grossisteTous: p.type === "prix_grossiste" && Array.isArray(r.segments) && r.segments.length === 0,
  };
}

/** Du formulaire au corps attendu par l'API (schemaPromotion). Seules les règles du type choisi sont envoyées. */
function versDonnees(b: Brouillon) {
  const type = b.type!;
  const cites = [...b.articles, ...b.composants, ...b.acheter, ...b.obtenir, ...b.declencheur];
  const regles: Record<string, unknown> = {};
  const cible = type !== "lot" && type !== "achete_x_obtiens_y";
  if (cible && b.articles.length) regles.produitIds = ids(b.articles);
  if (cible && b.categories.length) regles.categories = b.categories;
  if (b.segments.length) regles.segments = b.segments;
  if (nb(b.minPanier)) regles.minPanier = nb(b.minPanier);
  let valeur: number | null = nb(b.valeur) ?? null;
  switch (type) {
    case "montant_fixe": regles.par = b.par; break;
    case "seuil_panier": regles.mode = b.mode; break;
    case "x_pour_y": regles.x = nb(b.x); regles.y = nb(b.y); regles.memeArticle = b.memeArticle; valeur = null; break;
    case "lot": regles.composants = b.composants.map((c) => ({ produitId: c.produitId, quantite: c.quantite })); break;
    case "achete_x_obtiens_y":
      regles.acheter = { produitIds: ids(b.acheter), quantite: nb(b.acheterQte) };
      if (b.obtenir.length) regles.obtenir = { produitIds: ids(b.obtenir), quantite: nb(b.obtenirQte) };
      break;
    case "produit_offert":
      regles.quantite = nb(b.quantite) ?? 1; valeur = null;
      if (b.declencheur.length) regles.declencheur = { produitIds: ids(b.declencheur), quantite: nb(b.declencheurQte) ?? 1 };
      break;
    case "prix_membre": regles.niveaux = Object.fromEntries(NIVEAUX.flatMap((n) => (nb(b.niveaux[n]) ? [[n, nb(b.niveaux[n])]] : []))); valeur = null; break;
    case "prix_grossiste":
      regles.paliers = b.paliers.filter((x) => nb(x.minQuantite)).map((x) => ({ minQuantite: nb(x.minQuantite), ...(nb(x.prix) !== undefined ? { prix: nb(x.prix) } : { pct: nb(x.pct) }) }));
      if (b.grossisteTous && !b.segments.length) regles.segments = [];
      valeur = null;
      break;
  }
  if (cites.length) regles.libelles = Object.fromEntries(cites.map((a) => [a.produitId, a.nom]));
  return {
    nom: b.nom.trim(), type, valeur, regles, cumulable: b.cumulable, priorite: Math.round(nb(b.priorite) ?? 0),
    dateDebut: b.dateDebut ? new Date(`${b.dateDebut}T00:00:00`).toISOString() : null,
    dateFin: b.dateFin ? new Date(`${b.dateFin}T23:59:59`).toISOString() : null,
    magasinIds: b.magasinIds, codePromoId: b.codePromoId || null,
  };
}

function Cases<T extends string>({ legende, options, valeur, onChange }: { legende: string; options: { id: T; libelle: string }[]; valeur: T[]; onChange: (v: T[]) => void }) {
  const t = useT();
  return (
    <fieldset>
      <legend className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t(legende)}</legend>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => {
          const coche = valeur.includes(o.id);
          return (
            <label key={o.id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#111111]", coche ? "border-[#F5A623] bg-[#FFF7ED] font-semibold" : "border-[#E8E8E8] bg-white")}>
              <input type="checkbox" className="accent-[#F5A623]" checked={coche} onChange={() => onChange(coche ? valeur.filter((v) => v !== o.id) : [...valeur, o.id])} />
              {t(o.libelle)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

type Props = {
  ouverte: boolean;
  onFermer: () => void;
  /** Promotion à modifier ; absente = création. */
  promotion?: PromotionLue | null;
  /** Autres promotions de la boutique (pour voir les conflits dans l'aperçu). */
  autres: PromotionLue[];
  magasins: { id: string; nom: string }[];
  codesPromo: { id: string; code: string }[];
  onEnregistree: (p: PromotionLue) => void;
};

export function FormulairePromotion({ ouverte, onFermer, promotion, autres, magasins, codesPromo, onEnregistree }: Props) {
  const t = useT();
  const { fmt, devise } = useDevise();
  const [b, setB] = useState<Brouillon>(VIDE);
  const [categories, setCategories] = useState<string[]>([]);
  const [fiscal, setFiscal] = useState({ tauxTVA: 0, prixTTC: true });
  const [exemple, setExemple] = useState<ArticleChoisi[]>([]);
  const [profil, setProfil] = useState<{ niveau: string; segment: string }>({ niveau: "", segment: "" });
  const [avecAutres, setAvecAutres] = useState(true);
  const [envoi, setEnvoi] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });
  const charge = useRef(false);
  const maj = (m: Partial<Brouillon>) => setB((x) => ({ ...x, ...m }));

  useEffect(() => {
    if (!ouverte) return;
    setB(promotion ? depuisPromotion(promotion) : VIDE);
    setEnvoi({ enCours: false });
    if (charge.current) return;
    charge.current = true;
    // Catégories du catalogue et fiscalité de la boutique : une fois, à la première ouverture.
    appelPos<{ categories?: { nom: string }[] }>("/api/pos/articles?categories=1&limite=1").then((r) => { if (r.ok) setCategories((r.donnees.categories ?? []).map((c) => c.nom)); });
    appelPos<{ boutique: { tauxTVA: number }; reglages: { taxes: { prixTTC: boolean } } }>("/api/pos/reglages").then((r) => { if (r.ok) setFiscal({ tauxTVA: r.donnees.boutique.tauxTVA, prixTTC: r.donnees.reglages.taxes.prixTTC }); });
  }, [ouverte, promotion]);

  const donnees = useMemo(() => (b.type ? versDonnees(b) : null), [b]);

  // Aperçu : le panier d'exemple passe par le même calcul que la vente.
  const apercu = useMemo(() => {
    if (!donnees || !exemple.length) return null;
    const id = promotion?.id ?? "apercu";
    const essai: PromotionActive = { id, nom: donnees.nom || t("Cette promotion"), type: donnees.type, valeur: donnees.valeur, regles: donnees.regles, cumulable: donnees.cumulable, priorite: donnees.priorite, codePromoId: null };
    const concurrentes: PromotionActive[] = avecAutres
      ? autres.filter((p) => p.id !== id && p.etat === "active").map((p) => ({ id: p.id, nom: p.nom, type: p.type, valeur: p.valeur, regles: p.regles, cumulable: p.cumulable, priorite: p.priorite, codePromoId: p.codePromoId }))
      : [];
    const promotions = [essai, ...concurrentes];
    const client = profil.niveau || profil.segment ? { id: "exemple", niveauFidelite: profil.niveau || "bronze", segment: profil.segment || null } : null;
    const panier = calculerPanier(
      exemple.map((a) => ({ produitId: a.produitId, quantite: a.quantite, nom: a.nom, prixUnitaire: a.prix, uniteVente: a.uniteVente, tauxTVA: a.tauxTVA, categorie: a.categorie })),
      { tauxTVA: fiscal.tauxTVA, prixTTC: fiscal.prixTTC, droits: AUCUN_DROIT, devise, client, promotions },
    );
    const { decisions } = expliquerPromotions(
      panier.lignes.map((l, index) => ({ index, produitId: l.produitId, varianteId: null, categorie: l.categorie ?? null, quantite: l.quantite, prixApplique: l.prixApplique, net: l.brut - l.remiseLigne, offert: false })),
      promotions, { client, decimales: decimalesDevise(devise) },
    );
    return { panier, decisions, id };
  }, [donnees, exemple, profil, avecAutres, autres, promotion, fiscal, devise, t]);

  async function enregistrer() {
    if (!donnees) return;
    setEnvoi({ enCours: true });
    const r = await appelPos<{ promotion: PromotionLue }>(promotion ? `/api/pos/promotions/${promotion.id}` : "/api/pos/promotions", { method: promotion ? "PATCH" : "POST", corps: donnees });
    if (!r.ok) return setEnvoi({ enCours: false, erreur: r.message });
    setEnvoi({ enCours: false });
    onEnregistree(r.donnees.promotion);
  }

  const type = b.type;
  const select = (label: string, valeur: string, onChange: (v: string) => void, options: [string, string][], aide?: string) => (
    <Champ label={label} aide={aide}>
      {(a) => <select {...a} value={valeur} onChange={(e) => onChange(e.target.value)} className={CLASSE_SAISIE}>{options.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>}
    </Champ>
  );
  const nombre = (label: string, cle: keyof Brouillon, o: { suffixe?: string; aide?: string; min?: number; max?: number } = {}) => (
    <Saisie label={label} type="number" inputMode="decimal" min={o.min ?? 0} max={o.max} step="any" value={b[cle] as string} onChange={(e) => maj({ [cle]: e.target.value } as Partial<Brouillon>)} suffixe={o.suffixe} aide={o.aide} />
  );

  return (
    <Modale ouverte={ouverte} onFermer={onFermer} taille="xl" verrouillee={envoi.enCours}
      titre={promotion ? "Modifier la promotion" : "Nouvelle promotion"}
      description={type ? TYPES_PROMO[type].description : "Choisissez d'abord le type de promotion."}
      actions={type && (
        <>
          <Bouton variante="secondaire" onClick={onFermer} disabled={envoi.enCours}>{t("Annuler")}</Bouton>
          <Bouton onClick={enregistrer} charge={envoi.enCours} disabled={b.nom.trim().length < 2}>{t(promotion ? "Enregistrer" : "Créer la promotion")}</Bouton>
        </>
      )}>
      {!type ? (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES_PROMOTION.map((id) => (
            <li key={id}>
              <button type="button" onClick={() => maj({ type: id, segments: [] })} className={cn("h-full min-h-20 w-full rounded-2xl border border-[#E8E8E8] bg-white p-3 text-left transition-colors hover:border-[#F5A623]", FOCUS)}>
                <span className="block text-[14px] font-bold">{t(TYPES_PROMO[id].libelle)}</span>
                <span className="mt-1 block text-[12px] leading-snug text-[#666666]">{t(TYPES_PROMO[id].description)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge ton="accent">{t(TYPES_PROMO[type].libelle)}</Badge>
              {!promotion && <button type="button" onClick={() => maj({ type: null })} className={cn("min-h-11 rounded-lg px-2 text-[12px] font-semibold text-[#666666] underline", FOCUS)}>{t("Changer de type")}</button>}
            </div>
            <Saisie label="Nom de la promotion" value={b.nom} onChange={(e) => maj({ nom: e.target.value })} maxLength={80} required aide="Affiché sur le reçu et à la caisse." />

            {/* Règle propre au type */}
            <section className="space-y-3 rounded-2xl border border-[#F0F0F0] p-3" aria-label={t("Règle")}>
              {type === "pourcentage" && nombre("Remise", "valeur", { suffixe: "%", max: 100 })}
              {type === "montant_fixe" && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {nombre("Montant retiré", "valeur", { suffixe: devise })}
                  {select("Appliqué", b.par, (v) => maj({ par: v as Brouillon["par"] }), [["unite", "Par article (ou par kilo)"], ["panier", "Une fois sur le panier"]])}
                </div>
              )}
              {type === "seuil_panier" && (
                <div className="grid gap-3 sm:grid-cols-3">
                  {nombre("Panier à atteindre", "minPanier", { suffixe: devise })}
                  {select("Remise en", b.mode, (v) => maj({ mode: v as Brouillon["mode"] }), [["pourcentage", "Pourcentage"], ["montant", "Montant"]])}
                  {nombre("Remise", "valeur", { suffixe: b.mode === "montant" ? devise : "%" })}
                </div>
              )}
              {type === "x_pour_y" && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {nombre("Articles pris", "x", { min: 2 })}
                    {nombre("Articles payés", "y", { min: 1, aide: "3 pris, 2 payés = le 2+1. Les moins chers sont offerts." })}
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" className="accent-[#F5A623]" checked={b.memeArticle} onChange={(e) => maj({ memeArticle: e.target.checked })} />{t("Uniquement sur un même article (pas de mélange)")}</label>
                </>
              )}
              {type === "lot" && (
                <>
                  <SelecteurArticles label="Articles du lot" valeur={b.composants} onChange={(composants) => maj({ composants })} avecQuantite aide="Indiquez la quantité de chaque article dans UN lot." />
                  {nombre("Prix du lot", "valeur", { suffixe: devise })}
                </>
              )}
              {type === "achete_x_obtiens_y" && (
                <>
                  <SelecteurArticles label="Articles à acheter" valeur={b.acheter} onChange={(acheter) => maj({ acheter })} />
                  {nombre("Quantité à acheter", "acheterQte", { min: 1 })}
                  <SelecteurArticles label="Articles obtenus" valeur={b.obtenir} onChange={(obtenir) => maj({ obtenir })} aide="Laissez vide pour obtenir les mêmes articles (ex. 2 achetés, le 3e offert)." />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {b.obtenir.length > 0 && nombre("Quantité obtenue", "obtenirQte", { min: 1 })}
                    {nombre("Remise sur l'article obtenu", "valeur", { suffixe: "%", max: 100, aide: "Vide ou 100 = offert." })}
                  </div>
                </>
              )}
              {type === "produit_offert" && (
                <>
                  <SelecteurArticles label="Article offert" valeur={b.articles} onChange={(articles) => maj({ articles })} aide="Le cadeau doit être ajouté au panier : la caisse le passe alors à zéro." />
                  <div className="grid gap-3 sm:grid-cols-2">
                    {nombre("Quantité offerte", "quantite", { min: 1 })}
                    {nombre("À partir d'un panier de", "minPanier", { suffixe: devise, aide: "Facultatif." })}
                  </div>
                  <SelecteurArticles label="Offert pour l'achat de (facultatif)" valeur={b.declencheur} onChange={(declencheur) => maj({ declencheur })} />
                  {b.declencheur.length > 0 && nombre("Quantité à acheter", "declencheurQte", { min: 1 })}
                </>
              )}
              {type === "prix_membre" && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {NIVEAUX.map((n) => <Saisie key={n} label={LIBELLES_NIVEAU[n]} type="number" inputMode="decimal" min={0} max={100} step="any" suffixe="%" value={b.niveaux[n]} onChange={(e) => maj({ niveaux: { ...b.niveaux, [n]: e.target.value } })} />)}
                </div>
              )}
              {type === "prix_grossiste" && (
                <>
                  {b.paliers.map((p, i) => {
                    const majPalier = (m: Partial<Palier>) => maj({ paliers: b.paliers.map((x, j) => (j === i ? { ...x, ...m } : x)) });
                    return (
                      <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        <Saisie className="col-span-2 sm:col-span-1" label="À partir de" type="number" inputMode="decimal" min={0} step="any" value={p.minQuantite} onChange={(e) => majPalier({ minQuantite: e.target.value })} aide={i === 0 ? "Pièces ou kilos." : undefined} />
                        <Saisie label="Prix unitaire" type="number" inputMode="decimal" min={0} step="any" suffixe={devise} value={p.prix} onChange={(e) => majPalier({ prix: e.target.value, pct: "" })} />
                        <Saisie label="ou remise" type="number" inputMode="decimal" min={0} max={100} step="any" suffixe="%" value={p.pct} onChange={(e) => majPalier({ pct: e.target.value, prix: "" })} />
                      </div>
                    );
                  })}
                  <div className="flex flex-wrap gap-2">
                    {b.paliers.length < 10 && <Bouton variante="secondaire" taille="compact" onClick={() => maj({ paliers: [...b.paliers, { minQuantite: "", prix: "", pct: "" }] })}>{t("Ajouter un palier")}</Bouton>}
                    {b.paliers.length > 1 && <Bouton variante="secondaire" taille="compact" onClick={() => maj({ paliers: b.paliers.slice(0, -1) })}>{t("Retirer le dernier")}</Bouton>}
                  </div>
                  <label className="flex min-h-11 items-center gap-2 text-[13px]"><input type="checkbox" className="accent-[#F5A623]" checked={b.grossisteTous} onChange={(e) => maj({ grossisteTous: e.target.checked, segments: [] })} />{t("Ouvert à tout client : la quantité seule décide (sinon réservé aux grossistes)")}</label>
                </>
              )}
            </section>

            {/* Conditions */}
            <section className="space-y-3" aria-label={t("Conditions")}>
              {type !== "lot" && type !== "achete_x_obtiens_y" && type !== "produit_offert" && (
                <SelecteurArticles label="Articles concernés" valeur={b.articles} onChange={(articles) => maj({ articles })} aide="Aucun article choisi = tous les articles." />
              )}
              {type !== "lot" && type !== "achete_x_obtiens_y" && categories.length > 0 && (
                <Cases legende="Catégories concernées" options={categories.map((c) => ({ id: c, libelle: c }))} valeur={b.categories} onChange={(v) => maj({ categories: v })} />
              )}
              {!(type === "prix_grossiste" && b.grossisteTous) && (
                <Cases legende={type === "prix_grossiste" ? "Segments admis (aucun = grossistes)" : "Réservée aux segments (aucun = tous les clients)"} options={SEGMENTS.map((s) => ({ id: s, libelle: LIBELLES_SEGMENT[s] }))} valeur={b.segments} onChange={(segments) => maj({ segments })} />
              )}
              {type !== "seuil_panier" && type !== "produit_offert" && nombre("Panier minimum", "minPanier", { suffixe: devise, aide: "Facultatif." })}
              <div className="grid gap-3 sm:grid-cols-2">
                <Saisie label="Du" type="date" value={b.dateDebut} onChange={(e) => maj({ dateDebut: e.target.value })} aide="Vide = dès maintenant." />
                <Saisie label="Au" type="date" value={b.dateFin} min={b.dateDebut || undefined} onChange={(e) => maj({ dateFin: e.target.value })} aide="Vide = sans fin." />
              </div>
              {magasins.length > 1 && <Cases legende="Magasins (aucun = tous)" options={magasins.map((m) => ({ id: m.id, libelle: m.nom }))} valeur={b.magasinIds} onChange={(magasinIds) => maj({ magasinIds })} />}
            </section>

            {/* Cumul */}
            <section className="space-y-3 rounded-2xl border border-[#F0F0F0] p-3" aria-label={t("Cumul")}>
              <div className="grid gap-3 sm:grid-cols-2">
                {nombre("Priorité", "priorite", { min: -1000, max: 1000, aide: "La plus haute passe en premier." })}
                <label className="flex min-h-11 items-center gap-2 self-start text-[13px] sm:mt-5"><input type="checkbox" className="accent-[#F5A623]" checked={b.cumulable} onChange={(e) => maj({ cumulable: e.target.checked })} />{t("Cumulable avec d'autres promotions cumulables")}</label>
              </div>
              <p className="text-[11.5px] leading-snug text-[#666666]">{t("Un article ne reçoit jamais deux promotions. Une promotion non cumulable écarte toutes les autres du panier.")}</p>
              {codesPromo.length > 0 && (
                <>
                  {select("Déclenchée par un code promo", b.codePromoId, (v) => maj({ codePromoId: v }), [["", "Aucun : appliquée d'office"], ...codesPromo.map((c) => [c.id, c.code] as [string, string])])}
                  {b.codePromoId && <p role="note" className="text-[11.5px] leading-snug text-[#666666]">{t("Cette promotion ne s'applique que si ce code est saisi à la caisse. La remise propre du code promo s'y ajoute.")}</p>}
                </>
              )}
            </section>
            {envoi.erreur && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(envoi.erreur)}</p>}
          </div>

          {/* Aperçu */}
          <aside className="space-y-3 rounded-2xl bg-[#FAFAFA] p-3 lg:sticky lg:top-0 lg:self-start" aria-label={t("Aperçu sur un panier d'exemple")}>
            <p className="text-[13px] font-bold">{t("Aperçu sur un panier d'exemple")}</p>
            <p className="text-[11.5px] leading-snug text-[#666666]">{donnees ? resumePromotion(donnees, fmt) : ""}</p>
            <SelecteurArticles label="Panier d'exemple" valeur={exemple} onChange={setExemple} avecQuantite />
            <div className="grid grid-cols-2 gap-2">
              {select("Niveau du client", profil.niveau, (niveau) => setProfil({ ...profil, niveau }), [["", "Sans client"], ...NIVEAUX.map((n) => [n, LIBELLES_NIVEAU[n]] as [string, string])])}
              {select("Segment", profil.segment, (segment) => setProfil({ ...profil, segment }), [["", "Aucun"], ...SEGMENTS.map((s) => [s, LIBELLES_SEGMENT[s]] as [string, string])])}
            </div>
            {autres.some((p) => p.etat === "active" && p.id !== promotion?.id) && (
              <label className="flex min-h-11 items-center gap-2 text-[12.5px]"><input type="checkbox" className="accent-[#F5A623]" checked={avecAutres} onChange={(e) => setAvecAutres(e.target.checked)} />{t("Avec les autres promotions actives")}</label>
            )}
            {!apercu ? <p className="text-[12px] text-[#888888]">{t("Ajoutez des articles pour voir l'effet de la promotion.")}</p> : (
              <div aria-live="polite" className="space-y-2">
                <ul className="divide-y divide-[#EEEEEE] rounded-xl bg-white px-3">
                  {apercu.panier.lignes.map((l, i) => (
                    <li key={i} className="py-2 text-[12.5px]">
                      <div className="flex justify-between gap-2"><span className="min-w-0 truncate">{l.uniteVente === "kg" ? `${l.quantite} g` : `${l.quantite} ×`} {l.nom}</span><span className="tabular-nums">{fmt(l.brut)}</span></div>
                      {l.remisePromotion > 0 && (
                        <div className="flex justify-between gap-2 text-[#15803D]">
                          <span className="min-w-0 truncate">{apercu.decisions.find((d) => d.promotionId === l.promotionId)?.nom}</span><span className="tabular-nums">−{fmt(l.remisePromotion)}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
                <dl className="space-y-0.5 text-[12.5px]">
                  <div className="flex justify-between"><dt>{t("Sous-total")}</dt><dd className="tabular-nums">{fmt(apercu.panier.sousTotal)}</dd></div>
                  <div className="flex justify-between text-[#15803D]"><dt>{t("Promotions")}</dt><dd className="tabular-nums">−{fmt(apercu.panier.remisePromotions)}</dd></div>
                  <div className="flex justify-between text-[14px] font-bold"><dt>{t("Total")}</dt><dd className="tabular-nums">{fmt(apercu.panier.total)}</dd></div>
                </dl>
                <ul className="space-y-1.5">
                  {apercu.decisions.map((d) => (
                    <li key={d.promotionId} className="rounded-xl bg-white px-3 py-2 text-[11.5px] leading-snug">
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-semibold">{d.promotionId === apercu.id ? t("Cette promotion") : d.nom}</span>
                        <Badge ton={d.statut === "appliquee" ? "positif" : "neutre"}>{t(d.statut === "appliquee" ? "Appliquée" : "Écartée")}</Badge>
                      </span>
                      <span className="mt-0.5 block text-[#666666]">{d.raison}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      )}
    </Modale>
  );
}
