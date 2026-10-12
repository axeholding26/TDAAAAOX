"use client";
// Session de caisse : ouverture (fonds initial), état en direct, mouvements
// (retrait, dépôt, dépense, correction), fermeture avec comptage, récapitulatif
// imprimable, historique.
//
// Les montants viennent tous du serveur (lib/pos/session-caisse.ts) ; l'écran
// ne calcule que le total du comptage et l'écart affiché AVANT validation — à
// la fermeture, c'est l'écart recalculé par le serveur qui est enregistré.
// Un encaissement Mobile Money, carte, virement… est DÉCLARÉ par le caissier :
// il s'affiche toujours « Non vérifié ».
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, History, Lock, Printer, Receipt, Scale, Unlock } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgePaiement, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatNonAutorise, EtatPos, EtatVide, Modale, Saisie, Tiroir } from "@/components/pos/ui";
import type { Demarrage } from "@/components/pos/caisse/api";
import { useFluxPos } from "@/components/pos/scanner/useFluxPos";
import { envoyerMutation, nouvelleCle } from "@/lib/pos/client/transport";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import { coupuresPour, totalComptage } from "@/lib/pos/caisse/calculs";
import type { DetailAttendu } from "@/lib/pos/session-caisse";
import type { ModePaiement } from "@/lib/pos/types";
import { Carte, Chiffre, EnTete, Page, appelPos, imprimerElement, lireMontant, useCaisse, useLecture, type ErreurAppel } from "./commun";

type Session = {
  id: string; caisseId: string; statut: string; ouvertePar: string; fermeePar: string | null; fondsInitial: number;
  ouverteAt: string; fermeeAt: string | null; montantAttendu: number | null; montantCompte: number | null; ecart: number | null;
  justificationEcart: string | null; detailComptage: Record<string, number> | null;
};
type NomCaisse = { caisse: { nom: string; magasin: { nom: string } } };
type Mouvement = { id: string; type: string; montant: number; motif: string; creePar: string; createdAt: string };
type DonneesSessions = { ouverte: (Session & { detail: DetailAttendu | null }) | null; recentes: (Session & NomCaisse)[]; caisseId: string };
type DetailSession = {
  session: Session & NomCaisse & { mouvements: Mouvement[] };
  detail: DetailAttendu;
  paiements: { mode: string; nonVerifie: boolean; montant: number; nombre: number }[];
  ventes: { nombre: number; total: number; encaisse: number };
};
type DonneesMouvements = { mouvements: Mouvement[]; noms: Record<string, string> };

const TYPES = [
  { id: "depot", label: "Dépôt", aide: "Des espèces sont ajoutées au tiroir (appoint de monnaie, apport).", Icone: ArrowDownLeft },
  { id: "retrait", label: "Retrait", aide: "Des espèces sortent du tiroir pour être mises en sécurité ou déposées en banque.", Icone: ArrowUpRight },
  { id: "depense", label: "Dépense", aide: "Un achat est payé avec l'argent du tiroir. Il est aussi enregistré dans les charges du magasin.", Icone: Receipt },
  { id: "correction", label: "Correction", aide: "Le tiroir ne contient pas ce que la caisse croit (erreur de rendu, oubli). Le motif est obligatoire.", Icone: Scale },
] as const;
type TypeMouvement = (typeof TYPES)[number]["id"];
const CATEGORIES = [["fournitures", "Fournitures"], ["transport", "Transport"], ["equipement", "Équipement"], ["salaires", "Salaires"], ["electricite", "Électricité"], ["eau", "Eau"], ["internet", "Internet"], ["loyer", "Loyer"], ["autre", "Autre"]] as const;
const libelleType = (type: string) => TYPES.find((x) => x.id === type)?.label ?? type;
/** Effet d'un mouvement sur le tiroir : + entre, − sort. */
const signe = (m: Pick<Mouvement, "type" | "montant">) => (m.type === "depot" ? m.montant : m.type === "correction" ? m.montant : -m.montant);

const EVENEMENTS_SUIVIS = ["sale.created", "sale.cancelled", "return.created", "cash.movement", "cash.opened", "cash.closed"];

export function SessionCaisse() {
  const t = useT();
  const { fmt } = useDevise();
  const [caisseId, choisirCaisse] = useCaisse();
  const demarrage = useLecture<Demarrage>("/api/pos/reglages", caisseId);
  const sessions = useLecture<DonneesSessions>("/api/pos/sessions?limite=20", caisseId);
  const caisses = useLecture<{ caisses: { id: string; nom: string; magasinNom: string; actif: boolean }[] }>("/api/pos/caisses", caisseId);
  const droits = demarrage.donnees?.droits;
  const ouverte = sessions.donnees?.ouverte ?? null;
  const voitDetail = !!droits && (droits.voir_caisse || droits.fermer_caisse || droits.ouvrir_caisse);
  const voitMouvements = voitDetail || !!droits?.mouvement_caisse;
  const detail = useLecture<DetailSession>(ouverte && voitDetail ? `/api/pos/sessions/${ouverte.id}` : null, caisseId);
  const mouvements = useLecture<DonneesMouvements>(ouverte && voitMouvements ? `/api/pos/mouvements-caisse?sessionCaisseId=${ouverte.id}` : null, caisseId);

  const [modale, setModale] = useState<"mouvement" | "fermeture" | null>(null);
  const [recap, setRecap] = useState<string | null>(null);

  const recharger = () => { void demarrage.recharger(); void sessions.recharger(); void detail.recharger(); void mouvements.recharger(); };
  // État en direct : une vente, un retour ou un mouvement sur cette caisse rafraîchit l'écran.
  useFluxPos({ caisseId, surEvenement: (e) => { if (EVENEMENTS_SUIVIS.includes(e.type)) { void sessions.recharger(); void detail.recharger(); void mouvements.recharger(); } } });

  if (demarrage.erreur && !demarrage.donnees) return <Page><EnTete titre="Session de caisse" /><EtatPos code={demarrage.erreur.code} message={demarrage.erreur.message} onReessayer={recharger} /></Page>;
  if (!demarrage.donnees || (!sessions.donnees && sessions.charge)) return <Page><EnTete titre="Session de caisse" /><EtatChargement texte="Chargement de la caisse…" /></Page>;
  const d = demarrage.donnees;
  if (!d.droits.vendre && !d.droits.ouvrir_caisse && !d.droits.fermer_caisse && !d.droits.voir_caisse) return <Page><EnTete titre="Session de caisse" /><EtatNonAutorise /></Page>;

  const listeCaisses = caisses.donnees?.caisses.filter((c) => c.actif) ?? [];
  const attendu = detail.donnees?.detail ?? ouverte?.detail ?? null;

  return (
    <Page>
      <EnTete titre="Session de caisse" sousTitre={`${d.magasin?.nom ?? ""}${d.magasin && d.caisse ? " — " : ""}${d.caisse?.nom ?? ""}`}>
        {listeCaisses.length > 1 && (
          <Champ label="Caisse" labelMasque>
            {(a) => (
              <select {...a} className={CLASSE_SAISIE} value={d.caisse?.id ?? ""} onChange={(e) => choisirCaisse(e.target.value)}>
                {listeCaisses.map((c) => <option key={c.id} value={c.id}>{c.magasinNom} — {c.nom}</option>)}
              </select>
            )}
          </Champ>
        )}
        {ouverte
          ? <Badge ton="positif" icone={<Unlock size={11} aria-hidden />}>{t("Caisse ouverte")}</Badge>
          : <Badge ton="neutre" icone={<Lock size={11} aria-hidden />}>{t("Caisse fermée")}</Badge>}
      </EnTete>

      {sessions.erreur && <EtatPos code={sessions.erreur.code} message={sessions.erreur.message} onReessayer={recharger} compact />}

      {!ouverte && !sessions.erreur && (
        <Ouverture defaut={d.reglages.caisse.fondsInitialDefaut} autorise={d.droits.ouvrir_caisse} caisseId={d.caisse?.id ?? caisseId} onOuverte={recharger} />
      )}

      {ouverte && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Chiffre label="Ouverte le" valeur={new Date(ouverte.ouverteAt).toLocaleTimeString(t.loc, { hour: "2-digit", minute: "2-digit" })} aide={new Date(ouverte.ouverteAt).toLocaleDateString(t.loc)} />
            <Chiffre label="Ventes" valeur={detail.donnees ? String(detail.donnees.ventes.nombre) : "—"} aide={detail.donnees ? fmt(detail.donnees.ventes.total) : undefined} />
            <Chiffre label="Encaissé, tous moyens" valeur={detail.donnees ? fmt(detail.donnees.ventes.encaisse) : "—"} aide="Hors ventes à crédit" />
            <Chiffre label="Espèces attendues" valeur={attendu ? fmt(attendu.attendu) : "—"} aide={attendu ? "Dans le tiroir, à cet instant" : "Réservé à qui ferme la caisse"} fort />
          </div>

          {detail.erreur && <EtatPos code={detail.erreur.code} message={detail.erreur.message} onReessayer={recharger} compact />}

          {detail.donnees && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Carte titre="Encaissements par moyen de paiement">
                {detail.donnees.paiements.length === 0 ? <EtatVide compact titre="Aucun encaissement pour l'instant" /> : (
                  <ul className="divide-y divide-[#F0F0F0]">
                    {detail.donnees.paiements.map((p) => (
                      <li key={`${p.mode}-${p.nonVerifie}`} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold">{t(MODES_PAIEMENT[p.mode as ModePaiement]?.libelle ?? p.mode)}</p>
                          <p className="text-[11px] text-[#888888]">{p.nombre} {t(p.nombre > 1 ? "opérations" : "opération")}</p>
                        </div>
                        <BadgePaiement statut={p.nonVerifie ? "declaratif" : "actif"} />
                        <span className="w-28 text-right text-[13px] font-bold tabular-nums">{fmt(p.montant)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {detail.donnees.paiements.some((p) => p.nonVerifie) && (
                  <p className="mt-3 text-[11.5px] leading-relaxed text-[#888888]">{t("« Non vérifié » : paiement confirmé par le caissier. AXSO n'est relié à aucun opérateur ni terminal de carte ; ces montants se pointent dans Rapprochement des paiements.")}</p>
                )}
              </Carte>
              <Carte titre="Détail du tiroir (espèces)">
                <LignesTiroir detail={detail.donnees.detail} fmt={fmt} />
              </Carte>
            </div>
          )}

          {voitMouvements && (
            <Carte titre="Mouvements de caisse" actions={d.droits.mouvement_caisse ? <Bouton variante="secondaire" taille="compact" onClick={() => setModale("mouvement")}>{t("Nouveau mouvement")}</Bouton> : undefined}>
              {mouvements.erreur ? <EtatPos code={mouvements.erreur.code} message={mouvements.erreur.message} onReessayer={() => void mouvements.recharger()} compact />
                : !mouvements.donnees ? <EtatChargement compact />
                : mouvements.donnees.mouvements.length === 0 ? <EtatVide compact titre="Aucun mouvement" texte="Retraits, dépôts, dépenses et corrections de cette session apparaîtront ici." />
                : <ListeMouvements mouvements={mouvements.donnees.mouvements} noms={mouvements.donnees.noms} fmt={fmt} />}
            </Carte>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Bouton variante="secondaire" icone={<Printer size={15} aria-hidden />} onClick={() => setRecap(ouverte.id)} disabled={!voitDetail}>{t("Récapitulatif")}</Bouton>
            <Bouton variante="sombre" icone={<Lock size={15} aria-hidden />} onClick={() => setModale("fermeture")} disabled={!d.droits.fermer_caisse}>{t("Fermer la caisse")}</Bouton>
          </div>
          {!d.droits.fermer_caisse && <p className="text-right text-[11.5px] text-[#888888]">{t("La fermeture de la caisse est réservée aux personnes qui en ont le droit.")}</p>}
        </>
      )}

      <Carte titre="Historique des sessions">
        {!sessions.donnees?.recentes.length ? <EtatVide compact titre="Aucune session enregistrée" /> : (
          <ul className="divide-y divide-[#F0F0F0]">
            {sessions.donnees.recentes.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setRecap(s.id)} disabled={!voitDetail}
                  className="flex min-h-11 w-full items-center gap-3 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111] disabled:cursor-default">
                  <History size={15} className="flex-shrink-0 text-[#AAAAAA]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold">{new Date(s.ouverteAt).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" })}</span>
                    <span className="block truncate text-[11px] text-[#888888]">{s.caisse.magasin.nom} — {s.caisse.nom}</span>
                  </span>
                  {s.statut === "ouverte" ? <Badge ton="positif">{t("Ouverte")}</Badge>
                    : s.ecart ? <Badge ton="danger">{t("Écart")} {s.ecart > 0 ? "+" : ""}{fmt(s.ecart)}</Badge>
                    : <Badge ton="neutre">{t("Fermée, sans écart")}</Badge>}
                  {s.montantCompte !== null && <span className="hidden w-28 text-right text-[13px] font-bold tabular-nums sm:block">{fmt(s.montantCompte)}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Carte>

      {modale === "mouvement" && <ModaleMouvement caisseId={d.caisse?.id ?? caisseId} attendu={attendu?.attendu ?? null} onFermer={() => setModale(null)} onEnregistre={() => { setModale(null); recharger(); }} />}
      {modale === "fermeture" && ouverte && (
        <ModaleFermeture devise={d.boutique.devise} attendu={attendu?.attendu ?? null} caisseId={d.caisse?.id ?? caisseId}
          onFermer={() => setModale(null)} onFermee={() => { setModale(null); setRecap(ouverte.id); recharger(); }} />
      )}
      <Tiroir ouverte={recap !== null} onFermer={() => setRecap(null)} titre="Récapitulatif de la session" largeur="lg">
        {recap && <Recap sessionId={recap} caisseId={caisseId} />}
      </Tiroir>
    </Page>
  );
}

function LignesTiroir({ detail, fmt }: { detail: DetailAttendu; fmt: (n: number) => string }) {
  const t = useT();
  const lignes: [string, number][] = [
    ["Fonds initial", detail.fondsInitial], ["Espèces encaissées", detail.especesEncaissees], ["Monnaie rendue", -detail.monnaieRendue],
    ["Dépôts", detail.depots], ["Retraits", -detail.retraits], ["Dépenses", -detail.depenses], ["Corrections", detail.corrections],
    ["Remboursements en espèces", -detail.remboursementsEspeces],
  ];
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {lignes.filter(([, v], i) => i === 0 || v !== 0).map(([label, v]) => (
          <tr key={label} className="border-b border-[#F0F0F0]"><td className="py-2 text-[#666666]">{t(label)}</td><td className="py-2 text-right tabular-nums">{v < 0 ? "− " : ""}{fmt(Math.abs(v))}</td></tr>
        ))}
        <tr className="total"><td className="py-2 font-bold">{t("Espèces attendues")}</td><td className="py-2 text-right font-bold tabular-nums">{fmt(detail.attendu)}</td></tr>
      </tbody>
    </table>
  );
}

function ListeMouvements({ mouvements, noms, fmt }: { mouvements: Mouvement[]; noms: Record<string, string>; fmt: (n: number) => string }) {
  const t = useT();
  return (
    <table className="w-full text-[13px]">
      <tbody>
        {mouvements.map((m) => (
          <tr key={m.id} className="border-b border-[#F0F0F0] align-top">
            <td className="py-2 pr-3">
              <span className="font-semibold">{t(libelleType(m.type))}</span> — {m.motif}
              <span className="block text-[11px] text-[#888888]">{new Date(m.createdAt).toLocaleString(t.loc, { dateStyle: "short", timeStyle: "short" })}{noms[m.creePar] ? ` · ${noms[m.creePar]}` : ""}</span>
            </td>
            <td className="whitespace-nowrap py-2 text-right font-bold tabular-nums">{signe(m) < 0 ? "− " : "+ "}{fmt(Math.abs(m.montant))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Ouverture({ defaut, autorise, caisseId, onOuverte }: { defaut: number; autorise: boolean; caisseId: string | null; onOuverte: () => void }) {
  const t = useT();
  const [fonds, setFonds] = useState(String(defaut || 0));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());
  if (!autorise) return <EtatNonAutorise titre="La caisse est fermée" texte="Vous n'avez pas le droit d'ouvrir la caisse. Demandez à un responsable de l'ouvrir." />;

  async function ouvrir() {
    const fondsInitial = lireMontant(fonds);
    if (!(fondsInitial >= 0)) { setErreur("Indiquez le fonds de caisse de départ (0 si le tiroir est vide)."); return; }
    setEnvoi(true); setErreur(null);
    const r = await envoyerMutation("caisse.ouvrir", { fondsInitial }, cle.current, { caisseId });
    setEnvoi(false);
    if (!r.ok) { setErreur(r.message); if (r.code === "caisse_deja_ouverte") onOuverte(); return; }
    cle.current = nouvelleCle();
    toast.success(t("Caisse ouverte"));
    onOuverte();
  }
  return (
    <Carte titre="Ouvrir la caisse">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void ouvrir(); }}>
        <Saisie label="Fonds initial" aide="Les espèces déjà dans le tiroir avant la première vente." inputMode="decimal" value={fonds} onChange={(e) => setFonds(e.target.value)} erreur={erreur} className="w-full sm:w-64" autoFocus />
        <Bouton type="submit" charge={envoi} icone={<Unlock size={15} aria-hidden />}>{t("Ouvrir la caisse")}</Bouton>
      </form>
    </Carte>
  );
}

function ModaleMouvement({ caisseId, attendu, onFermer, onEnregistre }: { caisseId: string | null; attendu: number | null; onFermer: () => void; onEnregistre: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [type, setType] = useState<TypeMouvement>("retrait");
  const [montant, setMontant] = useState("");
  const [moins, setMoins] = useState(true);
  const [categorie, setCategorie] = useState("fournitures");
  const [motif, setMotif] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);
  const cle = useRef(nouvelleCle());
  const def = TYPES.find((x) => x.id === type)!;

  async function enregistrer() {
    const valeur = lireMontant(montant);
    if (!(valeur > 0)) { setErreur({ code: "invalide", message: "Indiquez un montant supérieur à zéro." }); return; }
    if (motif.trim().length < 3) { setErreur({ code: "motif_requis", message: "Indiquez le motif de ce mouvement de caisse." }); return; }
    setEnvoi(true); setErreur(null);
    const r = await appelPos("/api/pos/mouvements-caisse", {
      method: "POST", caisseId,
      corps: { type, montant: type === "correction" && moins ? -valeur : valeur, motif: motif.trim(), ...(type === "depense" ? { categorie } : {}), cle: cle.current },
    });
    setEnvoi(false);
    if (!r.ok) { setErreur({ code: r.code, message: r.message }); return; }
    toast.success(t(r.rejoue ? "Ce mouvement était déjà enregistré." : "Mouvement de caisse enregistré"));
    onEnregistre();
  }

  return (
    <Modale ouverte onFermer={onFermer} titre="Nouveau mouvement de caisse" description={attendu !== null ? t("Espèces attendues dans le tiroir : {0}", fmt(attendu)) : undefined} verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={() => void enregistrer()} charge={envoi}>{t("Enregistrer")}</Bouton></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void enregistrer(); }}>
        <div role="group" aria-label={t("Type de mouvement")} className="grid grid-cols-2 gap-2">
          {TYPES.map(({ id, label, Icone }) => (
            <button key={id} type="button" aria-pressed={type === id} onClick={() => setType(id)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${type === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
              <Icone size={15} aria-hidden />{t(label)}
            </button>
          ))}
        </div>
        <p className="text-[12px] leading-relaxed text-[#666666]">{t(def.aide)}</p>
        {type === "correction" && (
          <div role="group" aria-label={t("Sens de la correction")} className="grid grid-cols-2 gap-2">
            {[[true, "Il y a moins dans le tiroir"], [false, "Il y a plus dans le tiroir"]].map(([v, label]) => (
              <button key={String(v)} type="button" aria-pressed={moins === v} onClick={() => setMoins(v as boolean)}
                className={`min-h-11 rounded-xl border px-3 text-[12.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${moins === v ? "border-[#F5A623] bg-[#FFF7ED]" : "border-[#E8E8E8] bg-white"}`}>
                {t(label as string)}
              </button>
            ))}
          </div>
        )}
        <Saisie label="Montant" inputMode="decimal" value={montant} onChange={(e) => setMontant(e.target.value)} autoFocus />
        {type === "depense" && (
          <Champ label="Catégorie de la dépense">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={categorie} onChange={(e) => setCategorie(e.target.value)}>{CATEGORIES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select>}
          </Champ>
        )}
        <Saisie label="Motif" value={motif} onChange={(e) => setMotif(e.target.value)} maxLength={300} placeholder={t(type === "depense" ? "Ex. : sacs d'emballage" : type === "retrait" ? "Ex. : dépôt en banque" : "Ex. : appoint de monnaie")} />
        {erreur && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-[#B91C1C]">{t(erreur.message)}</p>}
        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden>{t("Enregistrer")}</button>
      </form>
    </Modale>
  );
}

function ModaleFermeture({ devise, attendu, caisseId, onFermer, onFermee }: { devise: string; attendu: number | null; caisseId: string | null; onFermer: () => void; onFermee: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const coupures = useMemo(() => coupuresPour(devise), [devise]);
  const [parCoupures, setParCoupures] = useState(!!coupures);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [total, setTotal] = useState("");
  const [justification, setJustification] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  // L'attendu peut bouger pendant le comptage (vente d'une autre personne) : le serveur renvoie alors le sien.
  const [attenduServeur, setAttenduServeur] = useState<number | null>(null);
  const cle = useRef(nouvelleCle());

  const detailComptage = useMemo(() => Object.fromEntries(Object.entries(nombres).map(([k, v]) => [k, Math.max(0, Math.floor(Number(v) || 0))]).filter(([, n]) => (n as number) > 0)) as Record<string, number>, [nombres]);
  const compte = parCoupures ? totalComptage(detailComptage) : lireMontant(total);
  const reference = attenduServeur ?? attendu;
  const saisi = Number.isFinite(compte) && (parCoupures ? Object.keys(nombres).length > 0 : true);
  const ecart = saisi && reference !== null ? Math.round((compte - reference) * 100) / 100 : null;

  async function fermer() {
    if (!Number.isFinite(compte) || compte < 0) { setErreur("Indiquez le montant compté dans le tiroir."); return; }
    if (ecart && justification.trim().length < 3) { setErreur("Expliquez l'écart entre le montant attendu et le montant compté pour fermer la caisse."); return; }
    setEnvoi(true); setErreur(null);
    const r = await envoyerMutation("caisse.fermer", { compte, justification: justification.trim() || null, detailComptage: parCoupures ? detailComptage : null }, cle.current, { caisseId });
    setEnvoi(false);
    if (!r.ok) {
      if (r.code === "justification_requise" && typeof r.details?.attendu === "number") setAttenduServeur(r.details.attendu);
      setErreur(r.message);
      return;
    }
    toast.success(t("Caisse fermée"));
    onFermee();
  }

  return (
    <Modale ouverte onFermer={onFermer} titre="Fermer la caisse" description="Comptez les espèces du tiroir. L'écart avec le montant attendu est enregistré avec la session." taille="lg" verrouillee={envoi}
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton variante="sombre" onClick={() => void fermer()} charge={envoi} disabled={!saisi}>{t("Fermer la caisse")}</Bouton></>}>
      <div className="space-y-4">
        {coupures && (
          <div role="group" aria-label={t("Façon de compter")} className="grid grid-cols-2 gap-2">
            {[[true, "Compter par billets et pièces"], [false, "Saisir le total"]].map(([v, label]) => (
              <button key={String(v)} type="button" aria-pressed={parCoupures === v} onClick={() => setParCoupures(v as boolean)}
                className={`min-h-11 rounded-xl border px-3 text-[12.5px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${parCoupures === v ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white"}`}>
                {t(label as string)}
              </button>
            ))}
          </div>
        )}
        {parCoupures && coupures ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {coupures.map((c) => (
              <Saisie key={c} label={fmt(c)} inputMode="numeric" value={nombres[String(c)] ?? ""} placeholder="0"
                onChange={(e) => setNombres((n) => ({ ...n, [String(c)]: e.target.value.replace(/\D/g, "") }))}
                suffixe={Number(nombres[String(c)]) > 0 ? `= ${fmt(c * Number(nombres[String(c)]))}` : "×"} />
            ))}
          </div>
        ) : (
          <Saisie label="Espèces comptées" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} autoFocus />
        )}

        <div className="grid grid-cols-3 gap-2" aria-live="polite">
          <Chiffre label="Espèces attendues" valeur={reference !== null ? fmt(reference) : "—"} />
          <Chiffre label="Espèces comptées" valeur={saisi ? fmt(compte) : "—"} />
          <Chiffre label="Écart" valeur={ecart === null ? "—" : `${ecart > 0 ? "+" : ecart < 0 ? "− " : ""}${fmt(Math.abs(ecart))}`} fort ton={ecart ? "danger" : undefined} aide={ecart === null ? undefined : ecart === 0 ? "Le compte est bon" : ecart < 0 ? "Il manque de l'argent" : "Il y a trop d'argent"} />
        </div>

        {(ecart !== null && ecart !== 0) && (
          <Champ label="Justification de l'écart" aide="Obligatoire : elle est enregistrée dans le journal d'audit.">
            {(a) => <textarea {...a} className={CLASSE_SAISIE} rows={3} maxLength={500} value={justification} onChange={(e) => setJustification(e.target.value)} />}
          </Champ>
        )}
        {erreur && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-[#B91C1C]">{t(erreur)}</p>}
      </div>
    </Modale>
  );
}

/** Récapitulatif d'une session (en cours ou close), imprimable. */
function Recap({ sessionId, caisseId }: { sessionId: string; caisseId: string | null }) {
  const t = useT();
  const { fmt } = useDevise();
  const detail = useLecture<DetailSession>(`/api/pos/sessions/${sessionId}`, caisseId);
  const noms = useLecture<DonneesMouvements>(`/api/pos/mouvements-caisse?sessionCaisseId=${sessionId}`, caisseId);
  const feuille = useRef<HTMLDivElement>(null);
  const [imprimable, setImprimable] = useState(true);
  useEffect(() => setImprimable(true), [sessionId]);

  if (detail.erreur) return <EtatPos code={detail.erreur.code} message={detail.erreur.message} onReessayer={() => void detail.recharger()} compact />;
  if (!detail.donnees) return <EtatChargement compact />;
  const { session: s, detail: tiroir, paiements, ventes } = detail.donnees;
  const nom = (id: string | null) => (id && noms.donnees?.noms[id]) || "—";
  const quand = (d: string | null) => (d ? new Date(d).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" }) : "—");
  const close = s.statut === "fermee";
  const titre = close ? t("Clôture de caisse") : t("Session de caisse en cours");

  return (
    <div className="space-y-4">
      <div ref={feuille} className="space-y-4 text-[13px] [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:text-[11px] [&_h3]:font-bold [&_h3]:uppercase [&_h3]:tracking-wide [&_h3]:text-[#666666] [&_td]:border-b [&_td]:border-[#F0F0F0] [&_td]:py-1.5 [&_td:last-child]:text-right [&_td:last-child]:tabular-nums [&_table]:w-full [&_tr.total_td]:font-bold">
        <div>
          <h2 className="text-[16px] font-bold">{titre}</h2>
          <p>{s.caisse.magasin.nom} — {s.caisse.nom}</p>
          <p>{t("Ouverte le")} {quand(s.ouverteAt)} {t("par")} {nom(s.ouvertePar)}</p>
          {close && <p>{t("Fermée le")} {quand(s.fermeeAt)} {t("par")} {nom(s.fermeePar)}</p>}
        </div>

        <h3>{t("Ventes")}</h3>
        <table><tbody>
          <tr><td>{t("Nombre de ventes")}</td><td>{ventes.nombre}</td></tr>
          <tr><td>{t("Total des ventes")}</td><td>{fmt(ventes.total)}</td></tr>
          <tr><td>{t("Encaissé, tous moyens (hors crédit)")}</td><td>{fmt(ventes.encaisse)}</td></tr>
        </tbody></table>

        <h3>{t("Encaissements par moyen de paiement")}</h3>
        <table><tbody>
          {paiements.length === 0 && <tr><td>{t("Aucun encaissement")}</td><td /></tr>}
          {paiements.map((p) => (
            <tr key={`${p.mode}-${p.nonVerifie}`}><td>{t(MODES_PAIEMENT[p.mode as ModePaiement]?.libelle ?? p.mode)}{p.nonVerifie ? ` — ${t("Non vérifié")}` : ""} ({p.nombre})</td><td>{fmt(p.montant)}</td></tr>
          ))}
        </tbody></table>

        <h3>{t("Tiroir (espèces)")}</h3>
        <LignesTiroir detail={close && s.montantAttendu !== null ? { ...tiroir, attendu: s.montantAttendu } : tiroir} fmt={fmt} />
        {close && (
          <table><tbody>
            <tr className="total"><td>{t("Espèces comptées")}</td><td>{s.montantCompte !== null ? fmt(s.montantCompte) : "—"}</td></tr>
            <tr className="total"><td>{t("Écart")}</td><td>{s.ecart === null ? "—" : `${s.ecart > 0 ? "+" : s.ecart < 0 ? "− " : ""}${fmt(Math.abs(s.ecart))}`}</td></tr>
            {s.justificationEcart && <tr><td>{t("Justification")} : {s.justificationEcart}</td><td /></tr>}
          </tbody></table>
        )}

        {s.detailComptage && Object.keys(s.detailComptage).length > 0 && (
          <>
            <h3>{t("Comptage")}</h3>
            <table><tbody>
              {Object.entries(s.detailComptage).sort((a, b) => Number(b[0]) - Number(a[0])).map(([valeur, nombre]) => (
                <tr key={valeur}><td>{nombre} × {fmt(Number(valeur))}</td><td>{fmt(Number(valeur) * nombre)}</td></tr>
              ))}
            </tbody></table>
          </>
        )}

        {s.mouvements.length > 0 && (
          <>
            <h3>{t("Mouvements de caisse")}</h3>
            <table><tbody>
              {s.mouvements.map((m) => (
                <tr key={m.id}><td>{t(libelleType(m.type))} — {m.motif} ({nom(m.creePar)})</td><td>{signe(m) < 0 ? "− " : "+ "}{fmt(Math.abs(m.montant))}</td></tr>
              ))}
            </tbody></table>
          </>
        )}
        {close && <p className="pt-6">{t("Signature du caissier")} : ____________________ &nbsp; {t("Signature du responsable")} : ____________________</p>}
      </div>
      <div className="flex justify-end">
        <Bouton variante="secondaire" icone={<Printer size={15} aria-hidden />} disabled={!imprimable} onClick={() => setImprimable(imprimerElement(feuille.current, titre))}>{t("Imprimer")}</Bouton>
      </div>
      {!imprimable && <p role="alert" className="text-[12px] text-[#B91C1C]">{t("L'impression n'a pas pu être lancée sur cet appareil.")}</p>}
    </div>
  );
}
