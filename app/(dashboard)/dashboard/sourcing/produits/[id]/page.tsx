"use client";
// Espace de travail d'un produit sourcé, dans l'ordre du parcours : analyser,
// fixer le coût et le prix, demander l'avis du copilote, préparer le test et la
// publicité, puis faire grandir le produit (feuille de route jusqu'à la marque).
// Tout texte généré par IA est affiché avec son avertissement : ce sont des
// hypothèses, jamais des données de marché.
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Star, Trash2, Sparkles, Copy, Check, AlertTriangle, ChevronLeft, ChevronRight, ExternalLink, Flame } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { MODES_APPRO, ETAPES_PRODUIT, ETAPES_GAGNANTES, type ContexteCalcul, type Evaluation, type ParametresCout } from "@/lib/sourcing/produit-source";
import type { Tarification } from "@/lib/sourcing/rentabilite";
import { CRITERES_ESTIMES } from "@/lib/sourcing/score";
import { DEVISES_FOURNISSEUR } from "@/lib/sourcing/pays";
import type { AnalyseCopilote, KitTest, VariantePub } from "@/lib/sourcing/ia";
import { Page, Carte, Pastille, PastilleIntegration, Estimation, Bouton, Champ, ChampNombre, CLASSE_CHAMP, Chargement, Erreur, Onglets, useApi, envoyer } from "@/components/dashboard/sourcing/ui";
import { Calculateur, type FicheCalcul } from "@/components/dashboard/sourcing/Calculateur";

interface Source {
  id: string; nom: string; description: string | null; images: string[]; url: string | null;
  prixFournisseur: number; deviseFournisseur: string; moq: number; poidsKg: number | null; disponibilite: number | null;
  fournisseurNom: string | null; fournisseurId: string | null; favori: boolean; etape: string; modeAppro: string;
  parametresCout: ParametresCout; tarification: Tarification; criteresScore: Record<string, number>;
  analyseIA: (AnalyseCopilote & { date: string }) | null; kitTest: (KitTest & { date: string }) | null;
  publicites: { variantes: VariantePub[]; date: string } | null;
}
interface Reponse {
  source: Source; contexte: ContexteCalcul; evaluation: Evaluation;
  produit: { id: string; slug: string; prix: number; type: string; stock: number; ventes: number } | null;
  budgetTest: { total: number; parJour: number; explication: string } | null;
  avertissementIA: string;
  connecteur: { id: string; nom: string; statut: "actif" | "sandbox" | "a_connecter" };
}

type Onglet = "analyser" | "cout" | "copilote" | "test" | "pub" | "marque";
const ONGLETS: { cle: Onglet; libelle: string }[] = [
  { cle: "analyser", libelle: "1. Analyser" }, { cle: "cout", libelle: "2. Coût & prix" }, { cle: "copilote", libelle: "3. Copilote IA" },
  { cle: "test", libelle: "4. Centre de test" }, { cle: "pub", libelle: "5. Publicité" }, { cle: "marque", libelle: "6. Feuille de route" },
];
const VERDICTS = { tester: { texte: "À tester", ton: "positif" }, tester_avec_prudence: { texte: "À tester avec prudence", ton: "accent" }, eviter: { texte: "À éviter", ton: "attention" } } as const;
const COULEUR_SCORE = { excellent: "#15803D", bon: "#15803D", moyen: "#B45309", risque: "#B91C1C" } as const;

function Copier({ texte }: { texte: string }) {
  const t = useT();
  const [fait, setFait] = useState(false);
  return (
    <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#B45309]"
      onClick={() => navigator.clipboard.writeText(texte).then(() => { setFait(true); setTimeout(() => setFait(false), 1500); })}>
      {fait ? <Check size={11} /> : <Copy size={11} />}{fait ? t("Copié") : t("Copier")}
    </button>
  );
}

/** Bloc de texte généré, copiable. */
function Bloc({ titre, texte, liste }: { titre: string; texte?: string; liste?: string[] }) {
  const t = useT();
  if (!texte && !liste?.length) return null;
  return (
    <div className="rounded-xl border border-[#E8E8E8] p-3">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-[11px] font-bold text-[#666666] uppercase tracking-wide">{t(titre)}</p>
        <Copier texte={texte ?? liste!.join("\n")} />
      </div>
      {texte && <p className="text-[13px] text-[#111111] leading-relaxed whitespace-pre-line">{texte}</p>}
      {liste && <ul className="list-disc pl-4 space-y-1 text-[13px] text-[#111111] leading-relaxed">{liste.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}

function AvertissementIA({ texte }: { texte: string }) {
  const t = useT();
  return (
    <div className="flex items-start gap-2 rounded-xl bg-[#FFF7ED] border border-[#FDE68A] px-3 py-2 text-[12px] text-[#B45309] leading-relaxed">
      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" /><span>{t(texte)}</span>
    </div>
  );
}

export default function PageProduitSourcing() {
  const t = useT();
  const { fmt } = useDevise();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const url = `/api/sourcing/produits/${id}`;
  const { data, setData, erreur, chargement } = useApi<Reponse>(url);
  const fournisseurs = useApi<{ fournisseurs: { id: string; nom: string }[] }>("/api/fournisseurs");
  const [onglet, setOnglet] = useState<Onglet>("analyser");
  const [enCours, setEnCours] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  // Brouillons : la fiche fournisseur et les hypothèses de coût ne partent au serveur qu'au clic sur « Enregistrer ».
  const [fiche, setFiche] = useState<Partial<Source>>({});
  const [calcul, setCalcul] = useState<Partial<FicheCalcul>>({});

  async function agir(cle: string, action: () => Promise<unknown>, succes?: string) {
    setEnCours(cle); setMessage(null);
    try {
      await action();
      if (succes) setMessage({ ok: true, texte: succes });
    } catch (e) {
      setMessage({ ok: false, texte: (e as Error).message });
    } finally {
      setEnCours(null);
    }
  }
  const maj = (cle: string, corps: object, succes?: string) => agir(cle, async () => {
    setData(await envoyer<Reponse>(url, "PATCH", corps));
    // Le brouillon enregistré est vidé ; l'autre reste, pour ne pas perdre une saisie en cours.
    if (cle === "fiche") setFiche({});
    if (cle === "calcul") setCalcul({});
  }, succes);
  const ia = (type: "copilote" | "kit" | "publicites") => agir(type, async () => {
    const r = await envoyer<Partial<Source>>(`${url}/ia`, "POST", { type });
    setData((d) => d && { ...d, source: { ...d.source, ...r } });
  });

  if (chargement && !data) return <Page><Chargement /></Page>;
  if (erreur || !data) return <Page><Erreur message={erreur ?? "Produit introuvable"} /><Bouton variante="secondaire" href="/dashboard/sourcing/catalogue">{t("Retour au catalogue")}</Bouton></Page>;

  const { source: s, contexte, evaluation: ev, produit, connecteur } = data;
  const sandbox = connecteur.statut === "sandbox";
  const score = ev.score;
  const iEtape = Math.max(0, ETAPES_PRODUIT.findIndex((e) => e.cle === s.etape));
  const gagnant = (ETAPES_GAGNANTES as string[]).includes(s.etape);
  const ficheCalcul: FicheCalcul = {
    prixFournisseur: s.prixFournisseur, deviseFournisseur: s.deviseFournisseur, moq: s.moq, poidsKg: s.poidsKg, disponibilite: s.disponibilite,
    modeAppro: s.modeAppro, parametresCout: s.parametresCout ?? {}, tarification: s.tarification ?? {}, criteresScore: s.criteresScore, ...calcul,
  };
  const v = <K extends keyof Source>(cle: K): Source[K] => (cle in fiche ? fiche[cle] : s[cle]) as Source[K];
  const texte = (cle: "nom" | "description" | "url" | "fournisseurNom", label: string, zone?: boolean) => (
    <Champ label={label}>
      {zone
        ? <textarea rows={4} className={CLASSE_CHAMP} value={v(cle) ?? ""} onChange={(e) => setFiche((f) => ({ ...f, [cle]: e.target.value }))} />
        : <input className={CLASSE_CHAMP} value={v(cle) ?? ""} onChange={(e) => setFiche((f) => ({ ...f, [cle]: e.target.value }))} />}
    </Champ>
  );
  const nombre = (cle: "prixFournisseur" | "moq" | "poidsKg" | "disponibilite", label: string, suffixe?: string) => (
    <ChampNombre label={label} suffixe={suffixe} valeur={v(cle) ?? undefined} onChange={(n) => setFiche((f) => ({ ...f, [cle]: n }))} />
  );
  // Seuls les champs remplis partent : le schéma refuse une chaîne vide (lien) ou un prix nul.
  const ficheAEnvoyer = Object.fromEntries(Object.entries(fiche).filter(([, val]) => val !== "" && val !== undefined && val !== null));

  const publier = () => agir("publier", async () => {
    await envoyer(`${url}/publier`, "POST");
    setData(await (await fetch(url)).json());
  }, produit ? "Prix et coût mis à jour dans votre boutique." : "Produit ajouté à votre boutique.");

  return (
    <Page>
      <Link href="/dashboard/sourcing/catalogue" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#666666]"><ChevronLeft size={13} />{t("Catalogue sourcing")}</Link>

      {sandbox && <AvertissementIA texte="Produit de démonstration — données fictives, non publiable. Il sert uniquement à essayer le parcours." />}

      {/* En-tête : l'essentiel et l'action principale */}
      <Carte>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="w-20 h-20 rounded-xl bg-[#F5F5F5] border border-[#E8E8E8] overflow-hidden flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.images[0] && <img src={s.images[0]} alt="" className="w-full h-full object-cover" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h1 className="text-[18px] font-bold text-[#111111] leading-tight flex-1">{s.nom}</h1>
              <button type="button" aria-label={t("Favori")} onClick={() => maj("favori", { favori: !s.favori })}>
                <Star size={18} fill={s.favori ? "#F5A623" : "none"} className={s.favori ? "text-[#F5A623]" : "text-[#CCCCCC]"} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
              {s.fournisseurNom && <Pastille>{s.fournisseurNom}</Pastille>}
              <Pastille>{t("Source : {0}", connecteur.nom)}</Pastille>
              {sandbox && <PastilleIntegration statut="sandbox" />}
              <Pastille ton="accent">{t(ETAPES_PRODUIT[iEtape].libelle)}</Pastille>
              {produit && <Pastille ton="positif">{t("En boutique")}</Pastille>}
            </div>
            <div className="flex items-end gap-4 flex-wrap mt-3">
              <div>
                <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wide">{t("Score produit")}</p>
                <p className="text-[24px] font-bold leading-none" style={{ color: COULEUR_SCORE[score.niveau] }}>{score.total}<span className="text-[13px] text-[#AAAAAA]">/100</span></p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wide">{t("Coût réel")}</p>
                <p className="text-[15px] font-bold text-[#111111]">{fmt(ev.cout.coutTotal)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wide">{t("Prix de vente")}</p>
                <p className="text-[15px] font-bold text-[#111111]">{ev.cout.prixVente === null ? "—" : fmt(ev.cout.prixVente)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#666666] uppercase tracking-wide">{t("Bénéfice estimé")}</p>
                <p className="text-[15px] font-bold" style={{ color: (ev.cout.margeNette ?? 0) > 0 ? "#15803D" : "#B91C1C" }}>{ev.cout.margeNette === null ? "—" : fmt(ev.cout.margeNette)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-[#F0F0F0]">
          <Bouton onClick={publier} charge={enCours === "publier"} disabled={sandbox}>{produit ? t("Mettre à jour le prix en boutique") : t("Importer dans ma boutique")}</Bouton>
          {produit && <Bouton variante="secondaire" href={`/dashboard/produits/${produit.id}`}>{t("Voir le produit en boutique")}<ExternalLink size={12} /></Bouton>}
          <span className="flex-1" />
          <Bouton variante="secondaire" petit charge={enCours === "supprimer"} onClick={() => {
            if (!window.confirm(t("Supprimer cette fiche sourcing ? Le produit déjà publié en boutique, lui, reste."))) return;
            agir("supprimer", async () => { await envoyer(url, "DELETE"); router.push("/dashboard/sourcing/catalogue"); });
          }}><Trash2 size={12} />{t("Supprimer")}</Bouton>
        </div>
        {message && <p className="mt-3 text-[12px] font-semibold" style={{ color: message.ok ? "#15803D" : "#B91C1C" }}>{t(message.texte)}</p>}
      </Carte>

      <Onglets onglets={ONGLETS} actif={onglet} onChange={setOnglet} />

      {onglet === "analyser" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          <Carte titre="Fiche du fournisseur" aide="Les informations copiées depuis le site du fournisseur. Corrigez-les si besoin."
            actions={<Bouton petit disabled={!Object.keys(ficheAEnvoyer).length} charge={enCours === "fiche"} onClick={() => maj("fiche", { fiche: ficheAEnvoyer }, "Fiche enregistrée.")}>{t("Enregistrer")}</Bouton>}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">{texte("nom", "Nom du produit")}</div>
              {nombre("prixFournisseur", "Prix du fournisseur")}
              <Champ label="Devise du fournisseur">
                <select className={CLASSE_CHAMP} value={v("deviseFournisseur")} onChange={(e) => setFiche((f) => ({ ...f, deviseFournisseur: e.target.value }))}>
                  {DEVISES_FOURNISSEUR.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Champ>
              {nombre("moq", "Quantité minimum")}
              {nombre("poidsKg", "Poids d'une unité", "kg")}
              {nombre("disponibilite", "Stock annoncé")}
              {texte("fournisseurNom", "Nom du fournisseur")}
              <div className="sm:col-span-2">{texte("url", "Lien du produit")}</div>
              <div className="sm:col-span-2">{texte("description", "Description", true)}</div>
              <div className="sm:col-span-2">
                <Champ label="Fournisseur de votre boutique" aide="Les commandes de ce produit lui seront transmises.">
                  <select className={CLASSE_CHAMP} value={s.fournisseurId ?? ""} onChange={(e) => maj("fournisseur", { fournisseurId: e.target.value || null }, "Fournisseur rattaché.")}>
                    <option value="">{t("Aucun fournisseur rattaché")}</option>
                    {(fournisseurs.data?.fournisseurs ?? []).map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
                  </select>
                </Champ>
                <Link href="/dashboard/sourcing/fournisseurs" className="inline-block mt-1.5 text-[11px] font-semibold text-[#B45309]">{t("Gérer et comparer mes fournisseurs")}</Link>
              </div>
            </div>
          </Carte>

          <Carte titre="Score produit" aide="Chaque critère est noté sur 10. Les critères que rien ne mesure sont vos estimations.">
            <div className="flex items-center gap-4">
              <p className="text-[40px] font-bold leading-none" style={{ color: COULEUR_SCORE[score.niveau] }}>{score.total}<span className="text-[16px] text-[#AAAAAA]">/100</span></p>
              <div>
                <p className="text-[14px] font-bold text-[#111111] flex items-center gap-1.5">{score.niveau === "excellent" && <Flame size={15} className="text-[#F5A623]" />}{t(score.verdict)}</p>
                <p className="text-[11px] text-[#666666]">{t("{0} % du barème renseigné", Math.round(score.confiance * 100))}{score.confiance < 1 ? ` — ${t("score partiel")}` : ""}</p>
              </div>
            </div>
            <ul className="mt-4 divide-y divide-[#F0F0F0]">
              {score.criteres.map((c) => {
                const estime = CRITERES_ESTIMES.find((e) => e.cle === c.cle);
                return (
                  <li key={c.cle} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#111111]">{t(c.libelle)}</span>
                      <span className="flex items-center gap-1.5">
                        {c.source === "calcule" ? <Pastille ton="positif">{t("Calculé")}</Pastille> : c.source === "estime" ? <Estimation /> : <Pastille>{t("Non renseigné")}</Pastille>}
                        <span className="text-[13px] font-bold tabular-nums w-10 text-right">{c.note === null ? "—" : `${c.note}/10`}</span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#666666] mt-0.5">{c.explication}</p>
                    {estime && (
                      <div className="mt-1.5">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} type="button" disabled={enCours === "score"} onClick={() => maj("score", { criteresScore: { ...s.criteresScore, [c.cle]: n } })}
                              className="w-8 h-7 rounded-lg text-[12px] font-bold"
                              style={s.criteresScore?.[c.cle] === n ? { background: "#F5A623", color: "#111111" } : { background: "#F5F5F5", color: "#666666" }}>{n}</button>
                          ))}
                        </div>
                        <p className="text-[10px] text-[#AAAAAA] mt-1">1 = {t(estime.bas)} · 5 = {t(estime.haut)}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Carte>
        </div>
      )}

      {onglet === "cout" && (
        <>
          <Carte titre="Comment recevez-vous la marchandise ?" aide="Vous pouvez changer de modèle à tout moment.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODES_APPRO.map((m) => (
                <button key={m.cle} type="button" disabled={enCours === "mode"} className="text-left rounded-xl border px-3 py-2.5"
                  style={s.modeAppro === m.cle ? { borderColor: "#F5A623", background: "#FFF7ED" } : { borderColor: "#E8E8E8", background: "#FFFFFF" }}
                  onClick={() => {
                    if (m.cle === s.modeAppro) return;
                    // Stock strict : un produit qui passe en stock local repart de 0 jusqu'à la réception.
                    if (produit && s.modeAppro === "dropshipping" && !window.confirm(t("Le stock du produit en boutique passera à 0 jusqu'à la réception de la marchandise : il ne sera plus vendable d'ici là. Continuer ?"))) return;
                    maj("mode", { modeAppro: m.cle }, "Modèle changé.");
                  }}>
                  <span className="block text-[13px] font-bold text-[#111111]">{t(m.libelle)}</span>
                  <span className="block text-[11px] text-[#666666] leading-snug mt-0.5">{t(m.resume)}</span>
                </button>
              ))}
            </div>
            {s.modeAppro === "stock_axso" && (
              <p className="mt-3 text-[12px] text-[#B45309] bg-[#FFF7ED] border border-[#FDE68A] rounded-xl px-3 py-2 leading-relaxed">
                {t("Axso n'opère pas encore d'entrepôt : ce modèle suppose un partenaire logistique que vous avez trouvé vous-même. Créez son entrepôt dans Logistique → Entrepôts pour y suivre votre stock.")}
              </p>
            )}
          </Carte>
          <div className="flex items-center justify-end gap-2 flex-wrap">
            {Object.keys(calcul).length > 0 && <span className="text-[12px] text-[#B45309] font-semibold">{t("Modifications non enregistrées")}</span>}
            <Bouton disabled={!Object.keys(calcul).length} charge={enCours === "calcul"}
              onClick={() => maj("calcul", { ...(calcul.parametresCout && { parametresCout: calcul.parametresCout }), ...(calcul.tarification && { tarification: calcul.tarification }) }, "Coûts et prix enregistrés.")}>{t("Enregistrer les coûts et le prix")}</Bouton>
          </div>
          <Calculateur fiche={ficheCalcul} contexte={contexte} onChange={(partiel) => setCalcul((c) => ({ ...c, ...partiel }))} />
        </>
      )}

      {onglet === "copilote" && (
        <Carte titre="Ce produit vaut-il la peine d'être testé ?" aide="Le copilote lit la fiche du produit et vos chiffres, puis donne son avis."
          actions={<Bouton petit charge={enCours === "copilote"} onClick={() => ia("copilote")}><Sparkles size={12} />{s.analyseIA ? t("Refaire l'analyse") : t("Demander l'avis du copilote")}</Bouton>}>
          <AvertissementIA texte={data.avertissementIA} />
          {enCours === "copilote" && <p className="text-[12px] text-[#666666] mt-3">{t("Analyse en cours, cela peut prendre jusqu'à 30 secondes…")}</p>}
          {s.analyseIA && (
            <div className="space-y-3 mt-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Pastille ton={VERDICTS[s.analyseIA.verdict]?.ton ?? "neutre"}>{t(VERDICTS[s.analyseIA.verdict]?.texte ?? "Avis")}</Pastille>
                <Estimation>{t("Avis généré par IA")}</Estimation>
              </div>
              <p className="text-[14px] font-semibold text-[#111111] leading-relaxed">{s.analyseIA.resume}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-[#F5F5F5] px-3 py-2"><p className="text-[10px] font-bold text-[#666666] uppercase">{t("Prix conseillé (calculé par Axso)")}</p><p className="text-[15px] font-bold">{fmt(ev.conseil.prix)}</p></div>
                <div className="rounded-xl bg-[#F5F5F5] px-3 py-2"><p className="text-[10px] font-bold text-[#666666] uppercase">{t("Marge estimée par commande")}</p><p className="text-[15px] font-bold">{ev.cout.margeNette === null ? "—" : fmt(ev.cout.margeNette)}</p></div>
                <div className="rounded-xl bg-[#F5F5F5] px-3 py-2"><p className="text-[10px] font-bold text-[#666666] uppercase">{t("ROAS minimum")}</p><p className="text-[15px] font-bold">{ev.cout.roasMinimum ?? "—"}</p></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Bloc titre="Analyse du marché (hypothèses)" texte={s.analyseIA.analyseMarche} />
                <Bloc titre="Profil client probable" texte={s.analyseIA.profilClient} />
                <Bloc titre="Proposition de valeur" texte={s.analyseIA.propositionValeur} />
                <Bloc titre="Objections probables" liste={s.analyseIA.objections} />
                <Bloc titre="Risques" liste={s.analyseIA.risques} />
                <Bloc titre="Stratégie publicitaire" texte={s.analyseIA.strategiePublicitaire} />
                <Bloc titre="Stratégie de lancement" liste={s.analyseIA.strategieLancement} />
                <Bloc titre="Recommandations logistiques" liste={s.analyseIA.recommandationsLogistiques} />
              </div>
              {s.analyseIA.estimations && (
                <div className="flex items-center gap-2 flex-wrap">
                  <Bouton variante="discret" petit charge={enCours === "score"} onClick={() => {
                    // Ne garde que les critères connus et des notes entières de 1 à 5 : l'IA peut renvoyer n'importe quoi.
                    const propose = Object.fromEntries(CRITERES_ESTIMES.map((c) => [c.cle, Math.round(Number(s.analyseIA!.estimations[c.cle]))]).filter(([, n]) => Number(n) >= 1 && Number(n) <= 5));
                    maj("score", { criteresScore: { ...s.criteresScore, ...propose } }, "Estimations appliquées au score : corrigez-les dans l'onglet Analyser.");
                  }}>{t("Appliquer ces estimations au score")}</Bouton>
                  <span className="text-[11px] text-[#666666]">{t("Elles restent des estimations, à corriger selon ce que vous savez du marché.")}</span>
                </div>
              )}
            </div>
          )}
        </Carte>
      )}

      {onglet === "test" && (
        <Carte titre="Tester ce produit" aide="Axso prépare la page de vente et six angles marketing. La publication en boutique reprend le titre, la description et la FAQ."
          actions={<Bouton petit charge={enCours === "kit"} onClick={() => ia("kit")}><Sparkles size={12} />{s.kitTest ? t("Régénérer") : t("Générer la page de test")}</Bouton>}>
          <AvertissementIA texte={data.avertissementIA} />
          {enCours === "kit" && <p className="text-[12px] text-[#666666] mt-3">{t("Rédaction en cours, cela peut prendre jusqu'à 30 secondes…")}</p>}
          {s.kitTest && (
            <div className="space-y-3 mt-3">
              <div className="rounded-xl bg-[#F5F5F5] px-3 py-2 inline-block"><p className="text-[10px] font-bold text-[#666666] uppercase">{t("Prix recommandé (calculé par Axso)")}</p><p className="text-[15px] font-bold">{fmt(ev.cout.prixVente ?? ev.conseil.prix)}</p></div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Bloc titre="Titre optimisé" texte={s.kitTest.titre} />
                <Bloc titre="Offre promotionnelle" texte={s.kitTest.offrePromotionnelle} />
                <div className="lg:col-span-2"><Bloc titre="Description" texte={s.kitTest.description} /></div>
                <Bloc titre="Avantages" liste={s.kitTest.avantages} />
                <Bloc titre="Arguments de vente (WhatsApp)" liste={s.kitTest.argumentsVente} />
                <div className="lg:col-span-2"><Bloc titre="FAQ" liste={(s.kitTest.faq ?? []).map((q) => `${q.question} — ${q.reponse}`)} /></div>
              </div>
              <p className="text-[13px] font-bold text-[#111111] pt-1">{t("Angles marketing")}</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(s.kitTest.angles ?? []).map((a) => <Bloc key={a.cle} titre={a.accroche} texte={a.texte} />)}
              </div>
              <p className="text-[11px] text-[#666666]">{t("Preuve sociale : Axso ne génère jamais de faux avis ni de faux témoignages. Utilisez les vrais retours de vos premiers clients.")}</p>
              <div className="flex items-center gap-2 flex-wrap pt-1">
                <Bouton onClick={publier} charge={enCours === "publier"} disabled={sandbox}>{produit ? t("Mettre à jour le prix en boutique") : t("Publier la page produit")}</Bouton>
                {produit && <Bouton variante="secondaire" href={`/dashboard/produits/${produit.id}`}>{t("Modifier la page en boutique")}</Bouton>}
              </div>
              <p className="text-[11px] text-[#666666]">{t("La page publiée affiche les boutons Commander et WhatsApp de votre boutique.")}</p>
            </div>
          )}
        </Carte>
      )}

      {onglet === "pub" && (
        <>
          <Carte titre="Budget de test" aide="Calculé par Axso à partir de vos coûts, pas par l'IA.">
            {data.budgetTest ? (
              <>
                <p className="text-[22px] font-bold text-[#111111]">{fmt(data.budgetTest.total)} <span className="text-[13px] font-semibold text-[#666666]">· {t("{0} par jour", fmt(data.budgetTest.parJour))}</span></p>
                <p className="text-[12px] text-[#666666] mt-1 leading-relaxed">{data.budgetTest.explication}</p>
              </>
            ) : <p className="text-[13px] text-[#B91C1C]">{t("Au prix actuel, il ne reste rien pour payer la publicité : revoyez le prix ou les coûts avant de lancer un test.")}</p>}
          </Carte>
          <Carte titre="Publicités" aide="Plusieurs variantes prêtes à filmer et à publier sur Facebook et TikTok."
            actions={<Bouton petit charge={enCours === "publicites"} onClick={() => ia("publicites")}><Sparkles size={12} />{s.publicites ? t("Régénérer") : t("Générer des publicités")}</Bouton>}>
            <AvertissementIA texte={data.avertissementIA} />
            {enCours === "publicites" && <p className="text-[12px] text-[#666666] mt-3">{t("Rédaction en cours, cela peut prendre jusqu'à 30 secondes…")}</p>}
            <div className="space-y-5 mt-3">
              {(s.publicites?.variantes ?? []).map((p, i) => (
                <div key={i} className="space-y-2">
                  <p className="text-[13px] font-bold text-[#111111]">{t("Variante {0}", i + 1)} · <span className="text-[#B45309]">{p.angle}</span></p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <Bloc titre="Hook" texte={p.hook} />
                    <Bloc titre="Headline" texte={p.headline} />
                    <div className="lg:col-span-2"><Bloc titre="Script vidéo" texte={p.scriptVideo} /></div>
                    <Bloc titre="Texte Facebook" texte={p.texteFacebook} />
                    <Bloc titre="Texte TikTok" texte={p.texteTiktok} />
                    <Bloc titre="Appel à l'action" texte={p.cta} />
                    <Bloc titre="Audience suggérée (hypothèse)" texte={p.audience} />
                  </div>
                </div>
              ))}
            </div>
          </Carte>
        </>
      )}

      {onglet === "marque" && (
        <>
          <Carte titre="Feuille de route du produit" aide="Du premier test à la marque. Vous décidez quand passer à l'étape suivante.">
            <ol className="space-y-2">
              {ETAPES_PRODUIT.map((e, i) => (
                <li key={e.cle} className="flex items-start gap-3 rounded-xl border px-3 py-2.5"
                  style={i === iEtape ? { borderColor: "#F5A623", background: "#FFF7ED" } : { borderColor: "#E8E8E8" }}>
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    style={i < iEtape ? { background: "#15803D", color: "#FFFFFF" } : i === iEtape ? { background: "#F5A623", color: "#111111" } : { background: "#F5F5F5", color: "#AAAAAA" }}>
                    {i < iEtape ? <Check size={12} /> : i + 1}
                  </span>
                  <span>
                    <span className="block text-[13px] font-bold text-[#111111]">{t(e.libelle)}</span>
                    <span className="block text-[12px] text-[#666666]">{t(e.objectif)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="flex items-center gap-2 flex-wrap mt-4">
              {iEtape > 0 && <Bouton variante="secondaire" charge={enCours === "etape"} onClick={() => maj("etape", { etape: ETAPES_PRODUIT[iEtape - 1].cle })}><ChevronLeft size={13} />{t("Revenir à : {0}", t(ETAPES_PRODUIT[iEtape - 1].libelle))}</Bouton>}
              {iEtape < ETAPES_PRODUIT.length - 1 && <Bouton charge={enCours === "etape"} onClick={() => maj("etape", { etape: ETAPES_PRODUIT[iEtape + 1].cle })}>{t("Passer à : {0}", t(ETAPES_PRODUIT[iEtape + 1].libelle))}<ChevronRight size={13} /></Bouton>}
            </div>
            {produit && <p className="text-[11px] text-[#666666] mt-2">{t("{0} vente(s) enregistrée(s) pour ce produit dans votre boutique.", produit.ventes)}</p>}
          </Carte>

          {gagnant ? (
            <Carte titre="Transformer ce produit en marque" aide="Votre produit est validé. Voici ce qu'il faut demander à votre fournisseur pour en faire votre marque.">
              <ul className="list-disc pl-4 space-y-1.5 text-[13px] text-[#111111] leading-relaxed">
                <li>{t("Emballage personnalisé : boîte ou sachet à vos couleurs, quantité minimum et prix par unité.")}</li>
                <li>{t("Logo sur le produit : technique d'impression, quantité minimum, échantillon avant production.")}</li>
                <li>{t("Marque privée (private label) : exclusivité du modèle et délai de production.")}</li>
                <li>{t("Commande en volume : prix par palier de quantité, pour faire baisser le coût unitaire.")}</li>
                <li>{t("Stock local : importer en quantité pour livrer en quelques jours au lieu de plusieurs semaines.")}</li>
              </ul>
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <Bouton href="/dashboard/sourcing/fournisseurs">{t("Demander un devis à mes fournisseurs")}</Bouton>
                <Bouton variante="secondaire" href="/dashboard/sourcing/expeditions">{t("Importer du stock")}</Bouton>
              </div>
            </Carte>
          ) : (
            <p className="text-[12px] text-[#666666] px-1">{t("La transformation en marque (emballage, logo, marque privée) se débloque quand le produit atteint l'étape Validation.")}</p>
          )}
        </>
      )}
    </Page>
  );
}
