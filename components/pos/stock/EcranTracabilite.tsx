"use client";
// Écran « Traçabilité » : lots et dates d'expiration (§14), numéros de série
// et IMEI (§12).
// - Lots : réception, coût, fournisseur, entrepôt, alertes (expire bientôt,
//   expiré, bloqué), blocage / déblocage avec motif, péremption, rappel.
// - Numéros de série : enregistrement, recherche par numéro, statut, garantie,
//   client et date d'achat, historique, blocage.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Search } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Modale, Saisie, Tiroir } from "@/components/pos/ui";
import { cn } from "@/lib/utils";
import { ETATS_LOT, STATUTS_SERIE } from "./FicheProduit";
import { appelPos, Carte, Chiffre, ChoixArticle, EnTete, jour, nouvelleCle, Onglets, Page, PosteScan, qte, SelectLieu, useCaisse, useLecture, Vignette, type ArticleChoisi, type Lieu } from "./commun";

type Lieux = { lieux: Lieu[]; lieuCourant: string; droits: { ajuster: boolean; reception: boolean; couts: boolean } };
type Lot = {
  id: string; codeLot: string; produit: { nom: string; images: string[]; sku: string | null; uniteVente: string }; quantiteInitiale: number; quantiteRestante: number;
  dateReception: string; dateExpiration: string | null; statut: string; etat: string; joursRestants: number | null; cout: number | null;
  fournisseurNom: string | null; entrepotNom: string | null; certification: string | null;
};
type Lots = { lots: Lot[]; curseurSuivant: string | null; stats: { actifs: number; bloques: number; expires: number; expirantBientot: number }; seuilJours: number; coutsVisibles: boolean };
type Serie = {
  id: string; numero: string; statut: string; produitNom: string; variante: string | null; image: string | null; entrepotNom: string | null; venteNumero: string | null;
  client: { nom: string; telephone: string | null } | null; venduAt: string | null; garantieFinAt: string | null; garantie: "aucune" | "en_cours" | "expiree"; garantieMois: number | null;
};
type Series = { series: Serie[]; curseurSuivant: string | null; stats: Record<string, number> };

function useRetarde(valeur: string): string {
  const [v, setV] = useState(valeur);
  useEffect(() => { const m = setTimeout(() => setV(valeur.trim()), 300); return () => clearTimeout(m); }, [valeur]);
  return v;
}

/** Confirmation d'une action qui demande un motif (blocage, rappel…). */
function Motif({ titre, description, requis, bouton, danger, onValider, onFermer }: { titre: string; description: string; requis: boolean; bouton: string; danger?: boolean; onValider: (motif: string) => Promise<string | null>; onFermer: () => void }) {
  const t = useT();
  const [motif, setMotif] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const valider = async () => {
    if (requis && motif.trim().length < 3) { setErreur("Indiquez le motif : il est conservé dans le journal d'audit."); return; }
    setEnvoi(true);
    const e = await onValider(motif.trim());
    setEnvoi(false);
    if (e) setErreur(e);
  };
  return (
    <Modale ouverte onFermer={onFermer} titre={titre} description={description} taille="sm" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Retour")}</Bouton><Bouton variante={danger ? "danger" : "primaire"} onClick={valider} charge={envoi}>{t(bouton)}</Bouton></>}>
      <Saisie label={requis ? "Motif" : "Motif (facultatif)"} value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} erreur={erreur} autoFocus />
    </Modale>
  );
}

// ─── Lots ─────────────────────────────────────────────────────────────────────

const ACTIONS_LOT: Record<string, { libelle: string; titre: string; description: string; requis: boolean; danger?: boolean }> = {
  bloquer: { libelle: "Bloquer", titre: "Bloquer ce lot ?", description: "Le lot ne sera plus vendu et sa quantité sort du stock disponible, jusqu'à son déblocage.", requis: true },
  debloquer: { libelle: "Débloquer", titre: "Débloquer ce lot ?", description: "Le lot redevient vendable.", requis: true },
  perime: { libelle: "Périmé", titre: "Déclarer ce lot périmé ?", description: "Ce qui reste du lot est retiré du stock (mouvement « perte »). C'est définitif.", requis: false, danger: true },
  rappele: { libelle: "Rappeler", titre: "Rappeler ce lot ?", description: "Ce qui reste du lot est retiré du stock. Les ventes déjà faites sur ce lot restent consultables. C'est définitif.", requis: true, danger: true },
  epuise: { libelle: "Marquer épuisé", titre: "Marquer ce lot épuisé ?", description: "Le lot est clos sans toucher au stock : à utiliser quand il ne reste plus rien en rayon.", requis: false },
};

function NouveauLot({ lieux, caisseId, onFait, onFermer }: { lieux: Lieux | null; caisseId: string | null; onFait: () => void; onFermer: () => void }) {
  const t = useT();
  const [article, setArticle] = useState<ArticleChoisi | null>(null);
  const [f, setF] = useState({ codeLot: "", quantite: "", cout: "", fournisseurNom: "", dateExpiration: "", certification: "" });
  const [entrepotId, setEntrepotId] = useState(lieux?.lieuCourant ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());
  const champ = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF((v) => ({ ...v, [k]: e.target.value })) });

  const creer = async () => {
    const n = Number(f.quantite.replace(",", "."));
    const quantite = article?.uniteVente === "kg" ? Math.round(n * 1000) : n;
    const cout = f.cout.trim() ? Number(f.cout.replace(/\s/g, "").replace(",", ".")) : null;
    if (!article) { setErreur("Choisissez l'article reçu."); return; }
    if (!f.codeLot.trim()) { setErreur("Donnez un code au lot."); return; }
    if (!Number.isInteger(quantite) || quantite < 1) { setErreur("Indiquez la quantité reçue."); return; }
    if (cout !== null && !(cout >= 0)) { setErreur("Le coût unitaire n'est pas un montant valide."); return; }
    setEnvoi(true); setErreur(null);
    const r = await appelPos("/api/pos/lots", { method: "POST", caisseId, corps: { cle: cle.current, produitId: article.produitId, varianteId: article.varianteId, codeLot: f.codeLot.trim(), quantite, cout, fournisseurNom: f.fournisseurNom.trim() || null, entrepotId: entrepotId || null, dateExpiration: f.dateExpiration || null, certification: f.certification.trim() || null } });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    toast.success(t("Lot enregistré : le stock a été crédité."));
    onFait();
  };

  return (
    <Modale ouverte onFermer={onFermer} titre="Réceptionner un lot" description="Le lot est créé et sa quantité entre dans le stock du lieu choisi." taille="lg" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={creer} charge={envoi}>{t("Enregistrer le lot")}</Bouton></>}>
      <div className="space-y-3">
        {article
          ? <p className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF7ED] px-3 py-2 text-[13px] font-semibold text-[#111111]">{article.nom}{article.variante ? ` — ${article.variante}` : ""}<button type="button" onClick={() => setArticle(null)} className={cn("min-h-11 px-2 text-[12px] text-[#B45309] underline", FOCUS)}>{t("Changer")}</button></p>
          : <ChoixArticle label="Article reçu" caisseId={caisseId} onChoisir={setArticle} />}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Saisie label="Code du lot" placeholder="LOT-2026-001" maxLength={80} {...champ("codeLot")} />
          <Saisie label="Quantité reçue" inputMode="decimal" suffixe={article?.uniteVente === "kg" ? "kg" : undefined} {...champ("quantite")} />
          <Saisie label="Date d'expiration" type="date" {...champ("dateExpiration")} />
          {lieux?.droits.couts && <Saisie label="Coût unitaire d'achat" inputMode="decimal" aide={article?.uniteVente === "kg" ? "Au kilo." : undefined} {...champ("cout")} />}
          <Saisie label="Fournisseur" maxLength={160} {...champ("fournisseurNom")} />
          <Saisie label="Certificat ou origine" maxLength={200} {...champ("certification")} />
          {lieux && lieux.lieux.length > 1 && <SelectLieu label="Lieu de stockage" lieux={lieux.lieux} valeur={entrepotId} onChange={setEntrepotId} />}
        </div>
        {erreur && <p role="alert" className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

function VueLots({ lieux, caisseId }: { lieux: Lieux | null; caisseId: string | null }) {
  const t = useT();
  const { fmt } = useDevise();
  const [filtre, setFiltre] = useState("statut:actif");
  const [recherche, setRecherche] = useState("");
  const q = useRetarde(recherche);
  const [sorte, valeur] = filtre.split(":");
  const base = `/api/pos/lots?${sorte}=${valeur}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  const { donnees, erreur, charge, recharger } = useLecture<Lots>(base, caisseId);
  const [suite, setSuite] = useState<{ lots: Lot[]; curseur: string | null }>({ lots: [], curseur: null });
  useEffect(() => { setSuite({ lots: [], curseur: donnees?.curseurSuivant ?? null }); }, [donnees]);
  const [nouveau, setNouveau] = useState(false);
  const [action, setAction] = useState<{ lot: Lot; id: string } | null>(null);
  const cle = useRef(nouvelleCle());

  const agir = async (motif: string): Promise<string | null> => {
    if (!action) return null;
    const r = await appelPos<{ stockRetire: number; avertissement: string | null }>(`/api/pos/lots/${action.lot.id}`, { method: "PATCH", caisseId, corps: { cle: cle.current, action: action.id, motif: motif || null } });
    if (!r.ok) { if (r.code === "conflit") { setAction(null); void recharger(); toast.error(t(r.message)); return null; } return r.message; }
    cle.current = nouvelleCle();
    toast.success(r.donnees.stockRetire ? t("Lot mis à jour : {0} retiré(s) du stock.", qte(r.donnees.stockRetire, action.lot.produit.uniteVente, t.loc)) : t("Lot mis à jour."));
    if (r.donnees.avertissement) toast.warning(t(r.donnees.avertissement));
    setAction(null); void recharger();
    return null;
  };
  const s = donnees?.stats;
  const lots = [...(donnees?.lots ?? []), ...suite.lots];
  const boutons = (l: Lot) => (l.statut === "actif" ? ["bloquer", "perime", "rappele", "epuise"] : l.statut === "bloque" ? ["debloquer", "perime", "rappele"] : []);

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Chiffre label="Lots actifs" valeur={s.actifs.toLocaleString(t.loc)} />
          <Chiffre label={t("Expirent sous {0} jours", donnees!.seuilJours)} valeur={s.expirantBientot.toLocaleString(t.loc)} />
          <Chiffre label="Expirés, encore en stock" valeur={s.expires.toLocaleString(t.loc)} ton={s.expires ? "danger" : undefined} />
          <Chiffre label="Lots bloqués" valeur={s.bloques.toLocaleString(t.loc)} ton={s.bloques ? "danger" : undefined} />
        </div>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <Champ label="Afficher" className="w-full sm:w-64">
          {(a) => (
            <select {...a} value={filtre} onChange={(e) => setFiltre(e.target.value)} className={CLASSE_SAISIE}>
              <optgroup label={t("Alertes")}><option value="alerte:expire">{t("Expirés, encore en stock")}</option><option value="alerte:expire_bientot">{t("Expirent bientôt")}</option><option value="alerte:bloque">{t("Bloqués")}</option></optgroup>
              <optgroup label={t("Statut")}><option value="statut:actif">{t("Actifs")}</option><option value="statut:all">{t("Tous les lots")}</option><option value="statut:epuise">{t("Épuisés")}</option><option value="statut:perime">{t("Périmés")}</option><option value="statut:rappele">{t("Rappelés")}</option></optgroup>
            </select>
          )}
        </Champ>
        <Saisie label="Rechercher" type="search" placeholder={t("Code de lot ou article")} value={recherche} onChange={(e) => setRecherche(e.target.value)} className="min-w-0 flex-1" />
        {(lieux?.droits.reception || lieux?.droits.ajuster) && <Bouton onClick={() => setNouveau(true)} icone={<Plus size={15} aria-hidden />}>{t("Nouveau lot")}</Bouton>}
      </div>

      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement texte="Chargement des lots…" />
        : !lots.length ? <EtatVide titre="Aucun lot" texte="Aucun lot ne correspond à ce filtre." />
        : (
          <ul className={cn("space-y-2", charge && "opacity-60")}>
            {lots.map((l) => (
              <li key={l.id} className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
                <div className="flex items-start gap-3">
                  <Vignette src={l.produit.images[0]} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-[#111111]">{l.produit.nom}<Badge ton={ETATS_LOT[l.etat]?.ton ?? "neutre"}>{t(ETATS_LOT[l.etat]?.libelle ?? l.etat)}</Badge></p>
                    <p className="mt-0.5 text-[12px] text-[#666666]">
                      {t("Lot")} <span className="font-mono font-bold text-[#B45309]">{l.codeLot}</span> · {t("reste {0} sur {1}", qte(l.quantiteRestante, l.produit.uniteVente, t.loc), qte(l.quantiteInitiale, l.produit.uniteVente, t.loc))}
                      {l.dateExpiration ? ` · ${t("expire le {0}", jour(l.dateExpiration, t.loc))}${l.joursRestants !== null && l.statut === "actif" ? ` (${l.joursRestants >= 0 ? t("dans {0} j", l.joursRestants) : t("depuis {0} j", -l.joursRestants)})` : ""}` : ""}
                    </p>
                    <p className="text-[11.5px] text-[#888888]">{[t("reçu le {0}", jour(l.dateReception, t.loc)), l.fournisseurNom, l.entrepotNom, l.cout !== null && t("coût {0}", fmt(l.cout)), l.certification].filter(Boolean).join(" · ")}</p>
                  </div>
                </div>
                {lieux?.droits.ajuster && boutons(l).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {boutons(l).map((a) => <Bouton key={a} taille="compact" variante={ACTIONS_LOT[a].danger ? "danger" : "secondaire"} onClick={() => setAction({ lot: l, id: a })}>{t(ACTIONS_LOT[a].libelle)}</Bouton>)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      {suite.curseur && <Bouton variante="secondaire" large onClick={async () => { const r = await appelPos<Lots>(`${base}&curseur=${suite.curseur}`, { caisseId }); if (r.ok) setSuite((x) => ({ lots: [...x.lots, ...r.donnees.lots], curseur: r.donnees.curseurSuivant })); else toast.error(t(r.message)); }}>{t("Afficher la suite")}</Bouton>}
      <p className="text-[11.5px] text-[#888888]">{t("La caisse vend d'abord le lot qui expire le plus tôt (FEFO). Un lot bloqué, périmé ou rappelé n'est jamais vendu.")}</p>

      {nouveau && <NouveauLot lieux={lieux} caisseId={caisseId} onFermer={() => setNouveau(false)} onFait={() => { setNouveau(false); void recharger(); }} />}
      {action && <Motif key={action.lot.id + action.id} titre={ACTIONS_LOT[action.id].titre} description={`${action.lot.produit.nom} — ${action.lot.codeLot}. ${t(ACTIONS_LOT[action.id].description)}`} requis={ACTIONS_LOT[action.id].requis} danger={ACTIONS_LOT[action.id].danger} bouton={ACTIONS_LOT[action.id].libelle} onValider={agir} onFermer={() => setAction(null)} />}
    </div>
  );
}

// ─── Numéros de série ─────────────────────────────────────────────────────────

const ACTIONS_SERIE: Record<string, { libelle: string; depuis: string[]; description: string; danger?: boolean }> = {
  bloquer: { libelle: "Bloquer", depuis: ["en_stock", "retourne"], description: "Le numéro ne pourra plus être vendu tant qu'il est bloqué." },
  debloquer: { libelle: "Débloquer", depuis: ["bloque"], description: "Le numéro redevient vendable." },
  defectueux: { libelle: "Déclarer défectueux", depuis: ["en_stock", "retourne", "bloque"], description: "Le numéro ne pourra plus être vendu.", danger: true },
  remettre_en_stock: { libelle: "Remettre en stock", depuis: ["retourne", "defectueux"], description: "Le numéro redevient vendable." },
};

function NouvellesSeries({ lieux, caisseId, onFait, onFermer }: { lieux: Lieux | null; caisseId: string | null; onFait: () => void; onFermer: () => void }) {
  const t = useT();
  const [article, setArticle] = useState<ArticleChoisi | null>(null);
  const [numeros, setNumeros] = useState("");
  const [activer, setActiver] = useState(false);
  const [garantie, setGarantie] = useState("");
  const [entrepotId, setEntrepotId] = useState(lieux?.lieuCourant ?? "");
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const cle = useRef(nouvelleCle());
  const liste = [...new Set(numeros.split(/[\n,;]+/).map((n) => n.trim()).filter(Boolean))];

  const enregistrer = async () => {
    if (!article) { setErreur("Choisissez l'article."); return; }
    if (!liste.length) { setErreur("Scannez ou saisissez au moins un numéro."); return; }
    if (!article.suiviSerie && !activer) { setErreur("Cet article n'est pas encore suivi par numéro de série : cochez la case pour activer le suivi."); return; }
    setEnvoi(true); setErreur(null);
    const r = await appelPos<{ enregistres: number }>("/api/pos/series", { method: "POST", caisseId, corps: { cle: cle.current, produitId: article.produitId, varianteId: article.varianteId, numeros: liste, entrepotId: entrepotId || null, activerSuivi: activer || undefined, garantieMois: garantie.trim() ? Math.floor(Number(garantie)) : undefined } });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); return; }
    toast.success(t("{0} numéro(s) enregistré(s).", r.donnees.enregistres));
    onFait();
  };

  return (
    <Modale ouverte onFermer={onFermer} titre="Enregistrer des numéros de série" description="Identifie des unités déjà en stock. Cela n'ajoute pas de stock : c'est la réception ou un ajustement qui le fait." taille="lg" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={enregistrer} charge={envoi}>{t("Enregistrer {0} numéro(s)", liste.length)}</Bouton></>}>
      <div className="space-y-3">
        {article
          ? <p className="flex items-center justify-between gap-2 rounded-xl bg-[#FFF7ED] px-3 py-2 text-[13px] font-semibold text-[#111111]">{article.nom}{article.variante ? ` — ${article.variante}` : ""}<button type="button" onClick={() => setArticle(null)} className={cn("min-h-11 px-2 text-[12px] text-[#B45309] underline", FOCUS)}>{t("Changer")}</button></p>
          : <ChoixArticle label="Article" caisseId={caisseId} onChoisir={(a) => { setArticle(a); setActiver(false); }} />}
        {article && !article.suiviSerie && (
          <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] text-[#92400E]">
            <input type="checkbox" checked={activer} onChange={(e) => setActiver(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>{t("Activer le suivi par numéro de série pour cet article. La caisse demandera alors un numéro à chaque vente, une unité par ligne.")}</span>
          </label>
        )}
        <Champ label="Numéros de série ou IMEI" aide="Un numéro par ligne. Le bouton Scanner et la douchette ajoutent chaque code lu à la liste.">
          {(a) => <textarea {...a} value={numeros} onChange={(e) => setNumeros(e.target.value)} rows={5} className={cn(CLASSE_SAISIE, "font-mono")} />}
        </Champ>
        <div className="flex flex-wrap items-end gap-3">
          <PosteScan contexte="reception" caisseId={caisseId} onScan={(s) => setNumeros((n) => (n.trim() ? `${n.trim()}\n${s.code}` : s.code))} libelle="Scanner un numéro" />
          <Saisie label="Garantie (mois)" inputMode="numeric" value={garantie} onChange={(e) => setGarantie(e.target.value)} className="w-36" aide="Vide : inchangée." />
          {lieux && lieux.lieux.length > 1 && <SelectLieu label="Lieu" lieux={lieux.lieux} valeur={entrepotId} onChange={setEntrepotId} className="min-w-40 flex-1" />}
        </div>
        {erreur && <p role="alert" className="rounded-xl bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

function DetailSerie({ id, lieux, caisseId, onFermer, onChange }: { id: string; lieux: Lieux | null; caisseId: string | null; onFermer: () => void; onChange: () => void }) {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<{ serie: Serie; historique: { date: string; libelle: string; detail: string | null; auteur: string | null }[] }>(`/api/pos/series/${id}`, caisseId);
  const [action, setAction] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());
  const s = donnees?.serie;
  const agir = async (motif: string): Promise<string | null> => {
    const r = await appelPos(`/api/pos/series/${id}`, { method: "PATCH", caisseId, corps: { cle: cle.current, action, motif } });
    if (!r.ok) return r.message;
    cle.current = nouvelleCle();
    toast.success(t("Numéro mis à jour."));
    setAction(null); void recharger(); onChange();
    return null;
  };
  return (
    <Tiroir ouverte onFermer={onFermer} titre="Numéro de série">
      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} compact /> : !s ? <EtatChargement compact /> : (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Vignette src={s.image} taille={48} />
            <div className="min-w-0">
              <p className="break-all font-mono text-[15px] font-bold text-[#111111]">{s.numero}</p>
              <p className="text-[12.5px] text-[#666666]">{s.produitNom}{s.variante ? ` — ${s.variante}` : ""}</p>
            </div>
          </div>
          <dl className="space-y-1.5 text-[13px]">
            {([
              ["Statut", <Badge key="s" ton={STATUTS_SERIE[s.statut]?.ton ?? "neutre"}>{t(STATUTS_SERIE[s.statut]?.libelle ?? s.statut)}</Badge>],
              ["Lieu", s.entrepotNom ?? t("Non localisé")],
              ["Date d'achat", s.venduAt ? jour(s.venduAt, t.loc) : "—"],
              ["Client", s.client ? `${s.client.nom}${s.client.telephone ? ` · ${s.client.telephone}` : ""}` : s.venduAt ? t("Client comptoir") : "—"],
              ["Vente", s.venteNumero ? `#${s.venteNumero}` : "—"],
              ["Garantie", s.garantie === "aucune" ? (s.garantieMois ? t("{0} mois à compter de la vente", s.garantieMois) : t("Aucune garantie enregistrée")) : `${t("jusqu'au {0}", jour(s.garantieFinAt, t.loc))} — ${t(s.garantie === "en_cours" ? "en cours" : "expirée")}`],
            ] as [string, React.ReactNode][]).map(([libelle, valeur]) => (
              <div key={libelle} className="flex items-baseline justify-between gap-3"><dt className="text-[#666666]">{t(libelle)}</dt><dd className="text-right font-semibold text-[#111111]">{valeur}</dd></div>
            ))}
          </dl>
          {lieux?.droits.ajuster && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(ACTIONS_SERIE).filter(([, a]) => a.depuis.includes(s.statut)).map(([k, a]) => <Bouton key={k} taille="compact" variante={a.danger ? "danger" : "secondaire"} onClick={() => setAction(k)}>{t(a.libelle)}</Bouton>)}
              {s.statut === "vendu" && <p className="text-[12px] text-[#666666]">{t("Un numéro vendu ne change d'état que par un retour ou l'annulation de la vente.")}</p>}
            </div>
          )}
          <Carte titre="Historique">
            <ol className="space-y-2">
              {donnees!.historique.map((h, i) => (
                <li key={i} className="border-l-2 border-[#F5A623] pl-3 text-[12.5px]">
                  <p className="font-semibold text-[#111111]">{t(h.libelle)}</p>
                  <p className="text-[11.5px] text-[#666666]">{[jour(h.date, t.loc, true), h.auteur, h.detail].filter(Boolean).join(" · ")}</p>
                </li>
              ))}
            </ol>
          </Carte>
        </div>
      )}
      {action && s && <Motif titre={ACTIONS_SERIE[action].libelle} description={`${s.numero}. ${t(ACTIONS_SERIE[action].description)}`} requis danger={ACTIONS_SERIE[action].danger} bouton={ACTIONS_SERIE[action].libelle} onValider={agir} onFermer={() => setAction(null)} />}
    </Tiroir>
  );
}

function VueSeries({ lieux, caisseId }: { lieux: Lieux | null; caisseId: string | null }) {
  const t = useT();
  const [statut, setStatut] = useState("");
  const [recherche, setRecherche] = useState("");
  const q = useRetarde(recherche);
  const base = `/api/pos/series?${new URLSearchParams({ ...(statut ? { statut } : {}), ...(q ? { q } : {}) })}`;
  const { donnees, erreur, charge, recharger } = useLecture<Series>(base, caisseId);
  const [suite, setSuite] = useState<{ series: Serie[]; curseur: string | null }>({ series: [], curseur: null });
  useEffect(() => { setSuite({ series: [], curseur: donnees?.curseurSuivant ?? null }); }, [donnees]);
  const [nouveau, setNouveau] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const series = [...(donnees?.series ?? []), ...suite.series];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <Champ label="Numéro de série ou IMEI" className="min-w-0 flex-1">
          {(a) => (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#AAAAAA]" aria-hidden />
              <input {...a} type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder={t("Numéro, IMEI ou article")} className={cn(CLASSE_SAISIE, "pl-9 font-mono")} />
            </div>
          )}
        </Champ>
        <Champ label="Statut" className="w-full sm:w-48">
          {(a) => <select {...a} value={statut} onChange={(e) => setStatut(e.target.value)} className={CLASSE_SAISIE}><option value="">{t("Tous")}</option>{Object.entries(STATUTS_SERIE).map(([k, x]) => <option key={k} value={k}>{t(x.libelle)}{donnees?.stats[k] ? ` (${donnees.stats[k]})` : ""}</option>)}</select>}
        </Champ>
        {/* Le poste de scan de la recherche se tait quand la fenêtre d'enregistrement a le sien. */}
        {!nouveau && <PosteScan contexte="recherche" caisseId={caisseId} onScan={(s) => setRecherche(s.code)} libelle="Scanner" />}
        {(lieux?.droits.reception || lieux?.droits.ajuster) && <Bouton onClick={() => setNouveau(true)} icone={<Plus size={15} aria-hidden />}>{t("Enregistrer")}</Bouton>}
      </div>
      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement texte="Chargement des numéros…" />
        : !series.length ? <EtatVide titre="Aucun numéro" texte={q ? "Aucun numéro de série ne correspond. Un numéro inconnu est créé automatiquement à sa première vente." : "Aucun numéro de série n'est encore enregistré."} />
        : (
          <ul className={cn("divide-y divide-[#F0F0F0] rounded-2xl border border-[#E8E8E8] bg-white", charge && "opacity-60")}>
            {series.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setDetail(s.id)} className={cn("flex min-h-11 w-full flex-wrap items-center justify-between gap-2 p-3 text-left hover:bg-[#FFF7ED]", FOCUS)}>
                  <span className="min-w-0">
                    <span className="block break-all font-mono text-[13px] font-bold text-[#111111]">{s.numero}</span>
                    <span className="block text-[11.5px] text-[#666666]">{[`${s.produitNom}${s.variante ? ` — ${s.variante}` : ""}`, s.client?.nom, s.venduAt && t("acheté le {0}", jour(s.venduAt, t.loc)), s.garantie !== "aucune" && `${t("garantie")} ${t(s.garantie === "en_cours" ? "en cours" : "expirée")}`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <Badge ton={STATUTS_SERIE[s.statut]?.ton ?? "neutre"}>{t(STATUTS_SERIE[s.statut]?.libelle ?? s.statut)}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      {suite.curseur && <Bouton variante="secondaire" large onClick={async () => { const r = await appelPos<Series>(`${base}${base.endsWith("?") ? "" : "&"}curseur=${suite.curseur}`, { caisseId }); if (r.ok) setSuite((x) => ({ series: [...x.series, ...r.donnees.series], curseur: r.donnees.curseurSuivant })); else toast.error(t(r.message)); }}>{t("Afficher la suite")}</Bouton>}
      {nouveau && <NouvellesSeries lieux={lieux} caisseId={caisseId} onFermer={() => setNouveau(false)} onFait={() => { setNouveau(false); void recharger(); }} />}
      {detail && <DetailSerie id={detail} lieux={lieux} caisseId={caisseId} onFermer={() => setDetail(null)} onChange={recharger} />}
    </div>
  );
}

export function EcranTracabilite() {
  const [caisseId] = useCaisse();
  const [onglet, setOnglet] = useState<"lots" | "series">("lots");
  const lieux = useLecture<Lieux>("/api/pos/stock?vue=lieux", caisseId);
  return (
    <Page>
      <EnTete titre="Traçabilité" sousTitre="Lots, dates d'expiration et rappels ; numéros de série, IMEI et garanties." />
      <Onglets label="Traçabilité" actif={onglet} onChange={setOnglet} onglets={[{ id: "lots", libelle: "Lots et expiration" }, { id: "series", libelle: "Numéros de série" }]} />
      {onglet === "lots" ? <VueLots lieux={lieux.donnees} caisseId={caisseId} /> : <VueSeries lieux={lieux.donnees} caisseId={caisseId} />}
    </Page>
  );
}
