"use client";
// Rapprochement des paiements de caisse : ce qui a été encaissé par moyen,
// ce qui reste à pointer, les doublons probables, les remboursements.
//
// L'écran ne dit que ce qu'AXSO sait (lib/pos/rapprochement.ts) : aucun
// opérateur Mobile Money ni terminal de carte n'est relié à la caisse, donc ces
// paiements sont « déclarés », jamais « confirmés ». Le pointage est manuel,
// relevé en main.
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Copy, Download } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgePaiement, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, Saisie, Tiroir, type Ton } from "@/components/pos/ui";
import { nouvelleCle } from "@/lib/pos/client/transport";
import { MODES_PAIEMENT } from "@/lib/pos/paiements";
import type { listerPaiements, LignePaiement } from "@/lib/pos/rapprochement";
import { Carte, EnTete, Page, appelPos, lireMontant, useLecture } from "./commun";

type Donnees = Awaited<ReturnType<typeof listerPaiements>>;

const VUES = [
  ["tous", "Tous", null], ["a_rapprocher", "À rapprocher", "aRapprocher"], ["ecart", "Écarts", "ecarts"], ["inconnu", "Inconnus", "inconnus"],
  ["doublons", "Doublons probables", "doublons"], ["remboursements", "Remboursements", "remboursements"], ["attente", "En attente ou échoués", "attente"],
] as const;
type Vue = (typeof VUES)[number][0];
const RAPPROCHEMENT: Record<string, { label: string; ton: Ton }> = {
  a_rapprocher: { label: "À rapprocher", ton: "attention" }, rapproche: { label: "Rapproché", ton: "positif" },
  ecart: { label: "Écart", ton: "danger" }, inconnu: { label: "Inconnu", ton: "danger" },
};
const jour = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function BadgePreuve({ p }: { p: Pick<LignePaiement, "preuve"> }) {
  const t = useT();
  if (p.preuve === "declare") return <BadgePaiement statut="declaratif" />;
  if (p.preuve === "pointe") return <Badge ton="info" icone={<CheckCircle2 size={11} aria-hidden />}>{t("Déclaré, pointé à la main")}</Badge>;
  if (p.preuve === "interne") return <BadgePaiement statut="actif" />;
  return <Badge ton="positif" icone={<CheckCircle2 size={11} aria-hidden />}>{t("Confirmé par le prestataire")}</Badge>;
}

export function Rapprochement() {
  const t = useT();
  const { fmt } = useDevise();
  const [debut, setDebut] = useState(() => jour(new Date(Date.now() - 6 * 86_400_000)));
  const [fin, setFin] = useState(() => jour(new Date()));
  const [mode, setMode] = useState("");
  const [session, setSession] = useState("");
  const [vue, setVue] = useState<Vue>("tous");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const cleLot = useRef(nouvelleCle());

  const requete = useMemo(() => {
    const p = new URLSearchParams();
    // Jours entiers, à l'heure du poste.
    if (debut) p.set("debut", new Date(`${debut}T00:00:00`).toISOString());
    if (fin) p.set("fin", new Date(`${fin}T23:59:59.999`).toISOString());
    if (mode) p.set("mode", mode);
    if (session) p.set("sessionCaisseId", session);
    if (vue === "a_rapprocher" || vue === "ecart" || vue === "inconnu") p.set("rapprochement", vue);
    else if (vue !== "tous") p.set("vue", vue);
    return p.toString();
  }, [debut, fin, mode, session, vue]);
  const liste = useLecture<Donnees>(`/api/pos/rapprochement?${requete}`);
  const d = liste.donnees;
  const paiement = d?.paiements.find((p) => p.id === ouvert) ?? null;
  const pointables = d?.paiements.filter((p) => p.declaratif && p.rapprochement !== "rapproche") ?? [];

  async function pointerSelection() {
    setEnvoi(true);
    const r = await appelPos<{ pointes: number }>("/api/pos/rapprochement", { method: "POST", corps: { ids: choisis, statut: "rapproche", cle: cleLot.current } });
    setEnvoi(false);
    if (!r.ok) { toast.error(t(r.message)); return; }
    cleLot.current = nouvelleCle();
    toast.success(t("{0} paiement(s) pointé(s)", r.donnees.pointes));
    setChoisis([]); void liste.recharger();
  }

  return (
    <Page>
      <EnTete titre="Rapprochement des paiements" sousTitre="Vente → paiement → prestataire → règlement → comptabilité : ce qu'AXSO sait de chaque encaissement de caisse.">
        <a href={`/api/pos/rapprochement?${requete}&format=csv`} download className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E8E8E8] bg-white px-4 text-[13px] font-bold text-[#111111] hover:border-[#F5A623] ${FOCUS}`}>
          <Download size={15} aria-hidden />{t("Exporter en CSV")}
        </a>
      </EnTete>

      <p className="flex items-start gap-2 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] p-3 text-[12.5px] leading-relaxed text-[#92400E]">
        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" aria-hidden />
        <span>{t("Aucun opérateur Mobile Money ni terminal de carte n'est relié à la caisse (intégration en attente). Ces paiements sont déclarés par le caissier : AXSO ne peut pas les confirmer. Pointez-les ici avec la référence lue sur votre relevé.")}</span>
      </p>

      <Carte>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Saisie label="Du" type="date" value={debut} max={fin} onChange={(e) => setDebut(e.target.value)} />
          <Saisie label="Au" type="date" value={fin} min={debut} onChange={(e) => setFin(e.target.value)} />
          <Champ label="Moyen de paiement">
            {(a) => <select {...a} className={CLASSE_SAISIE} value={mode} onChange={(e) => setMode(e.target.value)}><option value="">{t("Tous")}</option>{Object.values(MODES_PAIEMENT).filter((m) => m.statut !== "a_connecter").map((m) => <option key={m.id} value={m.id}>{t(m.libelle)}</option>)}</select>}
          </Champ>
          <Champ label="Session de caisse">
            {(a) => (
              <select {...a} className={CLASSE_SAISIE} value={session} onChange={(e) => setSession(e.target.value)}>
                <option value="">{t("Toutes")}</option>
                {d?.sessions.map((s) => <option key={s.id} value={s.id}>{new Date(s.ouverteAt).toLocaleString(t.loc, { dateStyle: "short", timeStyle: "short" })}{s.caisse ? ` · ${s.caisse}` : ""}</option>)}
              </select>
            )}
          </Champ>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={t("Filtrer les paiements")}>
          {VUES.map(([id, label, compteur]) => (
            <button key={id} type="button" aria-pressed={vue === id} onClick={() => { setVue(id); setChoisis([]); }}
              className={`min-h-11 rounded-xl border px-3 text-[12px] font-semibold ${FOCUS} ${vue === id ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#111111]"}`}>
              {t(label)}{compteur && d ? ` (${d.compteurs[compteur]})` : ""}
            </button>
          ))}
        </div>
      </Carte>

      {liste.erreur && !d ? <EtatPos code={liste.erreur.code} message={liste.erreur.message} onReessayer={() => void liste.recharger()} />
        : !d ? <EtatChargement texte="Chargement des paiements…" />
        : (
          <>
            {d.tronque && <p role="status" className="text-[12px] text-[#B45309]">{t("Cette période contient plus de paiements que ce qui est affiché. Resserrez les dates pour tout voir.")}</p>}
            {d.parMode.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {d.parMode.map((m) => (
                  <div key={m.mode} className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
                    <div className="flex items-center justify-between gap-2"><p className="truncate text-[13px] font-bold">{t(m.libelle)}</p><BadgePaiement statut={m.statut as "actif" | "declaratif" | "a_connecter"} /></div>
                    <p className="mt-2 text-[20px] font-bold tabular-nums">{fmt(m.encaisse - m.rembourse)}</p>
                    <p className="text-[11px] text-[#888888]">{m.nombre} {t(m.nombre > 1 ? "opérations" : "opération")}{m.rembourse > 0 ? ` · ${t("dont remboursé")} ${fmt(m.rembourse)}` : ""}</p>
                    {m.statut === "declaratif" && <p className="mt-1 text-[11.5px] font-semibold text-[#B45309]">{t("Reste à rapprocher")} : {fmt(m.aRapprocher)}</p>}
                  </div>
                ))}
              </div>
            )}

            <Carte titre="Paiements" actions={choisis.length > 0 ? <Bouton taille="compact" charge={envoi} onClick={() => void pointerSelection()}>{t("Pointer la sélection ({0})", choisis.length)}</Bouton> : undefined}>
              {d.paiements.length === 0 ? <EtatVide compact titre={vue === "attente" ? "Aucun paiement en attente ou échoué" : vue === "doublons" ? "Aucun doublon probable" : "Aucun paiement sur cette période"} texte={vue === "attente" ? "Les paiements de la caisse sont enregistrés une fois reçus : aucun n'est suivi « en attente » tant qu'aucun prestataire n'est relié." : undefined} /> : (
                <ul className="divide-y divide-[#F0F0F0]">
                  {d.paiements.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-1.5">
                      {pointables.some((x) => x.id === p.id) && p.reference ? (
                        <input type="checkbox" aria-label={t("Sélectionner le paiement de la vente {0}", p.numero)} className="h-5 w-5 flex-shrink-0 accent-[#F5A623]" checked={choisis.includes(p.id)}
                          onChange={(e) => setChoisis((c) => (e.target.checked ? [...c, p.id] : c.filter((x) => x !== p.id)))} />
                      ) : <span className="w-5 flex-shrink-0" aria-hidden />}
                      <button type="button" onClick={() => setOuvert(p.id)} className={`flex min-h-11 min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-1 py-1 text-left ${FOCUS}`}>
                        <span className="min-w-0 flex-1 basis-40">
                          <span className="block truncate text-[13px] font-semibold">{t(p.libelle)} · #{p.numero}{p.venteAnnulee ? ` (${t("vente annulée")})` : ""}</span>
                          <span className="block truncate text-[11px] text-[#888888]">{new Date(p.createdAt).toLocaleString(t.loc, { dateStyle: "short", timeStyle: "short" })} · {p.clientNom}{p.reference ? ` · ${t("réf.")} ${p.reference}` : ""}</span>
                        </span>
                        {p.doublon && <Badge ton="danger" icone={<Copy size={11} aria-hidden />}>{t(p.doublon === "reference" ? "Même référence" : "Doublon probable")}</Badge>}
                        {p.statut === "en_attente" && <Badge ton="info" icone={<Clock size={11} aria-hidden />}>{t("En attente")}</Badge>}
                        {p.statut === "echoue" && <Badge ton="danger">{t("Échoué")}</Badge>}
                        {p.montant < 0 && <Badge ton="neutre">{t("Remboursement")}</Badge>}
                        <BadgePreuve p={p} />
                        {p.declaratif && <Badge ton={RAPPROCHEMENT[p.rapprochement]?.ton ?? "neutre"}>{t(RAPPROCHEMENT[p.rapprochement]?.label ?? p.rapprochement)}</Badge>}
                        <span className="w-24 text-right text-[13px] font-bold tabular-nums">{fmt(p.montant)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          </>
        )}

      <Tiroir ouverte={paiement !== null} onFermer={() => setOuvert(null)} titre="Détail du paiement">
        {paiement && <DetailPaiement key={paiement.id} p={paiement} onPointe={() => { void liste.recharger(); }} />}
      </Tiroir>
    </Page>
  );
}

const TON_ETAPE: Record<string, Ton> = { ok: "positif", declare: "attention", attente: "neutre", alerte: "danger" };
const NOM_ETAPE: Record<string, string> = { vente: "Vente", paiement: "Paiement", prestataire: "Prestataire", reglement: "Règlement", comptabilite: "Comptabilité" };

function DetailPaiement({ p, onPointe }: { p: LignePaiement; onPointe: () => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const [reference, setReference] = useState(p.reference ?? "");
  const [constate, setConstate] = useState("");
  const [note, setNote] = useState("");
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());

  async function pointer(statut: "rapproche" | "ecart" | "inconnu" | "a_rapprocher") {
    const montantConstate = lireMontant(constate);
    setEnvoi(statut); setErreur(null);
    const r = await appelPos("/api/pos/rapprochement", {
      method: "POST",
      corps: { ids: [p.id], statut, cle: cle.current, reference: reference.trim() || null, note: note.trim() || null, ...(statut === "ecart" && Number.isFinite(montantConstate) ? { montantConstate } : {}) },
    });
    setEnvoi(null);
    if (!r.ok) { setErreur(r.message); return; }
    cle.current = nouvelleCle();
    toast.success(t("Pointage enregistré"));
    onPointe();
  }

  return (
    <div className="space-y-5 text-[13px]">
      <div>
        <p className="text-[22px] font-bold tabular-nums">{fmt(p.montant)}</p>
        <p className="text-[#666666]">{t(p.libelle)} · {t("vente")} #{p.numero} · {p.clientNom}</p>
        <p className="text-[12px] text-[#888888]">{new Date(p.createdAt).toLocaleString(t.loc, { dateStyle: "medium", timeStyle: "short" })}{p.caisse ? ` · ${p.caisse}` : ""}{p.encaissePar ? ` · ${p.encaissePar}` : ""}</p>
        {p.prestataire && <p className="text-[12px] text-[#888888]">{t("Opérateur indiqué par le caissier")} : {p.prestataire}</p>}
      </div>

      <ol className="space-y-2" aria-label={t("Chaîne du paiement")}>
        {p.chaine.map((e) => (
          <li key={e.etape} className="flex items-start gap-3">
            <Badge ton={TON_ETAPE[e.etat]} className="w-28 justify-center">{t(NOM_ETAPE[e.etape])}</Badge>
            <span className="pt-0.5 leading-snug">{t(e.texte)}</span>
          </li>
        ))}
      </ol>

      {p.doublon && (
        <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-relaxed text-[#B91C1C]">
          {t(p.doublon === "reference" ? "La même référence est saisie sur un autre paiement de la période : la transaction a peut-être été comptée deux fois." : "Un autre paiement du même moyen et du même montant a été enregistré à quelques minutes d'écart. Ce n'est qu'un soupçon : vérifiez sur le relevé.")}
        </p>
      )}

      {p.declaratif ? (
        <div className="space-y-3 border-t border-[#F0F0F0] pt-4">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Pointage manuel")}</h3>
          <Saisie label="Référence lue sur le relevé" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} aide="Obligatoire pour pointer le paiement comme rapproché." />
          <Bouton large onClick={() => void pointer("rapproche")} charge={envoi === "rapproche"} disabled={envoi !== null} icone={<CheckCircle2 size={15} aria-hidden />}>{t("Pointer comme rapproché")}</Bouton>
          <div className="grid gap-3 sm:grid-cols-2">
            <Saisie label="Montant vu sur le relevé" inputMode="decimal" value={constate} onChange={(e) => setConstate(e.target.value)} />
            <Saisie label="Note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Bouton variante="danger" onClick={() => void pointer("ecart")} charge={envoi === "ecart"} disabled={envoi !== null}>{t("Signaler un écart")}</Bouton>
            <Bouton variante="danger" onClick={() => void pointer("inconnu")} charge={envoi === "inconnu"} disabled={envoi !== null}>{t("Introuvable sur le relevé")}</Bouton>
          </div>
          {p.rapprochement !== "a_rapprocher" && <Bouton variante="secondaire" large onClick={() => void pointer("a_rapprocher")} charge={envoi === "a_rapprocher"} disabled={envoi !== null}>{t("Remettre « à rapprocher »")}</Bouton>}
          {erreur && <p role="alert" className="text-[12.5px] leading-relaxed text-[#B91C1C]">{t(erreur)}</p>}
          <p className="text-[11.5px] leading-relaxed text-[#888888]">{t("Chaque pointage est tracé dans le journal d'audit avec votre nom.")}</p>
        </div>
      ) : (
        <p className="border-t border-[#F0F0F0] pt-4 text-[12.5px] leading-relaxed text-[#666666]">{t("Ce paiement est tenu par AXSO (espèces comptées à la fermeture de la caisse, crédit client ou avoir) : il n'y a rien à pointer.")}</p>
      )}
    </div>
  );
}
