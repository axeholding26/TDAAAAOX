"use client";
// Écran « Gestion des stocks » (§27) : les 7 états du stock par lieu, recherche
// et pagination côté serveur, ajustements (droit ajuster_stock), journal des
// mouvements filtrable. Un scan de contexte « contrôle stock », « contrôle
// prix » ou « fiche produit » ouvre la fiche de l'article.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, FileSearch, History, Search, SlidersHorizontal } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, Modale, Saisie, Tiroir } from "@/components/pos/ui";
import type { ContexteScan } from "@/lib/pos/types";
import { cn } from "@/lib/utils";
import FicheProduit, { GrilleEtats, type ModeFiche } from "./FicheProduit";
import { appelPos, Chiffre, EnTete, jour, nouvelleCle, Onglets, Page, PosteScan, qte, SelectLieu, useCaisse, Vignette, type Etats, type Lieu } from "./commun";

type Variante = { id: string; libelle: string; sku: string | null; codeBarres: string | null; stock: number; etats: Etats };
type Produit = {
  id: string; nom: string; image: string | null; sku: string | null; codeBarres: string | null; categorie: string | null; uniteVente: string;
  stock: number; stockMin: number | null; prix: number; cout: number | null; statutStock: "ok" | "bas" | "rupture"; etats: Etats; variantes: Variante[];
};
type Reponse = {
  produits: Produit[]; curseurSuivant: string | null; lieux: Lieu[]; lieuCourant: string;
  stats: { total: number; enRupture: number; stockBas: number; valeurStock: number | null }; droits: { ajuster: boolean; couts: boolean };
};
type Mouvement = {
  id: string; type: string; quantite: number; stockAvant: number; stockApres: number; motif: string | null; createdAt: string;
  produit: { nom: string; images: string[] }; variante: string | null; uniteVente: string; entrepot: string | null; lot: string | null; auteur: string | null;
};

const TYPES: Record<string, { libelle: string; aide: string }> = {
  entree: { libelle: "Entrée", aide: "Ajoute des unités au stock du lieu." },
  sortie: { libelle: "Sortie", aide: "Retire des unités du stock du lieu (usage interne, don…)." },
  perte: { libelle: "Perte", aide: "Retire des unités perdues, cassées ou volées." },
  ajustement: { libelle: "Ajustement", aide: "Fixe la quantité exacte présente dans le lieu." },
  bloquer: { libelle: "Bloquer", aide: "Les unités restent en stock mais ne sont plus vendables." },
  debloquer: { libelle: "Débloquer", aide: "Remet des unités bloquées à la vente." },
  endommager: { libelle: "Endommagé", aide: "Les unités abîmées restent en stock mais ne sont plus vendables." },
  reparer: { libelle: "Remis en état", aide: "Remet des unités abîmées à la vente." },
};
const LIBELLES_MOUVEMENT: Record<string, string> = {
  entree: "Entrée", sortie: "Sortie", ajustement: "Ajustement", perte: "Perte", vente: "Vente", retour: "Retour",
  transfert_sortie: "Transfert (départ)", transfert_entree: "Transfert (arrivée)", reception: "Réception", inventaire: "Inventaire",
};
const MODES: Partial<Record<ContexteScan, ModeFiche>> = { stock: "stock", prix: "prix", recherche: "complete" };

/** Recherche tapée → valeur stabilisée 300 ms plus tard. */
function useRetarde<T>(valeur: T, ms = 300): T {
  const [v, setV] = useState(valeur);
  useEffect(() => { const m = setTimeout(() => setV(valeur), ms); return () => clearTimeout(m); }, [valeur, ms]);
  return v;
}

function Ajustement({ produit, lieux, lieuDefaut, caisseId, onFermer, onFait }: { produit: Produit | null; lieux: Lieu[]; lieuDefaut: string; caisseId: string | null; onFermer: () => void; onFait: () => void }) {
  const t = useT();
  const [type, setType] = useState("entree");
  const [varianteId, setVarianteId] = useState("");
  const [entrepotId, setEntrepotId] = useState(lieuDefaut);
  const [quantite, setQuantite] = useState("");
  const [depuis, setDepuis] = useState("");
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  // Une clé par ouverture : un double appui ou un nouvel essai après coupure ne crée pas deux mouvements.
  const cle = useRef(nouvelleCle());
  useEffect(() => {
    if (!produit) return;
    cle.current = nouvelleCle();
    setType("entree"); setVarianteId(produit.variantes[0]?.id ?? ""); setEntrepotId(lieuDefaut); setQuantite(""); setDepuis(""); setMotif(""); setErreur(null);
  }, [produit, lieuDefaut]);
  if (!produit) return null;

  const auKilo = produit.uniteVente === "kg";
  const nombre = Number(quantite.replace(",", "."));
  // Article au poids : on saisit des kilos, le serveur compte en grammes.
  const entier = auKilo ? Math.round(nombre * 1000) : nombre;
  const valide = quantite.trim() !== "" && Number.isFinite(nombre) && Number.isInteger(entier) && (type === "ajustement" ? entier >= 0 : entier >= 1);
  const motifRequis = type !== "entree" && type !== "sortie";

  const envoyer = async () => {
    if (!valide) { setErreur(auKilo ? "Saisissez un poids valide, en kilos." : "Saisissez une quantité entière."); return; }
    if (motifRequis && motif.trim().length < 3) { setErreur("Indiquez le motif : il est conservé dans le journal d'audit."); return; }
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ stockLieu: number }>("/api/pos/stock", {
      method: "POST", caisseId,
      corps: { cle: cle.current, produitId: produit.id, varianteId: varianteId || null, entrepotId, type, ...(type === "ajustement" ? { nouveauStock: entier } : { quantite: entier }), depuis: depuis || null, motif: motif.trim() || null },
    });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    toast.success(r.rejoue ? t("Cet ajustement était déjà enregistré.") : t("Stock mis à jour : {0} dans ce lieu.", qte(r.donnees.stockLieu, produit.uniteVente, t.loc)));
    onFait();
  };

  return (
    <Modale ouverte onFermer={onFermer} titre="Ajuster le stock" description={produit.nom} verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={envoyer} charge={envoi}>{t("Enregistrer")}</Bouton></>}>
      <div className="space-y-3">
        <Champ label="Opération" aide={TYPES[type].aide}>
          {(a) => <select {...a} value={type} onChange={(e) => { setType(e.target.value); setDepuis(""); }} className={CLASSE_SAISIE}>{Object.entries(TYPES).map(([id, x]) => <option key={id} value={id}>{t(x.libelle)}</option>)}</select>}
        </Champ>
        {produit.variantes.length > 0 && (
          <Champ label="Variante">
            {(a) => <select {...a} value={varianteId} onChange={(e) => setVarianteId(e.target.value)} className={CLASSE_SAISIE}>{produit.variantes.map((v) => <option key={v.id} value={v.id}>{v.libelle} — {qte(v.stock, produit.uniteVente, t.loc)}</option>)}</select>}
          </Champ>
        )}
        {lieux.length > 1 && <SelectLieu label="Lieu" lieux={lieux} valeur={entrepotId} onChange={setEntrepotId} />}
        <Saisie label={type === "ajustement" ? "Quantité exacte présente" : "Quantité"} inputMode="decimal" value={quantite} onChange={(e) => setQuantite(e.target.value)} suffixe={auKilo ? "kg" : undefined} autoFocus />
        {(type === "sortie" || type === "perte") && (
          <Champ label="Prise sur" aide="Choisissez « bloquées » ou « endommagées » pour sortir des unités déjà mises de côté.">
            {(a) => <select {...a} value={depuis} onChange={(e) => setDepuis(e.target.value)} className={CLASSE_SAISIE}><option value="">{t("Le stock vendable")}</option><option value="bloque">{t("Les unités bloquées")}</option><option value="endommage">{t("Les unités endommagées")}</option></select>}
          </Champ>
        )}
        <Saisie label={motifRequis ? "Motif" : "Motif (facultatif)"} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder={t("Ex. : casse, contrôle qualité, erreur de saisie")} />
        {erreur && <p role="alert" className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

function Journal({ lieux, caisseId }: { lieux: Lieu[]; caisseId: string | null }) {
  const t = useT();
  const [type, setType] = useState("");
  const [entrepotId, setEntrepotId] = useState("");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [recherche, setRecherche] = useState("");
  const q = useRetarde(recherche);
  const [lignes, setLignes] = useState<Mouvement[]>([]);
  const [curseur, setCurseur] = useState<string | null>(null);
  const [etat, setEtat] = useState<{ charge: boolean; erreur: { code: string; message: string } | null }>({ charge: true, erreur: null });
  const tour = useRef(0);

  const charger = async (suite: string | null) => {
    const moi = ++tour.current;
    setEtat({ charge: true, erreur: null });
    const p = new URLSearchParams({ vue: "mouvements", ...(type ? { type } : {}), ...(entrepotId ? { entrepotId } : {}), ...(du ? { du } : {}), ...(au ? { au } : {}), ...(q ? { q } : {}), ...(suite ? { curseur: suite } : {}) });
    const r = await appelPos<{ mouvements: Mouvement[]; curseurSuivant: string | null }>(`/api/pos/stock?${p}`, { caisseId });
    if (moi !== tour.current) return;
    if (!r.ok) { setEtat({ charge: false, erreur: { code: r.code, message: r.message } }); return; }
    setLignes((l) => (suite ? [...l, ...r.donnees.mouvements] : r.donnees.mouvements)); setCurseur(r.donnees.curseurSuivant); setEtat({ charge: false, erreur: null });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void charger(null); }, [type, entrepotId, du, au, q, caisseId]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Saisie label="Article" type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} className="col-span-2 lg:col-span-1" />
        <Champ label="Type">{(a) => <select {...a} value={type} onChange={(e) => setType(e.target.value)} className={CLASSE_SAISIE}><option value="">{t("Tous")}</option>{Object.entries(LIBELLES_MOUVEMENT).map(([id, l]) => <option key={id} value={id}>{t(l)}</option>)}</select>}</Champ>
        <SelectLieu label="Lieu" lieux={lieux} valeur={entrepotId} onChange={setEntrepotId} tous="Tous les lieux" />
        <Saisie label="Du" type="date" value={du} onChange={(e) => setDu(e.target.value)} />
        <Saisie label="Au" type="date" value={au} onChange={(e) => setAu(e.target.value)} />
      </div>
      {etat.erreur ? <EtatPos code={etat.erreur.code} message={etat.erreur.message} onReessayer={() => charger(null)} />
        : !lignes.length && etat.charge ? <EtatChargement texte="Chargement du journal…" />
        : !lignes.length ? <EtatVide titre="Aucun mouvement" texte="Aucun mouvement de stock ne correspond à ces filtres." />
        : (
          <>
            <ul className="divide-y divide-[#F0F0F0] rounded-2xl border border-[#E8E8E8] bg-white">
              {lignes.map((m) => {
                const sens = m.stockApres - m.stockAvant;
                return (
                  <li key={m.id} className="flex items-center gap-3 p-3">
                    <Vignette src={m.produit.images[0]} taille={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-[#111111]">{m.produit.nom}{m.variante ? ` — ${m.variante}` : ""}</p>
                      <p className="text-[11.5px] text-[#666666]">
                        {[t(LIBELLES_MOUVEMENT[m.type] ?? m.type), m.entrepot, m.lot && `${t("lot")} ${m.lot}`, m.motif, m.auteur, jour(m.createdAt, t.loc, true)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={cn("text-[13px] font-bold tabular-nums", sens > 0 ? "text-[#15803D]" : sens < 0 ? "text-[#B91C1C]" : "text-[#111111]")}>{sens > 0 ? "+" : sens < 0 ? "−" : ""}{qte(m.quantite, m.uniteVente, t.loc)}</p>
                      <p className="text-[11px] tabular-nums text-[#888888]">{qte(m.stockAvant, m.uniteVente, t.loc)} → {qte(m.stockApres, m.uniteVente, t.loc)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            {curseur && <Bouton variante="secondaire" large charge={etat.charge} onClick={() => charger(curseur)}>{t("Afficher la suite")}</Bouton>}
          </>
        )}
    </div>
  );
}

export function EcranStock() {
  const t = useT();
  const { fmt } = useDevise();
  const [caisseId] = useCaisse();
  const [onglet, setOnglet] = useState<"articles" | "journal">("articles");
  const [recherche, setRecherche] = useState("");
  const q = useRetarde(recherche);
  const [filtre, setFiltre] = useState("all");
  const [entrepotId, setEntrepotId] = useState("");
  const [donnees, setDonnees] = useState<Reponse | null>(null);
  const [produits, setProduits] = useState<Produit[]>([]);
  const [etat, setEtat] = useState<{ charge: boolean; erreur: { code: string; message: string } | null }>({ charge: true, erreur: null });
  const [ajuste, setAjuste] = useState<Produit | null>(null);
  const [fiche, setFiche] = useState<{ code?: string; produitId?: string; mode: ModeFiche } | null>(null);
  const tour = useRef(0);

  const charger = async (suite: string | null) => {
    const moi = ++tour.current;
    setEtat({ charge: true, erreur: null });
    const p = new URLSearchParams({ filtre, ...(q ? { q } : {}), ...(entrepotId ? { entrepotId } : {}), ...(suite ? { curseur: suite } : {}) });
    const r = await appelPos<Reponse>(`/api/pos/stock?${p}`, { caisseId });
    if (moi !== tour.current) return;
    if (!r.ok) { setEtat({ charge: false, erreur: { code: r.code, message: r.message } }); return; }
    setDonnees(r.donnees); setProduits((l) => (suite ? [...l, ...r.donnees.produits] : r.donnees.produits)); setEtat({ charge: false, erreur: null });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void charger(null); }, [q, filtre, entrepotId, caisseId]);

  const lieux = donnees?.lieux ?? [];
  const stats = donnees?.stats;
  const bouton = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#E8E8E8] bg-white px-3 text-[12px] font-bold text-[#111111] hover:border-[#F5A623] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]";

  return (
    <Page>
      <EnTete titre="Gestion des stocks" sousTitre="Ce qui est physiquement là, ce qui est réservé, bloqué ou abîmé, et ce qui reste vraiment à vendre — par magasin et par entrepôt.">
        <PosteScan contexte="stock" contextes={["stock", "prix", "recherche"]} caisseId={caisseId} libelle="Contrôler un article"
          onScan={(s) => setFiche({ code: s.code, mode: MODES[s.contexte ?? "stock"] ?? "stock" })} />
        <Bouton variante="secondaire" href="/dashboard/pos/fiche" icone={<FileSearch size={15} aria-hidden />}>{t("Fiche produit")}</Bouton>
      </EnTete>

      {stats && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre label="Articles suivis" valeur={stats.total.toLocaleString(t.loc)} />
          <Chiffre label="Stock bas" valeur={stats.stockBas.toLocaleString(t.loc)} />
          <Chiffre label="En rupture" valeur={stats.enRupture.toLocaleString(t.loc)} ton={stats.enRupture ? "danger" : undefined} />
          {stats.valeurStock !== null ? <Chiffre label="Valeur du stock" valeur={fmt(stats.valeurStock)} aide="Au prix d'achat" /> : <Chiffre label="Valeur du stock" valeur="—" aide="Réservée aux personnes autorisées à voir les coûts" />}
        </div>
      )}

      <Onglets label="Vue du stock" actif={onglet} onChange={setOnglet} onglets={[{ id: "articles", libelle: "Articles" }, { id: "journal", libelle: "Journal des mouvements" }]} />

      {onglet === "journal" ? <Journal lieux={lieux} caisseId={caisseId} /> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Champ label="Rechercher" className="col-span-2">
              {(a) => (
                <div className="relative">
                  <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" aria-hidden />
                  <input {...a} type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("Nom, référence ou code-barres")} className={cn(CLASSE_SAISIE, "pl-9")} />
                </div>
              )}
            </Champ>
            <SelectLieu label="Lieu" lieux={lieux} valeur={entrepotId} onChange={setEntrepotId} tous="Toute la boutique" />
            <Champ label="Afficher">
              {(a) => <select {...a} value={filtre} onChange={(e) => setFiltre(e.target.value)} className={CLASSE_SAISIE}><option value="all">{t("Tous les articles")}</option><option value="bas">{t("Stock bas")}</option><option value="rupture">{t("En rupture")}</option></select>}
            </Champ>
          </div>

          {etat.erreur ? <EtatPos code={etat.erreur.code} message={etat.erreur.message} onReessayer={() => charger(null)} />
            : !produits.length && etat.charge ? <EtatChargement texte="Chargement du stock…" />
            : !produits.length ? <EtatVide titre="Aucun article" texte={q || filtre !== "all" ? "Aucun article ne correspond à cette recherche." : "Aucun article physique actif dans cette boutique."} />
            : (
              <>
                <ul className={cn("space-y-2 transition-opacity", etat.charge && "opacity-60")} aria-busy={etat.charge}>
                  {produits.map((p) => (
                    <li key={p.id} className="rounded-2xl border border-[#E8E8E8] bg-white p-3 sm:p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Vignette src={p.image} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-bold text-[#111111]">{p.nom}</p>
                          <p className="truncate text-[11.5px] text-[#666666]">{[p.sku, p.codeBarres, p.categorie].filter(Boolean).join(" · ") || t("Sans référence")}</p>
                        </div>
                        {p.statutStock === "rupture" ? <Badge ton="danger">{t("Rupture")}</Badge> : p.statutStock === "bas" ? <Badge ton="attention">{t("Stock bas")}</Badge> : null}
                        <div className="flex w-full gap-2 sm:w-auto">
                          <button type="button" className={bouton} onClick={() => setFiche({ produitId: p.id, mode: "complete" })}><FileSearch size={14} aria-hidden />{t("Fiche")}</button>
                          {donnees?.droits.ajuster && <button type="button" className={bouton} onClick={() => setAjuste(p)}><SlidersHorizontal size={14} aria-hidden />{t("Ajuster")}</button>}
                        </div>
                      </div>
                      <div className="mt-3"><GrilleEtats etats={p.etats} unite={p.uniteVente} compact /></div>
                      {p.variantes.length > 0 && (
                        <details className="group mt-2">
                          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg text-[12px] font-semibold text-[#B45309] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111]">
                            <ChevronDown size={14} className="transition-transform group-open:rotate-180" aria-hidden />{t("{0} variantes", p.variantes.length)}
                          </summary>
                          <ul className="space-y-2">
                            {p.variantes.map((v) => (
                              <li key={v.id}>
                                <p className="mb-1 text-[12px] font-semibold text-[#111111]">{v.libelle}<span className="font-normal text-[#888888]">{v.sku ? ` · ${v.sku}` : ""}</span></p>
                                <GrilleEtats etats={v.etats} unite={p.uniteVente} compact />
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  ))}
                </ul>
                {donnees?.curseurSuivant && <Bouton variante="secondaire" large charge={etat.charge} onClick={() => charger(donnees.curseurSuivant)}>{t("Afficher la suite")}</Bouton>}
              </>
            )}
          <p className="flex items-center gap-1.5 text-[11.5px] text-[#888888]"><History size={13} aria-hidden />{t("Disponible = physique − réservé − bloqué − endommagé. « En transit » : expédié par transfert, pas encore reçu. « En commande » : attendu d'un fournisseur.")}</p>
        </>
      )}

      <Ajustement produit={ajuste} lieux={lieux} lieuDefaut={entrepotId || donnees?.lieuCourant || ""} caisseId={caisseId} onFermer={() => setAjuste(null)} onFait={() => { setAjuste(null); void charger(null); }} />
      <Tiroir ouverte={!!fiche} onFermer={() => setFiche(null)} titre={fiche?.mode === "prix" ? "Contrôle prix" : fiche?.mode === "stock" ? "Contrôle stock" : "Fiche produit"} largeur="lg">
        {fiche && <FicheProduit code={fiche.code} produitId={fiche.produitId} mode={fiche.mode} caisseId={caisseId} />}
      </Tiroir>
    </Page>
  );
}
