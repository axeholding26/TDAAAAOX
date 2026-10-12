"use client";
// Journal d'audit de la caisse — consultation seule : qui a fait quoi, quand,
// sur quelle caisse, avec l'état avant et après. Rien ne s'y modifie.
//
// L'indicateur d'intégrité relit la chaîne de hachage (verifierChaineAudit).
// Il dit ce qu'il prouve, pas plus : une ligne modifiée ou retirée par
// l'application ou un accès ordinaire se voit ; un administrateur de la base de
// données pourrait réécrire toute la chaîne.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Saisie, Tiroir } from "@/components/pos/ui";
import { Carte, EnTete, Page, appelPos, useLecture, type ErreurAppel } from "./commun";

type Entree = {
  id: string; seq: number; action: string; entite: string; entiteId: string | null; userId: string | null; userNom: string | null;
  magasinId: string | null; caisseId: string | null; appareilId: string | null; sessionCaisseId: string | null; ip: string | null;
  avant: unknown; apres: unknown; motif: string | null; hash: string; createdAt: string;
};
type Reponse = {
  entrees: Entree[]; curseurSuivant: number | null;
  filtres: { actions: { action: string; nombre: number }[]; entites: string[]; utilisateurs: { id: string; nom: string }[]; caisses: { id: string; nom: string }[] };
};
type Integrite = { valide: boolean; total: number; verifiees: number; rupture: number | null; partiel: boolean; verifieAt: string };

const ACTIONS: Record<string, string> = {
  "vente.creee": "Vente enregistrée", "vente.remise": "Remise ou geste commercial", "vente.annulee": "Vente annulée",
  "caisse.ouverte": "Caisse ouverte", "caisse.fermee": "Caisse fermée", "caisse.mouvement": "Mouvement de caisse",
  "caisse.creee": "Caisse créée", "caisse.modifiee": "Caisse modifiée", "magasin.cree": "Magasin créé", "magasin.modifie": "Magasin modifié",
  "reglages.modifies": "Réglages modifiés", "retour.cree": "Retour enregistré", "retour.echange": "Échange enregistré",
  "paiement.rapproche": "Paiement pointé", "charge.creee": "Charge enregistrée", "charge.modifiee": "Charge modifiée", "charge.supprimee": "Charge supprimée",
};
const VIDE = { action: "", userId: "", caisseId: "", entite: "", debut: "", fin: "" };

export function JournalAudit() {
  const t = useT();
  const [filtres, setFiltres] = useState(VIDE);
  const [entrees, setEntrees] = useState<Entree[]>([]);
  const [listes, setListes] = useState<Reponse["filtres"] | null>(null);
  const [curseur, setCurseur] = useState<number | null>(null);
  const [charge, setCharge] = useState(true);
  const [erreur, setErreur] = useState<ErreurAppel | null>(null);
  const [ouverte, setOuverte] = useState<Entree | null>(null);
  const integrite = useLecture<Integrite>("/api/pos/audit/integrite");
  const tour = useRef(0);

  const requete = useMemo(() => {
    const p = new URLSearchParams();
    for (const cle of ["action", "userId", "caisseId", "entite"] as const) if (filtres[cle]) p.set(cle, filtres[cle]);
    if (filtres.debut) p.set("debut", new Date(`${filtres.debut}T00:00:00`).toISOString());
    if (filtres.fin) p.set("fin", new Date(`${filtres.fin}T23:59:59.999`).toISOString());
    return p.toString();
  }, [filtres]);

  const charger = useCallback(async (depuis: number | null) => {
    const moi = ++tour.current;
    setCharge(true);
    const r = await appelPos<Reponse>(`/api/pos/audit?${requete}${depuis ? `&curseur=${depuis}` : ""}`);
    if (moi !== tour.current) return;
    setCharge(false);
    if (!r.ok) { setErreur({ code: r.code, message: r.message }); return; }
    setErreur(null);
    setEntrees((e) => (depuis ? [...e, ...r.donnees.entrees] : r.donnees.entrees));
    setCurseur(r.donnees.curseurSuivant);
    setListes(r.donnees.filtres);
  }, [requete]);
  useEffect(() => { void charger(null); }, [charger]);

  const choisir = (cle: keyof typeof VIDE) => (e: { target: { value: string } }) => setFiltres((f) => ({ ...f, [cle]: e.target.value }));
  const nomCaisse = (id: string | null) => listes?.caisses.find((c) => c.id === id)?.nom ?? null;
  const filtre = Object.values(filtres).some(Boolean);
  const i = integrite.donnees;

  return (
    <Page>
      <EnTete titre="Journal d'audit" sousTitre="Annulations, remboursements, remises, mouvements et fermetures de caisse, réglages : chaque opération sensible, avec son auteur. En lecture seule." />

      <div role="status" className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${i && !i.valide ? "border-[#FECACA] bg-[#FEF2F2]" : "border-[#E8E8E8] bg-white"}`}>
        {i && !i.valide ? <ShieldAlert size={22} className="flex-shrink-0 text-[#B91C1C]" aria-hidden /> : <ShieldCheck size={22} className={`flex-shrink-0 ${i ? "text-[#15803D]" : "text-[#AAAAAA]"}`} aria-hidden />}
        <div className="min-w-0 flex-1 basis-60 text-[12.5px] leading-relaxed">
          {integrite.erreur ? <p className="text-[#B91C1C]">{t("L'intégrité du journal n'a pas pu être vérifiée :")} {t(integrite.erreur.message)}</p>
            : !i ? <p className="text-[#666666]">{t("Vérification de l'intégrité du journal…")}</p>
            : !i.valide ? <p className="font-semibold text-[#B91C1C]">{t("Chaîne rompue à la ligne n° {0} : une ligne du journal a été modifiée ou retirée. Prévenez le propriétaire de la boutique.", i.rupture ?? "?")}</p>
            : (
              <>
                <p className="font-semibold text-[#111111]">{t(i.partiel ? "Chaîne intacte sur les {0} premières lignes vérifiées (journal de {1} lignes)." : i.total === 0 ? "Le journal est vide." : "Chaîne intacte : {0} lignes vérifiées, aucune modifiée ni retirée.", i.verifiees, i.total)}</p>
                <p className="text-[11.5px] text-[#888888]">{t("Chaque ligne est scellée avec la précédente. Cette vérification protège contre les modifications faites par l'application ; elle ne peut rien contre un administrateur de la base de données.")}</p>
              </>
            )}
        </div>
        <Bouton variante="secondaire" taille="compact" charge={integrite.charge} onClick={() => void integrite.recharger()}>{t("Vérifier à nouveau")}</Bouton>
      </div>

      <Carte>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Champ label="Action">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={filtres.action} onChange={choisir("action")}><option value="">{t("Toutes")}</option>{listes?.actions.map((x) => <option key={x.action} value={x.action}>{t(ACTIONS[x.action] ?? x.action)} ({x.nombre})</option>)}</select>}
          </Champ>
          <Champ label="Utilisateur">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={filtres.userId} onChange={choisir("userId")}><option value="">{t("Tous")}</option>{listes?.utilisateurs.map((u) => <option key={u.id} value={u.id}>{u.nom}</option>)}</select>}
          </Champ>
          <Champ label="Caisse">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={filtres.caisseId} onChange={choisir("caisseId")}><option value="">{t("Toutes")}</option>{listes?.caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>}
          </Champ>
          <Champ label="Élément concerné">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={filtres.entite} onChange={choisir("entite")}><option value="">{t("Tous")}</option>{listes?.entites.map((e) => <option key={e} value={e}>{e}</option>)}</select>}
          </Champ>
          <Saisie label="Du" type="date" value={filtres.debut} max={filtres.fin || undefined} onChange={choisir("debut")} />
          <Saisie label="Au" type="date" value={filtres.fin} min={filtres.debut || undefined} onChange={choisir("fin")} />
        </div>
        {filtre && <div className="mt-3 flex justify-end"><Bouton variante="secondaire" taille="compact" onClick={() => setFiltres(VIDE)}>{t("Effacer les filtres")}</Bouton></div>}
      </Carte>

      {erreur ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => void charger(null)} />
        : charge && !entrees.length ? <EtatChargement texte="Chargement du journal…" />
        : !entrees.length ? <EtatVide titre={filtre ? "Aucune ligne ne correspond à ces filtres" : "Le journal est vide"} texte={filtre ? undefined : "Les opérations sensibles de la caisse s'inscriront ici au fur et à mesure."} />
        : (
          <Carte>
            <ul className="divide-y divide-[#F0F0F0]">
              {entrees.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setOuverte(e)} className={`flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-2 text-left ${FOCUS}`}>
                    <span className="min-w-0 flex-1 basis-48">
                      <span className="block truncate text-[13px] font-semibold">{t(ACTIONS[e.action] ?? e.action)}</span>
                      <span className="block truncate text-[11px] text-[#888888]">{e.userNom ?? t("Système")}{nomCaisse(e.caisseId) ? ` · ${nomCaisse(e.caisseId)}` : ""}{e.motif ? ` · ${e.motif}` : ""}</span>
                    </span>
                    <Badge ton="neutre">{e.entite}</Badge>
                    <span className="w-32 text-right text-[11.5px] tabular-nums text-[#666666]">{new Date(e.createdAt).toLocaleString(t.loc, { dateStyle: "short", timeStyle: "medium" })}</span>
                  </button>
                </li>
              ))}
            </ul>
            {curseur !== null && <div className="mt-3 flex justify-center"><Bouton variante="secondaire" charge={charge} onClick={() => void charger(curseur)}>{t("Afficher la suite")}</Bouton></div>}
          </Carte>
        )}

      <Tiroir ouverte={ouverte !== null} onFermer={() => setOuverte(null)} titre={ouverte ? ACTIONS[ouverte.action] ?? ouverte.action : "Détail"} largeur="lg">
        {ouverte && <Detail e={ouverte} caisse={nomCaisse(ouverte.caisseId)} />}
      </Tiroir>
    </Page>
  );
}

/** Aplatit un objet en « chemin → valeur lisible » (un niveau par point), pour comparer avant et après. */
function aplatir(v: unknown, prefixe = "", sortie: Record<string, string> = {}): Record<string, string> {
  if (v !== null && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) {
    for (const [cle, valeur] of Object.entries(v)) aplatir(valeur, prefixe ? `${prefixe}.${cle}` : cle, sortie);
  } else if (v !== undefined && (prefixe || v !== null)) {
    sortie[prefixe || "valeur"] = v === null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }
  return sortie;
}

function Detail({ e, caisse }: { e: Entree; caisse: string | null }) {
  const t = useT();
  const avant = aplatir(e.avant), apres = aplatir(e.apres);
  const cles = [...new Set([...Object.keys(avant), ...Object.keys(apres)])];
  const infos: [string, string | null][] = [
    ["Date", new Date(e.createdAt).toLocaleString(t.loc, { dateStyle: "full", timeStyle: "medium" })], ["Utilisateur", e.userNom ?? t("Système")],
    ["Caisse", caisse], ["Élément concerné", `${e.entite}${e.entiteId ? ` · ${e.entiteId}` : ""}`], ["Session de caisse", e.sessionCaisseId],
    ["Appareil", e.appareilId], ["Adresse IP", e.ip], ["Motif", e.motif], ["Ligne n°", String(e.seq)],
  ];
  return (
    <div className="space-y-5 text-[13px]">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {infos.filter(([, v]) => v).map(([label, v]) => (
          <div key={label} className="contents"><dt className="text-[#888888]">{t(label)}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>
        ))}
      </dl>
      {cles.length === 0 ? <p className="text-[#888888]">{t("Cette opération n'a pas d'état avant / après enregistré.")}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead><tr className="border-b border-[#E8E8E8] text-left text-[11px] uppercase tracking-wide text-[#666666]"><th className="py-2 pr-3 font-semibold">{t("Champ")}</th><th className="py-2 pr-3 font-semibold">{t("Avant")}</th><th className="py-2 font-semibold">{t("Après")}</th></tr></thead>
            <tbody>
              {cles.map((cle) => {
                const change = cle in avant && cle in apres && avant[cle] !== apres[cle];
                return (
                  <tr key={cle} className={`border-b border-[#F0F0F0] align-top ${change ? "bg-[#FFFBEB]" : ""}`}>
                    <td className="py-1.5 pr-3 font-mono text-[11.5px] text-[#666666]">{cle}</td>
                    <td className="max-w-[14rem] break-words py-1.5 pr-3">{avant[cle] ?? ""}</td>
                    <td className="max-w-[14rem] break-words py-1.5 font-medium">{apres[cle] ?? ""}{change && <span className="sr-only"> ({t("modifié")})</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="break-all font-mono text-[10.5px] text-[#AAAAAA]">{t("Empreinte")} : {e.hash}</p>
    </div>
  );
}
