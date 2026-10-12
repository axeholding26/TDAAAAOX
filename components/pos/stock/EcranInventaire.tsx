"use client";
// Écran « Inventaires » (§26). Liste et historique, démarrage (complet,
// partiel, rayon, catégorie, produit, cyclique), puis le comptage :
// scan → comptage → suivant, au poste (caméra, douchette, saisie) comme depuis
// le téléphone appairé (scans de contexte « inventaire » reçus par le flux).
// Théorique / Compté / Écart, clôture, validation (droit inventaire_valider).
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Minus, Plus } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, BoutonIcone, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Modale, Saisie, type Ton } from "@/components/pos/ui";
import type { ScanEmis } from "@/lib/pos/client/bus";
import { cn } from "@/lib/utils";
import { appelPos, Carte, Chiffre, ChoixArticle, EnTete, jour, nouvelleCle, Onglets, Page, PosteScan, qte, SelectLieu, signe, useCaisse, useLecture, Vignette, type ArticleChoisi, type Lieu } from "./commun";

type Resume = { id: string; type: string; statut: string; entrepotNom: string | null; demarreAt: string; valideAt: string | null; creePar: string | null; validePar: string | null; lignes: number; comptees: number; notes: string | null };
type Liste = { inventaires: Resume[]; curseurSuivant: string | null; lieux: Lieu[]; lieuCourant: string; droits: { compter: boolean; valider: boolean } };
type Ligne = {
  id: string; produitId: string; varianteId: string | null; nom: string; variante: string | null; sku: string | null; codeBarres: string | null; image: string | null; uniteVente: string;
  quantiteTheorique: number; quantiteComptee: number | null; ecart: number | null; compteAt: string | null; mouvementsDepuis: number;
};
type Detail = {
  inventaire: Resume & { estCreateur: boolean };
  resume: { lignes: number; comptees: number; nonComptees: number; enEcart: number; ecartPlus: number; ecartMoins: number; valeurEcart: number | null; plafondEcarts: number };
  lignes: Ligne[]; curseurSuivant: string | null; droits: { compter: boolean; valider: boolean };
};
type Comptee = { ligneId: string; produitId: string; varianteId: string | null; nom: string; variante: string | null; image: string | null; uniteVente: string; quantiteTheorique: number; quantiteComptee: number; ecart: number; ajoute: number };

const TYPES: Record<string, { libelle: string; aide: string }> = {
  partiel: { libelle: "Partiel", aide: "Vous comptez ce que vous scannez, rien d'autre n'est préparé." },
  categorie: { libelle: "Par catégorie", aide: "Tous les articles des catégories choisies." },
  rayon: { libelle: "Par rayon", aide: "Un rayon = des catégories ou une liste d'articles que vous choisissez." },
  produit: { libelle: "Par produit", aide: "Seulement les articles que vous choisissez." },
  cyclique: { libelle: "Cyclique", aide: "AXSO propose les articles qui n'ont pas été comptés depuis le plus longtemps." },
  complet: { libelle: "Complet", aide: "Tous les articles physiques actifs du lieu." },
};
const STATUTS: Record<string, { libelle: string; ton: Ton }> = {
  brouillon: { libelle: "Brouillon", ton: "neutre" }, en_cours: { libelle: "Comptage en cours", ton: "accent" }, a_valider: { libelle: "À valider", ton: "info" },
  valide: { libelle: "Validé", ton: "positif" }, annule: { libelle: "Annulé", ton: "neutre" },
};

function Nouveau({ liste, caisseId, onCree, onFermer }: { liste: Liste; caisseId: string | null; onCree: (id: string) => void; onFermer: () => void }) {
  const t = useT();
  const [type, setType] = useState("partiel");
  const [entrepotId, setEntrepotId] = useState(liste.lieuCourant);
  const [categories, setCategories] = useState<string[]>([]);
  const [articles, setArticles] = useState<ArticleChoisi[]>([]);
  const [nombre, setNombre] = useState("30");
  const [notes, setNotes] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());
  const dispo = useLecture<{ categories?: { nom: string; articles: number }[] }>("/api/pos/articles?categories=1&limite=1", caisseId);
  const avecCategories = type === "categorie" || type === "rayon";
  const avecArticles = type === "produit" || type === "rayon";

  const demarrer = async () => {
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ comptageId: string }>("/api/pos/inventaire", {
      method: "POST", caisseId,
      corps: { cle: cle.current, type, entrepotId, notes: notes.trim() || null, perimetre: { ...(avecCategories && categories.length ? { categories } : {}), ...(avecArticles && articles.length ? { produitIds: [...new Set(articles.map((a) => a.produitId))] } : {}), ...(type === "cyclique" ? { nombre: Math.max(1, Math.min(500, Math.floor(Number(nombre)) || 30)) } : {}) } },
    });
    setEnvoi(false);
    if (!r.ok) {
      // Un inventaire est déjà ouvert sur ce lieu : on y conduit plutôt que de laisser dans l'impasse.
      const ouvert = r.code === "inventaire_ouvert" ? (r.details?.comptageId as string | undefined) : undefined;
      if (ouvert) { toast.message(t(r.message)); onCree(ouvert); return; }
      setErreur(r.message); return;
    }
    onCree(r.donnees.comptageId);
  };

  return (
    <Modale ouverte onFermer={onFermer} titre="Nouvel inventaire" taille="lg" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={demarrer} charge={envoi}>{t("Démarrer le comptage")}</Bouton></>}>
      <div className="space-y-3">
        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Type d'inventaire")}</legend>
          <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(TYPES).map(([id, x]) => (
              <label key={id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#111111]", type === id ? "border-[#F5A623] bg-[#FFF7ED] text-[#111111]" : "border-[#E8E8E8] text-[#555555]")}>
                <input type="radio" name="type-inventaire" value={id} checked={type === id} onChange={() => setType(id)} className="sr-only" />{t(x.libelle)}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[11.5px] text-[#666666]">{t(TYPES[type].aide)}</p>
        </fieldset>
        {liste.lieux.length > 1 && <SelectLieu label="Lieu compté" lieux={liste.lieux} valeur={entrepotId} onChange={setEntrepotId} />}
        {avecCategories && (
          <fieldset>
            <legend className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Catégories")}</legend>
            {dispo.charge ? <p className="mt-1 text-[12px] text-[#888888]">{t("Chargement…")}</p> : !dispo.donnees?.categories?.length ? <p className="mt-1 text-[12px] text-[#888888]">{t("Aucune catégorie n'est renseignée sur vos articles.")}</p> : (
              <div className="mt-1 flex flex-wrap gap-2">
                {dispo.donnees.categories.map((c) => {
                  const coche = categories.includes(c.nom);
                  return (
                    <label key={c.nom} className={cn("flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-[12.5px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-[#111111]", coche ? "border-[#F5A623] bg-[#FFF7ED] font-semibold" : "border-[#E8E8E8]")}>
                      <input type="checkbox" checked={coche} onChange={() => setCategories((l) => (coche ? l.filter((x) => x !== c.nom) : [...l, c.nom]))} className="sr-only" />
                      {c.nom} <span className="text-[#888888]">({c.articles})</span>
                    </label>
                  );
                })}
              </div>
            )}
          </fieldset>
        )}
        {avecArticles && (
          <div>
            <ChoixArticle label="Articles à compter" caisseId={caisseId} onChoisir={(a) => setArticles((l) => (l.some((x) => x.produitId === a.produitId) ? l : [...l, a]))} />
            {articles.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {articles.map((a) => <li key={a.produitId}><button type="button" onClick={() => setArticles((l) => l.filter((x) => x.produitId !== a.produitId))} className={cn("min-h-11 rounded-xl bg-[#F5F5F5] px-3 text-[12px] font-semibold", FOCUS)} aria-label={t("Retirer {0}", a.nom)}>{a.nom} ×</button></li>)}
              </ul>
            )}
          </div>
        )}
        {type === "cyclique" && <Saisie label="Nombre d'articles proposés" inputMode="numeric" value={nombre} onChange={(e) => setNombre(e.target.value)} />}
        <Saisie label="Note (facultatif)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        {erreur && <p role="alert" className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

function Comptage({ id, caisseId, onRetour }: { id: string; caisseId: string | null; onRetour: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [filtre, setFiltre] = useState<"tous" | "comptes" | "non_comptes" | "ecarts">("tous");
  const [recherche, setRecherche] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { const m = setTimeout(() => setQ(recherche.trim()), 300); return () => clearTimeout(m); }, [recherche]);
  const { donnees, erreur, charge, recharger } = useLecture<Detail>(`/api/pos/inventaire/${id}?filtre=${filtre}${q ? `&q=${encodeURIComponent(q)}` : ""}`, caisseId);
  const [suite, setSuite] = useState<{ lignes: Ligne[]; curseur: string | null }>({ lignes: [], curseur: null });
  useEffect(() => { setSuite({ lignes: [], curseur: donnees?.curseurSuivant ?? null }); }, [donnees]);
  const [dernier, setDernier] = useState<Comptee | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);
  const [variantes, setVariantes] = useState<{ produitId: string; nom: string; choix: { id: string; libelle: string }[] } | null>(null);
  const [exacte, setExacte] = useState("");
  const [confirme, setConfirme] = useState<"cloturer" | "valider" | "annuler" | "zero_non_comptes" | "rouvrir" | null>(null);
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const cleAction = useRef(nouvelleCle());
  // Les scans arrivent plus vite que le réseau : on les compte l'un après l'autre, dans l'ordre.
  const file = useRef<Promise<void>>(Promise.resolve());

  const inv = donnees?.inventaire;
  const enCours = inv?.statut === "en_cours";
  const peutCompter = !!donnees?.droits.compter && enCours;

  const compter = useCallback((corps: Record<string, unknown>, cle: string) => {
    file.current = file.current.then(async () => {
      const r = await appelPos<{ ligne: Comptee }>(`/api/pos/inventaire/${id}/comptages`, { method: "POST", caisseId, corps: { ...corps, cle } });
      if (r.ok) { setDernier(r.donnees.ligne); setAlerte(null); setExacte(""); void recharger(); return; }
      if (r.code === "variante_requise" && Array.isArray(r.details?.variantes)) {
        setVariantes({ produitId: String(r.details!.produitId), nom: r.message, choix: r.details!.variantes as { id: string; libelle: string }[] });
        return;
      }
      setAlerte(r.message);
    });
  }, [id, caisseId, recharger]);

  // Clé = identifiant du scan : le même scan renvoyé (reconnexion du téléphone) ne compte pas deux fois.
  const surScan = (s: ScanEmis) => compter({ code: s.code }, `inventaire-${id}-${s.scanId}`);

  const agir = async () => {
    if (!confirme) return;
    setEnvoi(true);
    const r = await appelPos<{ statut: string; appliquees: number; plafonnees: { nom: string; ecart: number; applique: number }[]; ignorees: number; misesAZero: number }>(`/api/pos/inventaire/${id}`, { method: "PATCH", caisseId, corps: { cle: cleAction.current, action: confirme, motif: motif.trim() || null } });
    setEnvoi(false);
    if (!r.ok) { toast.error(t(r.message)); if (r.code === "conflit") { setConfirme(null); void recharger(); } return; }
    cleAction.current = nouvelleCle();
    const d = r.donnees;
    toast.success(
      confirme === "valider" ? t("Inventaire validé : {0} écart(s) appliqué(s) au stock.", d.appliquees)
      : confirme === "zero_non_comptes" ? t("{0} article(s) non compté(s) passé(s) à zéro.", d.misesAZero)
      : confirme === "cloturer" ? t("Comptage clos : l'inventaire attend sa validation.")
      : confirme === "rouvrir" ? t("Comptage rouvert.") : t("Inventaire annulé. Le stock n'a pas été modifié."),
    );
    if (d.plafonnees?.length) toast.warning(t("{0} manque(s) ramené(s) au stock présent (des ventes ont eu lieu depuis le comptage).", d.plafonnees.length));
    if (d.ignorees) toast.warning(t("{0} ligne(s) ignorée(s) : l'article n'existe plus.", d.ignorees));
    setConfirme(null); setMotif(""); void recharger();
  };

  if (erreur && !donnees) return <Page><EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} /><Bouton variante="secondaire" onClick={onRetour}>{t("Retour aux inventaires")}</Bouton></Page>;
  if (!donnees || !inv) return <Page><EtatChargement texte="Chargement de l'inventaire…" /></Page>;

  const r = donnees.resume;
  const lignes = [...donnees.lignes, ...suite.lignes];
  const aRecompter = lignes.filter((l) => l.mouvementsDepuis !== 0).length;
  const chargerSuite = async () => {
    if (!suite.curseur) return;
    const x = await appelPos<Detail>(`/api/pos/inventaire/${id}?filtre=${filtre}${q ? `&q=${encodeURIComponent(q)}` : ""}&curseur=${suite.curseur}`, { caisseId });
    if (x.ok) setSuite((s) => ({ lignes: [...s.lignes, ...x.donnees.lignes], curseur: x.donnees.curseurSuivant }));
    else toast.error(t(x.message));
  };
  const textes: Record<NonNullable<typeof confirme>, { titre: string; texte: string; bouton: string }> = {
    cloturer: { titre: "Clore le comptage ?", texte: r.nonComptees ? `${r.nonComptees} article(s) n'ont pas été comptés : ils ne seront pas modifiés. Vous pourrez rouvrir le comptage tant que l'inventaire n'est pas validé.` : "Vous pourrez rouvrir le comptage tant que l'inventaire n'est pas validé.", bouton: "Clore le comptage" },
    rouvrir: { titre: "Rouvrir le comptage ?", texte: "L'inventaire repasse en comptage : vous pourrez scanner de nouveau.", bouton: "Rouvrir" },
    zero_non_comptes: { titre: "Mettre à zéro les articles non comptés ?", texte: `Les ${r.nonComptees} article(s) non comptés seront considérés comme absents du lieu. À la validation, leur stock dans ce lieu sera retiré.`, bouton: "Mettre à zéro" },
    valider: { titre: "Valider l'inventaire ?", texte: `${r.enEcart} écart(s) seront appliqués au stock, de façon définitive. Les articles sans écart et les articles non comptés ne changent pas.`, bouton: "Valider et corriger le stock" },
    annuler: { titre: "Annuler cet inventaire ?", texte: "Rien ne sera appliqué au stock. Les comptages saisis restent consultables dans l'historique.", bouton: "Annuler l'inventaire" },
  };

  return (
    <Page>
      <button type="button" onClick={onRetour} className={cn("inline-flex min-h-11 items-center gap-1.5 rounded-xl text-[12.5px] font-semibold text-[#666666] hover:text-[#111111]", FOCUS)}><ArrowLeft size={15} aria-hidden />{t("Tous les inventaires")}</button>
      <EnTete titre={`${t("Inventaire")} — ${t(TYPES[inv.type]?.libelle ?? inv.type)}`} sousTitre={`${inv.entrepotNom ?? ""} · ${t("démarré le {0}", jour(inv.demarreAt, t.loc, true))}${inv.creePar ? ` · ${inv.creePar}` : ""}`}>
        <Badge ton={STATUTS[inv.statut]?.ton ?? "neutre"}>{t(STATUTS[inv.statut]?.libelle ?? inv.statut)}</Badge>
      </EnTete>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Chiffre label="Articles comptés" valeur={`${r.comptees.toLocaleString(t.loc)} / ${r.lignes.toLocaleString(t.loc)}`} />
        <Chiffre label="Lignes en écart" valeur={r.enEcart.toLocaleString(t.loc)} ton={r.enEcart ? "danger" : undefined} />
        <Chiffre label="Écarts" valeur={`+${r.ecartPlus.toLocaleString(t.loc)} / −${Math.abs(r.ecartMoins).toLocaleString(t.loc)}`} aide="Unités en plus / en moins" />
        <Chiffre label="Valeur de l'écart" valeur={r.valeurEcart !== null ? fmt(r.valeurEcart) : "—"} aide={r.valeurEcart !== null ? "Au prix d'achat" : "Réservée aux personnes autorisées à voir les coûts"} ton={r.valeurEcart !== null && r.valeurEcart < 0 ? "danger" : undefined} />
      </div>

      {enCours && (
        <Carte titre="Compter" actions={peutCompter ? <PosteScan contexte="inventaire" caisseId={caisseId} onScan={surScan} libelle="Scanner" /> : undefined}>
          {!donnees.droits.compter ? <p className="text-[12.5px] text-[#666666]">{t("Vous pouvez consulter cet inventaire, mais pas compter. Demandez à un responsable.")}</p> : (
            <div className="space-y-3">
              <p className="text-[12px] text-[#666666]">{t("Scannez les articles l'un après l'autre : chaque scan ajoute 1 (ou le poids de l'étiquette). Sur le téléphone appairé, choisissez le mode « Inventaire ».")}</p>
              {alerte && <p role="alert" className="flex items-start gap-2 rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]"><AlertTriangle size={15} className="mt-0.5 flex-shrink-0" aria-hidden />{t(alerte)}</p>}
              {dernier && (
                <div className="rounded-2xl border border-[#111111] p-3" aria-live="polite">
                  <div className="flex items-center gap-3">
                    <Vignette src={dernier.image} taille={48} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#666666]">{t("Dernier article compté")}</p>
                      <p className="truncate text-[14px] font-bold text-[#111111]">{dernier.nom}{dernier.variante ? ` — ${dernier.variante}` : ""}</p>
                    </div>
                    <BoutonIcone label={t("Retirer 1 (scan en trop)")} onClick={() => compter({ produitId: dernier.produitId, varianteId: dernier.varianteId, quantite: -1 }, nouvelleCle())} disabled={dernier.quantiteComptee < 1 || dernier.uniteVente === "kg"}><Minus size={18} aria-hidden /></BoutonIcone>
                    <BoutonIcone label={t("Ajouter 1")} variante="primaire" onClick={() => compter({ produitId: dernier.produitId, varianteId: dernier.varianteId, quantite: 1 }, nouvelleCle())} disabled={dernier.uniteVente === "kg"}><Plus size={18} aria-hidden /></BoutonIcone>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-[#F5F5F5] py-2"><dt className="text-[10.5px] font-semibold uppercase text-[#666666]">{t("Théorique")}</dt><dd className="text-[18px] font-bold tabular-nums">{qte(dernier.quantiteTheorique, dernier.uniteVente, t.loc)}</dd></div>
                    <div className="rounded-xl bg-[#111111] py-2 text-white"><dt className="text-[10.5px] font-semibold uppercase text-white/70">{t("Compté")}</dt><dd className="text-[18px] font-bold tabular-nums">{qte(dernier.quantiteComptee, dernier.uniteVente, t.loc)}</dd></div>
                    <div className="rounded-xl bg-[#F5F5F5] py-2"><dt className="text-[10.5px] font-semibold uppercase text-[#666666]">{t("Écart")}</dt><dd className={cn("text-[18px] font-bold tabular-nums", dernier.ecart < 0 ? "text-[#B91C1C]" : dernier.ecart > 0 ? "text-[#15803D]" : "")}>{signe(dernier.ecart, dernier.uniteVente, t.loc)}</dd></div>
                  </dl>
                  <form className="mt-3 flex items-end gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(exacte.replace(",", "."));
                    const entier = dernier.uniteVente === "kg" ? Math.round(n * 1000) : n;
                    if (exacte.trim() === "" || !Number.isInteger(entier) || entier < 0) { setAlerte("Saisissez une quantité valide."); return; }
                    compter({ produitId: dernier.produitId, varianteId: dernier.varianteId, quantite: entier, mode: "fixer" }, nouvelleCle());
                  }}>
                    <Saisie label="Quantité exacte (recomptage)" inputMode="decimal" value={exacte} onChange={(e) => setExacte(e.target.value)} suffixe={dernier.uniteVente === "kg" ? "kg" : undefined} className="flex-1" />
                    <Bouton type="submit" variante="sombre">{t("Fixer")}</Bouton>
                  </form>
                </div>
              )}
              <ChoixArticle label="Compter un article sans le scanner" caisseId={caisseId} onChoisir={(a) => compter({ produitId: a.produitId, varianteId: a.varianteId, quantite: a.uniteVente === "kg" ? 0 : 1, mode: a.uniteVente === "kg" ? "fixer" : "ajouter" }, nouvelleCle())} aide="Un article au poids s'ajoute à zéro : saisissez ensuite son poids exact." />
            </div>
          )}
        </Carte>
      )}

      {inv.statut === "a_valider" && aRecompter > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]"><AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
          {t("Le stock de {0} article(s) affiché(s) a bougé après leur comptage (ventes, réceptions). L'écart reste appliqué tel quel, sans effacer ces mouvements ; rouvrez le comptage pour les recompter en cas de doute.", aRecompter)}
        </p>
      )}

      <div className="flex flex-wrap items-end justify-between gap-2">
        <Onglets label="Lignes affichées" actif={filtre} onChange={setFiltre} onglets={[{ id: "tous", libelle: "Tout" }, { id: "comptes", libelle: "Comptés", compte: r.comptees }, { id: "non_comptes", libelle: "Non comptés", compte: r.nonComptees }, { id: "ecarts", libelle: "Écarts", compte: r.enEcart }]} />
        <Saisie label="Rechercher une ligne" labelMasque type="search" placeholder={t("Rechercher une ligne")} value={recherche} onChange={(e) => setRecherche(e.target.value)} className="w-full sm:w-64" />
      </div>

      {!lignes.length ? <EtatVide titre={charge ? "Chargement…" : "Aucune ligne"} texte={filtre === "tous" && !q ? "Scannez un premier article pour commencer le comptage." : "Aucune ligne ne correspond."} compact /> : (
        <div className={cn("overflow-x-auto rounded-2xl border border-[#E8E8E8] bg-white transition-opacity", charge && "opacity-60")}>
          <table className="w-full min-w-[520px] text-left text-[12.5px]">
            <caption className="sr-only">{t("Lignes de l'inventaire : théorique, compté, écart")}</caption>
            <thead><tr className="border-b border-[#F0F0F0] text-[10.5px] uppercase tracking-wide text-[#666666]">
              <th scope="col" className="px-3 py-2 font-semibold">{t("Article")}</th>
              {["Théorique", "Compté", "Écart"].map((c) => <th key={c} scope="col" className="px-3 py-2 text-right font-semibold">{t(c)}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-[#F0F0F0]">
              {lignes.map((l) => (
                <tr key={l.id}>
                  <th scope="row" className="px-3 py-2 font-normal">
                    <span className="flex items-center gap-2">
                      <Vignette src={l.image} taille={32} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-[#111111]">{l.nom}{l.variante ? ` — ${l.variante}` : ""}</span>
                        <span className="block truncate text-[11px] text-[#888888]">{[l.sku, l.codeBarres].filter(Boolean).join(" · ")}{l.mouvementsDepuis !== 0 && <span className="font-semibold text-[#B45309]"> · {t("stock bougé depuis : {0}", signe(l.mouvementsDepuis, l.uniteVente, t.loc))}</span>}</span>
                      </span>
                    </span>
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums text-[#555555]">{qte(l.quantiteTheorique, l.uniteVente, t.loc)}</td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums text-[#111111]">
                    {l.quantiteComptee === null ? <span className="font-normal text-[#AAAAAA]">{t("non compté")}</span> : qte(l.quantiteComptee, l.uniteVente, t.loc)}
                    {peutCompter && <button type="button" onClick={() => { setDernier({ ligneId: l.id, produitId: l.produitId, varianteId: l.varianteId, nom: l.nom, variante: l.variante, image: l.image, uniteVente: l.uniteVente, quantiteTheorique: l.quantiteTheorique, quantiteComptee: l.quantiteComptee ?? 0, ecart: l.ecart ?? 0, ajoute: 0 }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={cn("ml-2 min-h-11 rounded-lg px-2 text-[11.5px] font-semibold text-[#B45309] underline", FOCUS)}>{t("Corriger")}</button>}
                  </td>
                  <td className={cn("px-3 py-2 text-right font-bold tabular-nums", (l.ecart ?? 0) < 0 ? "text-[#B91C1C]" : (l.ecart ?? 0) > 0 ? "text-[#15803D]" : "text-[#888888]")}>{l.ecart === null ? "—" : signe(l.ecart, l.uniteVente, t.loc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {suite.curseur && <Bouton variante="secondaire" large onClick={chargerSuite}>{t("Afficher la suite")}</Bouton>}

      {(enCours || inv.statut === "a_valider") && (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap justify-end gap-2 border-t border-[#E8E8E8] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
          {(donnees.droits.valider || (inv.estCreateur && enCours)) && <Bouton variante="danger" onClick={() => setConfirme("annuler")}>{t("Annuler l'inventaire")}</Bouton>}
          {donnees.droits.valider && r.nonComptees > 0 && <Bouton variante="secondaire" onClick={() => setConfirme("zero_non_comptes")}>{t("Non comptés à zéro")}</Bouton>}
          {enCours && donnees.droits.compter && <Bouton variante="sombre" onClick={() => setConfirme("cloturer")} disabled={!r.comptees}>{t("Clore le comptage")}</Bouton>}
          {inv.statut === "a_valider" && <Bouton variante="secondaire" onClick={() => setConfirme("rouvrir")}>{t("Rouvrir le comptage")}</Bouton>}
          {inv.statut === "a_valider" && (donnees.droits.valider
            ? <Bouton onClick={() => setConfirme("valider")} disabled={r.enEcart > r.plafondEcarts}>{t("Valider l'inventaire")}</Bouton>
            : <p className="self-center text-[12px] text-[#666666]">{t("En attente de validation par un responsable.")}</p>)}
        </div>
      )}
      {inv.statut === "a_valider" && r.enEcart > r.plafondEcarts && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t("Cet inventaire compte plus de {0} écarts : il ne peut pas être validé en une fois. Annulez-le et comptez par catégorie.", r.plafondEcarts)}</p>}

      {confirme && (
        <Modale ouverte onFermer={() => setConfirme(null)} titre={textes[confirme].titre} description={textes[confirme].texte} taille="sm" verrouillee={envoi}
          actions={<><Bouton variante="secondaire" onClick={() => setConfirme(null)} disabled={envoi}>{t("Retour")}</Bouton><Bouton variante={confirme === "annuler" ? "danger" : "primaire"} onClick={agir} charge={envoi}>{t(textes[confirme].bouton)}</Bouton></>}>
          <Saisie label="Commentaire (facultatif)" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} />
        </Modale>
      )}
      {variantes && (
        <Modale ouverte onFermer={() => setVariantes(null)} titre="Quelle variante comptez-vous ?" description={variantes.nom} taille="sm">
          <div className="flex flex-wrap gap-2">
            {variantes.choix.map((v) => <Bouton key={v.id} variante="secondaire" onClick={() => { compter({ produitId: variantes.produitId, varianteId: v.id, quantite: 1 }, nouvelleCle()); setVariantes(null); }}>{v.libelle}</Bouton>)}
          </div>
        </Modale>
      )}
    </Page>
  );
}

export function EcranInventaire() {
  const t = useT();
  const [caisseId] = useCaisse();
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveau, setNouveau] = useState(false);
  const { donnees, erreur, charge, recharger } = useLecture<Liste>(ouvert ? null : "/api/pos/inventaire?limite=30", caisseId);

  if (ouvert) return <Comptage id={ouvert} caisseId={caisseId} onRetour={() => setOuvert(null)} />;
  return (
    <Page>
      <EnTete titre="Inventaires" sousTitre="Comptez votre stock par scan, comparez au stock attendu, puis validez : les écarts corrigent le stock et restent tracés.">
        {donnees?.droits.compter && <Bouton onClick={() => setNouveau(true)} icone={<Plus size={15} aria-hidden />}>{t("Nouvel inventaire")}</Bouton>}
      </EnTete>
      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement texte="Chargement des inventaires…" />
        : !donnees.inventaires.length ? <EtatVide titre="Aucun inventaire" texte="Démarrez un premier inventaire : un comptage partiel suffit pour vérifier un rayon." />
        : (
          <ul className={cn("space-y-2", charge && "opacity-60")}>
            {donnees.inventaires.map((i) => (
              <li key={i.id}>
                <button type="button" onClick={() => setOuvert(i.id)} className={cn("flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#E8E8E8] bg-white p-4 text-left hover:border-[#F5A623]", FOCUS)}>
                  <span className="min-w-0">
                    <span className="block text-[13.5px] font-bold text-[#111111]">{t(TYPES[i.type]?.libelle ?? i.type)} · {i.entrepotNom ?? t("Lieu supprimé")}</span>
                    <span className="block text-[11.5px] text-[#666666]">{jour(i.demarreAt, t.loc, true)}{i.creePar ? ` · ${i.creePar}` : ""} · {t("{0} compté(s) sur {1}", i.comptees, i.lignes)}{i.valideAt ? ` · ${t("validé le {0}", jour(i.valideAt, t.loc))}${i.validePar ? ` (${i.validePar})` : ""}` : ""}</span>
                  </span>
                  <Badge ton={STATUTS[i.statut]?.ton ?? "neutre"}>{t(STATUTS[i.statut]?.libelle ?? i.statut)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      {nouveau && donnees && <Nouveau liste={donnees} caisseId={caisseId} onFermer={() => setNouveau(false)} onCree={(id) => { setNouveau(false); setOuvert(id); }} />}
    </Page>
  );
}
