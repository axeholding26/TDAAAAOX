"use client";
// Crédit client : encours, retards, détail par client, plafond et blocage,
// encaissement d'un remboursement, message de relance prêt à copier.
// Aucun message n'est envoyé par AXSO : la relance est un texte que le
// commerçant copie ou ouvre dans WhatsApp, et qu'il envoie lui-même.
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, BadgePaiement, Bouton, CLASSE_SAISIE, Champ, EtatChargement, EtatPos, EtatVide, FOCUS, POLICE, Saisie, Tiroir } from "@/components/pos/ui";
import { appelPos, nouvelleCle } from "@/components/pos/crm/appel";
import { SelecteurClient } from "@/components/pos/crm/SelecteurClient";
import { dateCourte } from "@/components/pos/crm/libelles";
import { useCaisse } from "@/components/pos/finance/commun";
import { cn } from "@/lib/utils";

type Regles = { actif: boolean; plafondDefaut: number; echeanceJours: number };
type Debiteur = {
  id: string; nom: string; telephone: string | null; plafond: number; utilise: number; disponible: number; bloque: boolean; echeanceJours: number | null;
  enRetard: number; joursRetard: number; bloqueAuto: boolean; prochaineEcheance: string | null;
};
type Detail = {
  echeances: { commandeId: string; numero: string | null; reste: number; echeance: string | null; enRetard: boolean; joursRetard: number }[];
  mouvements: { id: string; type: string; montant: number; soldeApres: number; vente: string | null; echeance: string | null; date: string }[];
};
type Mode = { id: string; libelle: string; statut: "actif" | "declaratif" | "a_connecter"; reference: string; mention: string };
type Donnees = {
  regles: Regles; peutGerer: boolean; peutEncaisser: boolean; boutique: { nom: string; telephone: string | null }; modes: Mode[];
  caisse: { sessionOuverte: boolean; sessionObligatoire: boolean }; encours: number; debiteurs: number; enRetard: number; clients: Debiteur[]; detail: Detail | null;
};

const LIBELLES_MOUVEMENT: Record<string, string> = { vente: "Vente à crédit", remboursement: "Remboursement", ajustement: "Annulation de vente" };

export default function PageCredit() {
  const t = useT();
  const { fmt, devise } = useDevise();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [filtre, setFiltre] = useState<"tous" | "retard">("tous");
  const [regles, setRegles] = useState({ actif: false, plafondDefaut: "", echeanceJours: "" });
  const [envoiRegles, setEnvoiRegles] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });
  // Client ouvert dans le tiroir (peut ne pas encore figurer dans la liste : premier crédit).
  const [ouvert, setOuvert] = useState<{ id: string; nom: string; telephone: string | null } | null>(null);
  const [compte, setCompte] = useState({ plafond: "", echeanceJours: "", bloque: false });
  const [envoiCompte, setEnvoiCompte] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });
  const [paiement, setPaiement] = useState({ montant: "", mode: "", reference: "" });
  const [envoiPaiement, setEnvoiPaiement] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });
  // Confirmation affichée DANS le tiroir : une notification flottante passerait derrière lui.
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const cle = useRef(nouvelleCle());
  // Caisse de ce poste : le remboursement entre dans SA session, pas dans celle de la caisse par défaut.
  const [caisseId] = useCaisse();

  const charger = useCallback(async (clientId?: string | null) => {
    setErreur(null);
    const r = await appelPos<Donnees>(`/api/pos/credit${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`, { caisseId });
    if (!r.ok) return setErreur(r);
    setD(r.donnees);
    setRegles({ actif: r.donnees.regles.actif, plafondDefaut: String(r.donnees.regles.plafondDefaut), echeanceJours: String(r.donnees.regles.echeanceJours) });
    const c = r.donnees.clients.find((x) => x.id === clientId);
    setCompte({ plafond: c ? String(c.plafond) : "0", echeanceJours: c?.echeanceJours ? String(c.echeanceJours) : "", bloque: c?.bloque ?? false });
    setPaiement((p) => ({ ...p, mode: p.mode || r.donnees.modes[0]?.id || "" }));
  }, [caisseId]);
  useEffect(() => { charger(); }, [charger]);

  function ouvrir(c: { id: string; nom: string; telephone: string | null }) {
    setOuvert(c); setEnvoiCompte({ enCours: false }); setEnvoiPaiement({ enCours: false }); setConfirmation(null);
    setPaiement((p) => ({ ...p, montant: "", reference: "" }));
    cle.current = nouvelleCle();
    setD((x) => x && { ...x, detail: null });
    charger(c.id);
  }

  async function enregistrerRegles() {
    setEnvoiRegles({ enCours: true });
    const r = await appelPos("/api/pos/credit", { method: "PATCH", corps: { actif: regles.actif, plafondDefaut: Number(regles.plafondDefaut) || 0, echeanceJours: Math.round(Number(regles.echeanceJours)) } });
    if (!r.ok) return setEnvoiRegles({ enCours: false, erreur: r.message });
    setEnvoiRegles({ enCours: false });
    toast.success(t("Règles de crédit enregistrées."));
    charger(ouvert?.id);
  }

  async function enregistrerCompte() {
    if (!ouvert) return;
    setEnvoiCompte({ enCours: true });
    const r = await appelPos(`/api/pos/clients/${ouvert.id}`, { method: "PATCH", corps: { creditPlafond: Number(compte.plafond) || 0, creditBloque: compte.bloque, creditEcheanceJours: compte.echeanceJours ? Math.round(Number(compte.echeanceJours)) : null } });
    if (!r.ok) return setEnvoiCompte({ enCours: false, erreur: r.message });
    setEnvoiCompte({ enCours: false });
    setConfirmation(t("Compte de crédit mis à jour."));
    charger(ouvert.id);
  }

  async function encaisser() {
    if (!ouvert) return;
    setEnvoiPaiement({ enCours: true });
    const r = await appelPos<{ rembourse: number; resteDu: number; nonVerifie: boolean }>("/api/pos/credit/remboursements", {
      corps: { clientId: ouvert.id, montant: Number(paiement.montant), mode: paiement.mode, reference: paiement.reference || null }, cle: cle.current, caisseId,
    });
    if (!r.ok) return setEnvoiPaiement({ enCours: false, erreur: r.message });
    cle.current = nouvelleCle();
    setEnvoiPaiement({ enCours: false });
    setPaiement((p) => ({ ...p, montant: "", reference: "" }));
    setConfirmation(`${t("Remboursement encaissé")} : ${fmt(r.donnees.rembourse)}${r.donnees.nonVerifie ? ` (${t("Non vérifié")})` : ""} · ${t("reste dû")} ${fmt(r.donnees.resteDu)}`);
    charger(ouvert.id);
  }

  if (erreur && !d) return <div className="mx-auto max-w-5xl p-4 sm:p-5" style={POLICE}><EtatPos code={erreur.code} message={erreur.message} onReessayer={() => charger(ouvert?.id)} /></div>;
  if (!d) return <EtatChargement texte="Chargement du crédit client…" />;

  const liste = d.clients.filter((c) => (filtre === "retard" ? c.enRetard > 0 : true));
  const client = ouvert ? d.clients.find((c) => c.id === ouvert.id) ?? null : null;
  const modeChoisi = d.modes.find((m) => m.id === paiement.mode);
  const caisseFermee = d.caisse.sessionObligatoire && !d.caisse.sessionOuverte;
  const carte = "rounded-2xl border border-[#E8E8E8] bg-white p-4";

  // Message de relance : un texte, jamais un envoi.
  const relance = client && client.utilise > 0
    ? `Bonjour ${client.nom}, ${d.boutique.nom} vous rappelle votre solde à régler : ${fmt(client.utilise)}${client.enRetard > 0 ? `, dont ${fmt(client.enRetard)} en retard de ${client.joursRetard} jour(s)` : client.prochaineEcheance ? `, à régler avant le ${dateCourte(client.prochaineEcheance)}` : ""}. Merci de passer au magasin${d.boutique.telephone ? ` ou de nous appeler au ${d.boutique.telephone}` : ""}.`
    : "";
  const whatsapp = client?.telephone?.replace(/\D/g, "") ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5" style={POLICE}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold text-[#111111]">{t("Crédit client")}</h1>
          <Badge ton={d.regles.actif ? "positif" : "neutre"}>{t(d.regles.actif ? "Vente à crédit activée" : "Vente à crédit désactivée")}</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#666666]">{t("Ce que vos clients vous doivent. Un client en retard ne peut plus acheter à crédit tant qu'il n'a pas réglé son retard.")}</p>
      </header>

      <dl className="grid gap-3 sm:grid-cols-3">
        <div className={carte}><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#888888]">{t("Encours total")}</dt><dd className="mt-1 text-[22px] font-bold tabular-nums">{fmt(d.encours)}</dd></div>
        <div className={carte}><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#888888]">{t("En retard")}</dt><dd className={cn("mt-1 text-[22px] font-bold tabular-nums", d.enRetard > 0 && "text-[#B91C1C]")}>{fmt(d.enRetard)}</dd></div>
        <div className={carte}><dt className="text-[11px] font-semibold uppercase tracking-wide text-[#888888]">{t("Clients débiteurs")}</dt><dd className="mt-1 text-[22px] font-bold tabular-nums">{d.debiteurs}</dd></div>
      </dl>

      <section className={carte} aria-labelledby="regles-credit">
        <h2 id="regles-credit" className="text-[14px] font-bold">{t("Règles de la boutique")}</h2>
        <form className="mt-3 space-y-3" onSubmit={(e) => { e.preventDefault(); enregistrerRegles(); }}>
          <fieldset disabled={!d.peutGerer} className="space-y-3">
            <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className="accent-[#F5A623]" checked={regles.actif} onChange={(e) => setRegles({ ...regles, actif: e.target.checked })} />{t("Autoriser la vente à crédit en caisse")}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Saisie label="Plafond d'un nouveau client" type="number" inputMode="decimal" min={0} step="any" suffixe={devise} value={regles.plafondDefaut} onChange={(e) => setRegles({ ...regles, plafondDefaut: e.target.value })} aide="0 = aucun crédit tant que vous n'avez pas fixé le plafond du client." />
              <Saisie label="Délai de paiement" type="number" inputMode="numeric" min={1} max={365} step={1} suffixe={t("jours")} value={regles.echeanceJours} onChange={(e) => setRegles({ ...regles, echeanceJours: e.target.value })} />
            </div>
          </fieldset>
          {envoiRegles.erreur && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t(envoiRegles.erreur)}</p>}
          {d.peutGerer && <Bouton type="submit" variante="secondaire" charge={envoiRegles.enCours}>{t("Enregistrer les règles")}</Bouton>}
        </form>
      </section>

      <section className={carte} aria-labelledby="comptes">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="comptes" className="text-[14px] font-bold">{t("Comptes clients")}</h2>
          <div role="group" aria-label={t("Filtrer")} className="flex gap-1.5">
            {(["tous", "retard"] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filtre === f} onClick={() => setFiltre(f)}
                className={cn("min-h-11 rounded-xl border px-3 text-[12.5px] font-semibold", FOCUS, filtre === f ? "border-[#111111] bg-[#111111] text-white" : "border-[#E8E8E8] bg-white text-[#444444]")}>
                {t(f === "tous" ? "Tous" : "En retard")}{f === "retard" ? ` (${d.clients.filter((c) => c.enRetard > 0).length})` : ""}
              </button>
            ))}
          </div>
        </div>
        {d.peutGerer && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Ouvrir le compte d'un client")}</p>
            <SelecteurClient valeur={null} onChoisir={(c) => c && ouvrir({ id: c.id, nom: c.nom, telephone: c.telephone })} />
          </div>
        )}
        {!liste.length ? (
          <EtatVide compact className="mt-3" titre={filtre === "retard" ? "Aucun client en retard" : "Aucun compte de crédit"} texte={filtre === "retard" ? "Tous les paiements à crédit sont dans les délais." : "Fixez le plafond d'un client pour lui ouvrir un crédit."} />
        ) : (
          <ul className="mt-3 divide-y divide-[#F0F0F0]">
            {liste.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => ouvrir(c)} className={cn("flex min-h-14 w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 text-left hover:bg-[#FAFAFA]", FOCUS)}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-[#111111]">{c.nom}</span>
                    <span className="block text-[12px] text-[#666666]">{c.telephone ?? "—"} · {t("plafond")} {fmt(c.plafond)}{c.prochaineEcheance ? ` · ${t("échéance")} ${dateCourte(c.prochaineEcheance)}` : ""}</span>
                  </span>
                  {c.bloque && <Badge ton="danger">{t("Bloqué")}</Badge>}
                  {c.enRetard > 0 && <Badge ton="danger" icone={<AlertTriangle size={11} aria-hidden />}>{c.joursRetard} {t("j de retard")}</Badge>}
                  <span className={cn("w-28 text-right text-[14px] font-bold tabular-nums", c.enRetard > 0 && "text-[#B91C1C]")}>{fmt(c.utilise)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Tiroir ouverte={!!ouvert} onFermer={() => setOuvert(null)} largeur="lg" titre={ouvert?.nom ?? ""} description={ouvert?.telephone ?? undefined} verrouillee={envoiPaiement.enCours}>
        {ouvert && (
          <div className="space-y-5 text-[13px]">
            {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={() => charger(ouvert.id)} />}
            {confirmation && <p role="status" className="rounded-xl border border-[#BBF7D0] bg-[#ECFDF5] px-3 py-2 text-[12.5px] font-semibold text-[#15803D]">{confirmation}</p>}
            <dl className="grid grid-cols-3 gap-2">
              {[["Autorisé", client?.plafond ?? 0], ["Utilisé", client?.utilise ?? 0], ["Disponible", client && !client.bloque && !client.bloqueAuto ? client.disponible : 0]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-[#FAFAFA] px-3 py-2"><dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[#888888]">{t(l as string)}</dt><dd className="mt-0.5 text-[15px] font-bold tabular-nums">{fmt(v as number)}</dd></div>
              ))}
            </dl>
            {client?.bloqueAuto && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t("Blocage automatique")} : {fmt(client.enRetard)} {t("en retard de")} {client.joursRetard} {t("jour(s)")}. {t("La vente à crédit reprendra dès que ce retard sera réglé.")}</p>}

            {d.peutGerer && (
              <form className="space-y-3 rounded-2xl border border-[#F0F0F0] p-3" onSubmit={(e) => { e.preventDefault(); enregistrerCompte(); }} aria-label={t("Régler le compte")}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Saisie label="Plafond de crédit" type="number" inputMode="decimal" min={0} step="any" suffixe={devise} value={compte.plafond} onChange={(e) => setCompte({ ...compte, plafond: e.target.value })} />
                  <Saisie label="Délai de paiement" type="number" inputMode="numeric" min={1} max={365} step={1} suffixe={t("jours")} value={compte.echeanceJours} placeholder={String(d.regles.echeanceJours)} onChange={(e) => setCompte({ ...compte, echeanceJours: e.target.value })} aide="Vide = délai de la boutique." />
                </div>
                <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="accent-[#F5A623]" checked={compte.bloque} onChange={(e) => setCompte({ ...compte, bloque: e.target.checked })} />{t("Bloquer le crédit de ce client")}</label>
                {envoiCompte.erreur && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t(envoiCompte.erreur)}</p>}
                <Bouton type="submit" variante="secondaire" charge={envoiCompte.enCours}>{t("Enregistrer")}</Bouton>
              </form>
            )}

            {client && client.utilise > 0 && d.peutEncaisser && (
              <form className="space-y-3 rounded-2xl border border-[#F0F0F0] p-3" onSubmit={(e) => { e.preventDefault(); encaisser(); }} aria-label={t("Encaisser un remboursement")}>
                <p className="text-[13px] font-bold">{t("Encaisser un remboursement")}</p>
                {caisseFermee ? <p role="status" className="text-[12.5px] text-[#B45309]">{t("La caisse est fermée. Ouvrez-la pour encaisser : le remboursement entre dans la session de caisse.")}</p>
                  : !d.modes.length ? <p role="status" className="text-[12.5px] text-[#B45309]">{t("Aucun moyen de paiement utilisable n'est activé dans les réglages de la caisse.")}</p> : (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Saisie label="Montant reçu" type="number" inputMode="decimal" min={0} max={client.utilise} step="any" suffixe={devise} value={paiement.montant} onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })} aide={`${t("Dû")} : ${fmt(client.utilise)}`} />
                        <Champ label="Moyen de paiement">
                          {(a) => <select {...a} className={CLASSE_SAISIE} value={paiement.mode} onChange={(e) => setPaiement({ ...paiement, mode: e.target.value })}>{d.modes.map((m) => <option key={m.id} value={m.id}>{t(m.libelle)}</option>)}</select>}
                        </Champ>
                      </div>
                      {modeChoisi && <p className="flex flex-wrap items-center gap-2 text-[12px] text-[#666666]"><BadgePaiement statut={modeChoisi.statut} />{t(modeChoisi.mention)}</p>}
                      {modeChoisi && modeChoisi.reference !== "aucune" && <Saisie label="Référence de la transaction" value={paiement.reference} maxLength={120} onChange={(e) => setPaiement({ ...paiement, reference: e.target.value })} />}
                      {envoiPaiement.erreur && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t(envoiPaiement.erreur)}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Bouton type="submit" charge={envoiPaiement.enCours} disabled={!(Number(paiement.montant) > 0)}>{t("Encaisser")}</Bouton>
                        <Bouton variante="secondaire" onClick={() => setPaiement({ ...paiement, montant: String(client.utilise) })}>{t("Tout régler")}</Bouton>
                      </div>
                    </>
                  )}
              </form>
            )}

            {relance && (
              <section className="space-y-2 rounded-2xl border border-[#F0F0F0] p-3" aria-label={t("Relance")}>
                <p className="text-[13px] font-bold">{t("Message de relance")}</p>
                <p className="text-[11.5px] text-[#888888]">{t("AXSO n'envoie rien : copiez ce message ou ouvrez-le dans WhatsApp pour l'envoyer vous-même.")}</p>
                <textarea readOnly value={relance} rows={4} aria-label={t("Message de relance")} className={CLASSE_SAISIE} />
                <div className="flex flex-wrap gap-2">
                  <Bouton variante="secondaire" icone={<Copy size={15} aria-hidden />} onClick={() => navigator.clipboard.writeText(relance).then(() => setConfirmation(t("Message copié.")), () => setConfirmation(t("Copie impossible : sélectionnez le texte à la main.")))}>{t("Copier")}</Bouton>
                  {whatsapp.length >= 8 && <a href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(relance)}`} target="_blank" rel="noopener noreferrer" className={cn("inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#E8E8E8] bg-white px-4 text-[13px] font-bold hover:border-[#F5A623]", FOCUS)}><MessageCircle size={15} aria-hidden />{t("Ouvrir dans WhatsApp")}</a>}
                </div>
              </section>
            )}

            {!d.detail ? <EtatChargement compact texte="Chargement du compte…" /> : (
              <>
                <section aria-label={t("Échéances")}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Ventes à régler")}</h3>
                  {!d.detail.echeances.length ? <p className="mt-1 text-[12.5px] text-[#666666]">{t("Rien à régler.")}</p> : (
                    <ul className="mt-1 divide-y divide-[#F0F0F0]">
                      {d.detail.echeances.map((e) => (
                        <li key={e.commandeId} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                          <span><span className="font-semibold">{e.numero ?? t("Vente")}</span><span className="text-[#666666]"> · {t("échéance")} {dateCourte(e.echeance)}</span>{e.enRetard && <Badge ton="danger" className="ml-2">{e.joursRetard} {t("j de retard")}</Badge>}</span>
                          <span className={cn("font-bold tabular-nums", e.enRetard && "text-[#B91C1C]")}>{fmt(e.reste)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
                <section aria-label={t("Historique")}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[#666666]">{t("Historique du compte")}</h3>
                  {!d.detail.mouvements.length ? <p className="mt-1 text-[12.5px] text-[#666666]">{t("Aucun mouvement.")}</p> : (
                    <ul className="mt-1 divide-y divide-[#F0F0F0]">
                      {d.detail.mouvements.map((m) => (
                        <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                          <span><span className="font-semibold">{t(LIBELLES_MOUVEMENT[m.type] ?? m.type)}</span><span className="text-[#666666]">{m.vente ? ` · ${m.vente}` : ""} · {dateCourte(m.date)}</span></span>
                          <span className="text-right"><span className={cn("block font-bold tabular-nums", m.montant < 0 ? "text-[#15803D]" : "")}>{m.montant > 0 ? "+" : "−"}{fmt(Math.abs(m.montant))}</span><span className="block text-[11px] text-[#888888]">{t("solde")} {fmt(m.soldeApres)}</span></span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </Tiroir>
    </div>
  );
}
