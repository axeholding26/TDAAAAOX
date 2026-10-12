"use client";
// Demandes de devis (RFQ) : le marchand décrit son besoin, AXSO génère un texte
// standardisé, il l'envoie à plusieurs fournisseurs, colle leurs réponses et
// compare. Aucun faux envoi : « envoyé par e-mail » n'apparaît que si l'API l'a confirmé.
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Copy, Mail, MessageCircle, Send, Trash2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import {
  Bouton, Carte, Champ, ChampNombre, Chargement, CLASSE_CHAMP, Entete, Erreur, EtatVide, Page, Pastille, envoyer, useApi, type Ton,
} from "@/components/dashboard/sourcing/ui";
import { CarteRecommandation, Podiums, TableauComparaison, montant } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { DEVISES_FOURNISSEUR } from "@/lib/sourcing/pays";
import type { Candidat, Classement, Recommandation } from "@/lib/sourcing/fournisseurs/classement";

const RACINE = "/dashboard/sourcing/fournisseurs";
const API = "/api/fournisseurs/devis";
const INCOTERMS = ["EXW", "FOB", "CIF", "DAP", "DDP"];

interface Fournisseur { id: string; nom: string; email: string | null; telephone: string | null; pays?: string | null }
interface Reponse {
  id: string; fournisseurId: string; statutEnvoi: string; envoyeLe: string | null; texteBrut: string | null; recuLe: string | null;
  prixUnitaire: number | null; devise: string | null; moq: number | null; delaiJours: number | null;
  packaging: string | null; personnalisation: string | null; expedition: string | null; conditionsPaiement: string | null;
  extraitPar: string | null; fournisseur: Fournisseur;
}
interface Demande { id: string; reference: string; nomProduit: string; quantite: number; devise: string; statut: string; contenu: string; reponses: Reponse[] }
interface Detail { demande: Demande; comparaison: { candidats: Candidat[]; classement: Classement | null; recommandation: Recommandation | null } }

const STATUTS: Record<string, [string, Ton]> = { brouillon: ["Brouillon", "neutre"], envoye: ["Envoyée", "info"], clos: ["Close", "positif"] };

function BoutonCopier({ texte, libelle = "Copier" }: { texte: string; libelle?: string }) {
  const t = useT();
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try { await navigator.clipboard.writeText(texte); setCopie(true); setTimeout(() => setCopie(false), 2000); }
    catch { setCopie(false); } // presse-papiers refusé : le texte reste sélectionnable dans le bloc
  };
  return <Bouton petit variante="secondaire" onClick={copier}>{copie ? <Check size={12} /> : <Copy size={12} />}{t(copie ? "Copié" : libelle)}</Bouton>;
}

/** Formulaire « Nouvelle demande ». */
function NouvelleDemande({ fournisseurs, preselection, onCree }: { fournisseurs: Fournisseur[]; preselection: string[]; onCree: (id: string) => void }) {
  const t = useT();
  const [f, setF] = useState({ nomProduit: "", description: "", devise: "USD", couleur: "", packaging: "", personnalisation: "", villeDestination: "", incoterm: "", langue: "en" });
  const [quantite, setQuantite] = useState<number | undefined>();
  const [prixCible, setPrixCible] = useState<number | undefined>();
  const [choisis, setChoisis] = useState<string[]>(() => preselection.filter((id) => fournisseurs.some((x) => x.id === id)));
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const texte = (cle: keyof typeof f, placeholder?: string) => (
    <input value={f[cle]} placeholder={placeholder ? t(placeholder) : undefined} onChange={(e) => setF({ ...f, [cle]: e.target.value })} className={CLASSE_CHAMP} />
  );
  const basculer = (id: string) => setChoisis((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const creer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantite) return setErreur("Indiquez la quantité souhaitée.");
    if (!choisis.length) return setErreur("Choisissez au moins un fournisseur");
    setCharge(true); setErreur(null);
    try {
      const { id } = await envoyer<{ id: string }>(API, "POST", { ...f, quantite, prixCible: prixCible ?? "", fournisseurIds: choisis });
      setF({ ...f, nomProduit: "", description: "" });
      onCree(id);
    } catch (err) {
      setErreur((err as Error).message);
    } finally {
      setCharge(false);
    }
  };

  return (
    <Carte titre="Nouvelle demande" aide="Le pays de destination est celui de votre boutique. Rien n'est envoyé à la création : vous envoyez ensuite à chaque fournisseur.">
      <form onSubmit={creer} className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Champ label="Produit"><input required minLength={2} maxLength={200} value={f.nomProduit} onChange={(e) => setF({ ...f, nomProduit: e.target.value })} className={CLASSE_CHAMP} /></Champ>
          <ChampNombre label="Quantité" valeur={quantite} onChange={(v) => setQuantite(v === undefined ? v : Math.round(v))} pas={1} suffixe={t("unités")} />
        </div>
        <Champ label="Détails"><textarea rows={3} maxLength={3000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={CLASSE_CHAMP} /></Champ>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ChampNombre label="Prix cible" valeur={prixCible} onChange={setPrixCible} placeholder={t("Facultatif")} />
          <Champ label="Devise">
            <select value={f.devise} onChange={(e) => setF({ ...f, devise: e.target.value })} className={CLASSE_CHAMP}>{DEVISES_FOURNISSEUR.map((d) => <option key={d}>{d}</option>)}</select>
          </Champ>
          <Champ label="Ville de destination">{texte("villeDestination")}</Champ>
          <Champ label="Incoterm">
            <select value={f.incoterm} onChange={(e) => setF({ ...f, incoterm: e.target.value })} className={CLASSE_CHAMP}>
              <option value="">{t("À déterminer selon la solution logistique")}</option>
              {INCOTERMS.map((i) => <option key={i}>{i}</option>)}
            </select>
          </Champ>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Champ label="Couleur">{texte("couleur")}</Champ>
          <Champ label="Packaging">{texte("packaging")}</Champ>
          <Champ label="Personnalisation / logo">{texte("personnalisation")}</Champ>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Champ label="Langue du texte">
            <select value={f.langue} onChange={(e) => setF({ ...f, langue: e.target.value })} className={CLASSE_CHAMP}>
              <option value="en">{t("Anglais")}</option>
              <option value="fr">{t("Français")}</option>
            </select>
          </Champ>
        </div>
        <fieldset>
          <legend className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Destinataires")} · {choisis.length}</legend>
          <div className="mt-1.5 grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
            {fournisseurs.map((x) => (
              <label key={x.id} className="flex items-center gap-2 rounded-xl border border-[#E8E8E8] px-3 py-2 text-[12px] text-[#111111] cursor-pointer">
                <input type="checkbox" checked={choisis.includes(x.id)} onChange={() => basculer(x.id)} className="accent-[#F5A623]" />
                <span className="min-w-0 truncate">{x.nom}{x.pays ? <span className="text-[#AAAAAA]"> · {x.pays}</span> : null}</span>
              </label>
            ))}
          </div>
        </fieldset>
        {erreur && <Erreur message={erreur} />}
        <Bouton type="submit" charge={charge}>{t("Générer la demande")}</Bouton>
      </form>
    </Carte>
  );
}

/** Champs d'une réponse, modifiables. Remonté (key) à chaque nouvelle valeur enregistrée. */
function ChampsReponse({ r, deviseDefaut, occupe, onEnregistrer }: { r: Reponse; deviseDefaut: string; occupe: boolean; onEnregistrer: (champs: Record<string, unknown>) => void }) {
  const t = useT();
  const [prixUnitaire, setPrix] = useState<number | undefined>(r.prixUnitaire ?? undefined);
  const [moq, setMoq] = useState<number | undefined>(r.moq ?? undefined);
  const [delaiJours, setDelai] = useState<number | undefined>(r.delaiJours ?? undefined);
  const [c, setC] = useState({ devise: r.devise || deviseDefaut, packaging: r.packaging ?? "", personnalisation: r.personnalisation ?? "", expedition: r.expedition ?? "", conditionsPaiement: r.conditionsPaiement ?? "" });
  const devises = (DEVISES_FOURNISSEUR as readonly string[]).includes(c.devise) ? DEVISES_FOURNISSEUR : [c.devise, ...DEVISES_FOURNISSEUR];
  const texte = (cle: keyof typeof c, label: string) => (
    <Champ label={label}><input maxLength={500} value={c[cle]} onChange={(e) => setC({ ...c, [cle]: e.target.value })} className={CLASSE_CHAMP} /></Champ>
  );
  const entier = (v: number | undefined) => (v === undefined ? v : Math.round(v));
  return (
    <div className="space-y-3">
      {r.extraitPar && (
        <Pastille ton={r.extraitPar === "ia" ? "accent" : "neutre"}>{t(r.extraitPar === "ia" ? "Extrait par l'IA — vérifiez avant de comparer" : "Saisi à la main")}</Pastille>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ChampNombre label="Prix unitaire" valeur={prixUnitaire} onChange={setPrix} />
        <Champ label="Devise"><select value={c.devise} onChange={(e) => setC({ ...c, devise: e.target.value })} className={CLASSE_CHAMP}>{devises.map((d) => <option key={d}>{d}</option>)}</select></Champ>
        <ChampNombre label="MOQ" valeur={moq} onChange={(v) => setMoq(entier(v))} pas={1} />
        <ChampNombre label="Délai" valeur={delaiJours} onChange={(v) => setDelai(entier(v))} pas={1} suffixe={t("jours")} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        {texte("packaging", "Packaging")}
        {texte("personnalisation", "Personnalisation")}
        {texte("expedition", "Expédition")}
        {texte("conditionsPaiement", "Conditions de paiement")}
      </div>
      <Bouton petit variante="secondaire" charge={occupe}
        onClick={() => onEnregistrer({ ...c, prixUnitaire: prixUnitaire ?? "", moq: moq ?? "", delaiJours: delaiJours ?? "" })}>{t("Enregistrer")}</Bouton>
    </div>
  );
}

/** Un destinataire : envoi (réel ou déclaré), réponse collée, conditions extraites. */
function Destinataire({ demande, r, recharger }: { demande: Demande; r: Reponse; recharger: () => Promise<void> }) {
  const t = useT();
  const [colle, setColle] = useState("");
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(t.loc) : "");

  const agir = async (cle: string, corps: Record<string, unknown>, succes?: string) => {
    setOccupe(cle); setErreur(null); setInfo(null);
    try {
      const rep = await envoyer<{ avertissement?: string }>(`${API}/${demande.id}`, "PATCH", { ...corps, fournisseurId: r.fournisseurId });
      setInfo(rep.avertissement ?? succes ?? null);
      if (cle === "extraire") setColle("");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      await recharger(); // même après une erreur : un envoi raté passe en « Échec de l'envoi »
      setOccupe(null);
    }
  };

  const [statut, ton]: [string, Ton] =
    r.statutEnvoi === "envoye_email" ? [t("Envoyé par e-mail le {0}", date(r.envoyeLe)), "positif"]
    : r.statutEnvoi === "copie_manuelle" ? [t("Envoyé par vous le {0}", date(r.envoyeLe)), "info"]
    : r.statutEnvoi === "echec" ? [t("Échec de l'envoi"), "attention"]
    : [t("Non envoyé"), "neutre"];
  const chiffres = (r.fournisseur.telephone ?? "").replace(/\D/g, "");

  return (
    <Carte>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-[#111111] truncate">{r.fournisseur.nom}</p>
          <p className="text-[11px] text-[#AAAAAA] truncate">{[r.fournisseur.email, r.fournisseur.telephone].filter(Boolean).join(" · ") || t("Aucun contact enregistré")}</p>
        </div>
        <Pastille ton={ton}>{statut}</Pastille>
      </div>

      <div className="flex gap-2 flex-wrap mt-3">
        {r.fournisseur.email && <Bouton petit charge={occupe === "email"} disabled={!!occupe} onClick={() => agir("email", { action: "envoyer", canal: "email" })}><Mail size={12} />{t("Envoyer par e-mail")}</Bouton>}
        {chiffres && (
          <a href={`https://wa.me/${chiffres}?text=${encodeURIComponent(demande.contenu)}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 rounded-xl font-bold px-3 py-1.5 text-[11px] bg-white text-[#111111] border border-[#E8E8E8] hover:border-[#F5A623]">
            <MessageCircle size={12} />WhatsApp
          </a>
        )}
        <BoutonCopier texte={demande.contenu} libelle="Copier le texte" />
        <Bouton petit variante="discret" charge={occupe === "manuel"} disabled={!!occupe} onClick={() => agir("manuel", { action: "envoyer", canal: "manuel" })}><Send size={12} />{t("Marquer comme envoyé")}</Bouton>
      </div>

      <div className="mt-4 pt-4 border-t border-[#F0F0F0] space-y-3">
        <Champ label="Coller la réponse du fournisseur" aide={r.recuLe ? t("Réponse reçue le {0}", date(r.recuLe)) : undefined}>
          <textarea rows={3} maxLength={12000} value={colle} placeholder={r.texteBrut ?? ""} onChange={(e) => setColle(e.target.value)} className={CLASSE_CHAMP} />
        </Champ>
        <Bouton petit charge={occupe === "extraire"} disabled={!!occupe || !colle.trim()} onClick={() => agir("extraire", { action: "reponse", texteBrut: colle })}>{t("Extraire les conditions")}</Bouton>

        <ChampsReponse key={JSON.stringify([r.prixUnitaire, r.devise, r.moq, r.delaiJours, r.packaging, r.personnalisation, r.expedition, r.conditionsPaiement, r.extraitPar])} r={r} deviseDefaut={demande.devise} occupe={occupe === "champs"}
          onEnregistrer={(champs) => agir("champs", { action: "reponse", champs })} />

        {r.prixUnitaire != null && (
          <Bouton petit variante="discret" charge={occupe === "retenir"} disabled={!!occupe}
            onClick={() => agir("retenir", { action: "retenir" }, "Offre enregistrée dans la fiche du fournisseur (prix déclaré par le fournisseur).")}>{t("Retenir comme offre")}</Bouton>
        )}
        {info && <p className="text-[12px] text-[#B45309] leading-snug">{t(info)}</p>}
        {erreur && <Erreur message={erreur} />}
      </div>
    </Carte>
  );
}

/** Une demande ouverte : texte standardisé, destinataires, comparaison automatique. */
function DetailDemande({ id, onChange, onFermer }: { id: string; onChange: () => void; onFermer: () => void }) {
  const t = useT();
  const { data, erreur, recharger } = useApi<Detail>(`${API}/${id}`);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreurAction, setErreurAction] = useState<string | null>(null);

  if (!data) return erreur ? <Erreur message={erreur} /> : <Chargement />;
  const { demande, comparaison } = data;
  const rechargerTout = async () => { await recharger(); onChange(); };
  const repondues = demande.reponses.filter((r) => r.prixUnitaire != null);

  const clore = async () => {
    setOccupe("clore"); setErreurAction(null);
    try { await envoyer(`${API}/${id}`, "PATCH", { action: "clore" }); await rechargerTout(); }
    catch (e) { setErreurAction((e as Error).message); }
    finally { setOccupe(null); }
  };
  const supprimer = async () => {
    if (!window.confirm(t("Supprimer cette demande de devis et les réponses enregistrées ?"))) return;
    setOccupe("supprimer"); setErreurAction(null);
    try { await envoyer(`${API}/${id}`, "DELETE"); onChange(); onFermer(); }
    catch (e) { setErreurAction((e as Error).message); setOccupe(null); }
  };

  const conditions: [string, (r: Reponse) => string | null][] = [
    ["Packaging", (r) => r.packaging], ["Personnalisation", (r) => r.personnalisation],
    ["Expédition", (r) => r.expedition], ["Conditions de paiement", (r) => r.conditionsPaiement],
  ];

  return (
    <div className="space-y-4">
      <Carte titre={`${demande.reference} — ${demande.nomProduit}`} actions={
        <div className="flex gap-2 flex-wrap justify-end">
          <BoutonCopier texte={demande.contenu} />
          {demande.statut !== "clos" && <Bouton petit variante="secondaire" charge={occupe === "clore"} onClick={clore}>{t("Clore")}</Bouton>}
          <Bouton petit variante="secondaire" charge={occupe === "supprimer"} onClick={supprimer}><Trash2 size={12} />{t("Supprimer")}</Bouton>
        </div>
      }>
        <pre className="text-[12px] text-[#111111] bg-[#FAFAFA] border border-[#E8E8E8] rounded-xl p-3 whitespace-pre-wrap break-words max-h-80 overflow-y-auto font-sans leading-relaxed">{demande.contenu}</pre>
        {erreurAction && <div className="mt-3"><Erreur message={erreurAction} /></div>}
      </Carte>

      {erreur && <Erreur message={erreur} />}
      <div className="grid lg:grid-cols-2 gap-4">
        {demande.reponses.map((r) => <Destinataire key={r.id} demande={demande} r={r} recharger={rechargerTout} />)}
      </div>

      {comparaison.candidats.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-[14px] font-bold text-[#111111]">{t("Comparaison automatique")}</h2>
            <p className="text-[12px] text-[#666666] mt-0.5 leading-relaxed">{t("Les prix, MOQ et délais répondus sont déclarés par le fournisseur : ils ne sont pas vérifiés par AXSO. Les coûts sont calculés pour {0} unités.", demande.quantite)}</p>
          </div>
          {comparaison.recommandation && <CarteRecommandation reco={comparaison.recommandation} />}
          {comparaison.classement && <Podiums classement={comparaison.classement} />}
          <TableauComparaison candidats={comparaison.candidats} />
          <Carte titre="Conditions répondues" aide="Telles que déclarées par le fournisseur dans sa réponse." className="overflow-x-auto">
            <table className="w-full text-[12px] min-w-[480px]">
              <thead>
                <tr>
                  <th />
                  {repondues.map((r) => (
                    <th key={r.id} className="text-left font-bold text-[#111111] px-2 pb-2 align-bottom">
                      {r.fournisseur.nom}
                      <span className="block text-[10px] font-normal text-[#AAAAAA]">{montant(r.prixUnitaire, r.devise || demande.devise, t.loc)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conditions.map(([libelle, valeur]) => (
                  <tr key={libelle} className="border-t border-[#F0F0F0]">
                    <td className="py-2 pr-2 text-[11px] font-semibold text-[#666666] uppercase tracking-wide whitespace-nowrap">{t(libelle)}</td>
                    {repondues.map((r) => <td key={r.id} className="px-2 py-2 text-[#111111] align-top">{valeur(r) || t("Non communiqué")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Carte>
        </div>
      )}
    </div>
  );
}

function Contenu() {
  const t = useT();
  const params = useSearchParams();
  const [ouverte, setOuverte] = useState<string | null>(params.get("demande"));
  const preselection = (params.get("fournisseurs") ?? "").split(",").filter(Boolean);
  const fournisseurs = useApi<{ fournisseurs: Fournisseur[] }>("/api/fournisseurs");
  const demandes = useApi<{ demandes: Demande[] }>(API);

  return (
    <Page>
      <Entete titre="Demandes de devis"
        sousTitre="Décrivez votre besoin : AXSO génère une demande standardisée. Envoyez-la à plusieurs fournisseurs, collez leurs réponses, puis comparez-les."
        actions={<Bouton href={RACINE} variante="secondaire"><ArrowLeft size={14} />{t("Fournisseurs")}</Bouton>} />

      {fournisseurs.erreur ? <Erreur message={fournisseurs.erreur} />
        : !fournisseurs.data ? <Chargement />
        : !fournisseurs.data.fournisseurs.length ? (
          <EtatVide titre="Aucun fournisseur enregistré" texte="Une demande de devis s'adresse aux fournisseurs de votre boutique. AXSO n'en invente pas : ajoutez ceux que vous avez repérés.">
            <Bouton href={RACINE}>{t("Ajouter un fournisseur")}</Bouton>
          </EtatVide>
        ) : <NouvelleDemande fournisseurs={fournisseurs.data.fournisseurs} preselection={preselection} onCree={(id) => { setOuverte(id); demandes.recharger(); }} />}

      <Carte titre="Vos demandes">
        {demandes.erreur ? <Erreur message={demandes.erreur} />
          : !demandes.data ? <Chargement />
          : !demandes.data.demandes.length ? <p className="text-[12px] text-[#666666]">{t("Aucune demande de devis pour l'instant.")}</p>
          : (
            <ul className="divide-y divide-[#F0F0F0]">
              {demandes.data.demandes.map((d) => {
                const [libelle, ton] = STATUTS[d.statut] ?? [d.statut, "neutre" as Ton];
                return (
                  <li key={d.id}>
                    <button onClick={() => setOuverte(ouverte === d.id ? null : d.id)} aria-expanded={ouverte === d.id}
                      className="w-full flex items-center justify-between gap-3 py-2.5 text-left flex-wrap rounded-lg px-2 -mx-2"
                      style={ouverte === d.id ? { background: "#FFF7ED" } : undefined}>
                      <span className="min-w-0">
                        <span className="block text-[13px] font-bold text-[#111111] truncate">{d.nomProduit}</span>
                        <span className="block text-[11px] text-[#AAAAAA]">{d.reference} · {t("{0} unités", d.quantite.toLocaleString(t.loc))}</span>
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <span className="text-[11px] text-[#666666]">{t("{0} réponse(s) reçue(s) sur {1}", d.reponses.filter((r) => r.recuLe).length, d.reponses.length)}</span>
                        <Pastille ton={ton}>{t(libelle)}</Pastille>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
      </Carte>

      {ouverte && <DetailDemande key={ouverte} id={ouverte} onChange={demandes.recharger} onFermer={() => setOuverte(null)} />}
    </Page>
  );
}

export default function PageDevis() {
  return <Suspense fallback={<Chargement />}><Contenu /></Suspense>;
}
