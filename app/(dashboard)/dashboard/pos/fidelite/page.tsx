"use client";
// Programme de fidélité : règles (gain et valeur des points, seuils des
// niveaux), avantages par niveau (promotions « prix membre »), classement des
// clients, historique des mouvements, ajustement manuel de points.
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, EtatChargement, EtatPos, EtatVide, Modale, POLICE, Saisie, type Ton } from "@/components/pos/ui";
import { appelPos, nouvelleCle } from "@/components/pos/crm/appel";
import { LIBELLES_NIVEAU, NIVEAUX, TON_NIVEAU } from "@/components/pos/crm/libelles";

type Regles = { active: boolean; montantParPoint: number; valeurPoint: number; seuils: { silver: number; gold: number; vip: number } };
type Membre = { id: string; nom: string; telephone: string | null; points: number; niveau: string; totalDepense: number };
type Mouvement = { id: string; clientId: string; client: string; type: string; points: number; vente: string | null; motif: string | null; date: string };
type Donnees = {
  regles: Regles; peutGerer: boolean; moteurPromotions: boolean; modeAvoirActif: boolean;
  niveaux: Record<string, number>; classement: Membre[]; historique: Mouvement[];
  avantages: { id: string; nom: string; actif: boolean; niveaux: Record<string, number> }[];
};

const TYPES_MOUVEMENT: Record<string, { libelle: string; ton: Ton }> = {
  gain: { libelle: "Gain", ton: "positif" }, utilisation: { libelle: "Utilisation", ton: "info" },
  ajustement: { libelle: "Ajustement", ton: "attention" }, annulation: { libelle: "Annulation", ton: "neutre" },
};

export default function PageFidelite() {
  const t = useT();
  const { fmt, devise } = useDevise();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [form, setForm] = useState({ active: false, montantParPoint: "", valeurPoint: "", silver: "", gold: "", vip: "" });
  const [envoi, setEnvoi] = useState<{ enCours: boolean; erreur?: string }>({ enCours: false });
  const [ajustement, setAjustement] = useState<{ membre: Membre; points: string; motif: string; enCours: boolean; erreur?: string } | null>(null);
  const cle = useRef("");

  const charger = useCallback(async () => {
    setErreur(null);
    const r = await appelPos<Donnees>("/api/pos/fidelite");
    if (!r.ok) return setErreur(r);
    setD(r.donnees);
    const x = r.donnees.regles;
    setForm({ active: x.active, montantParPoint: String(x.montantParPoint), valeurPoint: String(x.valeurPoint), silver: String(x.seuils.silver), gold: String(x.seuils.gold), vip: String(x.seuils.vip) });
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function enregistrer() {
    setEnvoi({ enCours: true });
    const r = await appelPos("/api/pos/fidelite", {
      method: "PATCH",
      corps: { active: form.active, montantParPoint: Number(form.montantParPoint), valeurPoint: Number(form.valeurPoint) || 0, seuils: { silver: Math.round(Number(form.silver)), gold: Math.round(Number(form.gold)), vip: Math.round(Number(form.vip)) } },
    });
    if (!r.ok) return setEnvoi({ enCours: false, erreur: r.message });
    setEnvoi({ enCours: false });
    toast.success(t("Règles de fidélité enregistrées."));
    charger();
  }

  async function ajuster() {
    if (!ajustement) return;
    setAjustement({ ...ajustement, enCours: true, erreur: undefined });
    const r = await appelPos("/api/pos/fidelite/ajustement", { corps: { clientId: ajustement.membre.id, points: Math.round(Number(ajustement.points)), motif: ajustement.motif }, cle: cle.current });
    if (!r.ok) return setAjustement({ ...ajustement, enCours: false, erreur: r.message });
    setAjustement(null);
    toast.success(t("Points ajustés."));
    charger();
  }

  if (erreur) return <div className="mx-auto max-w-5xl p-4 sm:p-5" style={POLICE}><EtatPos code={erreur.code} message={erreur.message} onReessayer={charger} /></div>;
  if (!d) return <EtatChargement texte="Chargement du programme de fidélité…" />;

  const exemple = Number(form.montantParPoint) > 0 ? Math.floor(10000 / Number(form.montantParPoint)) : 0;
  const carte = "rounded-2xl border border-[#E8E8E8] bg-white p-4";
  const titre = "text-[14px] font-bold text-[#111111]";
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5" style={POLICE}>
      <header>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[20px] font-bold text-[#111111]">{t("Fidélité")}</h1>
          <Badge ton={d.regles.active ? "positif" : "neutre"}>{t(d.regles.active ? "Programme actif" : "Programme éteint")}</Badge>
        </div>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-[#666666]">{t("Chaque vente associée à un client lui donne des points. Le niveau se gagne sur les points acquis : les dépenser ne fait pas redescendre.")}</p>
      </header>

      <section className={carte} aria-labelledby="regles">
        <h2 id="regles" className={titre}>{t("Règles")}</h2>
        <form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); enregistrer(); }}>
          <fieldset disabled={!d.peutGerer} className="space-y-4">
            <label className="flex min-h-11 items-center gap-2 text-[13px] font-semibold"><input type="checkbox" className="accent-[#F5A623]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />{t("Donner des points à chaque vente")}</label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Saisie label="Montant d'achat pour 1 point" type="number" inputMode="decimal" min={1} step="any" suffixe={devise} value={form.montantParPoint} onChange={(e) => setForm({ ...form, montantParPoint: e.target.value })}
                aide={`${fmt(10000)} ${t("d'achat")} = ${exemple} ${t("point(s)")}`} />
              <Saisie label="Valeur d'un point à l'utilisation" type="number" inputMode="decimal" min={0} step="any" suffixe={devise} value={form.valeurPoint} onChange={(e) => setForm({ ...form, valeurPoint: e.target.value })}
                aide="0 = les points ne servent qu'au niveau, ils ne se dépensent pas." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(["silver", "gold", "vip"] as const).map((n) => (
                <Saisie key={n} label={`${LIBELLES_NIVEAU[n]} ${t("à partir de")}`} type="number" inputMode="numeric" min={1} step={1} suffixe={t("pts")} value={form[n]} onChange={(e) => setForm({ ...form, [n]: e.target.value })} />
              ))}
            </div>
          </fieldset>
          {Number(form.valeurPoint) > 0 && (
            <div className="rounded-xl bg-[#FAFAFA] px-3 py-2 text-[12.5px] leading-relaxed text-[#444444]">
              <p><strong>{t("Utiliser ses points à la caisse")}</strong> — {t("depuis la fiche du client, le caissier change des points en avoir (points × valeur du point). L'avoir se dépense ensuite comme moyen de paiement « Avoir », en une ou plusieurs fois.")}</p>
              {!d.modeAvoirActif && <p role="alert" className="mt-1 font-semibold text-[#B45309]">{t("Le moyen de paiement « Avoir » n'est pas proposé à la caisse : ajoutez-le dans les réglages de la caisse, sinon ces avoirs ne pourront pas être dépensés.")}</p>}
            </div>
          )}
          {envoi.erreur && <p role="alert" className="text-[12.5px] text-[#B91C1C]">{t(envoi.erreur)}</p>}
          {d.peutGerer
            ? <Bouton type="submit" charge={envoi.enCours}>{t("Enregistrer les règles")}</Bouton>
            : <p className="text-[12px] text-[#888888]">{t("Seul un responsable peut modifier ces règles.")}</p>}
        </form>
      </section>

      <section className={carte} aria-labelledby="avantages">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="avantages" className={titre}>{t("Avantages par niveau")}</h2>
          <Bouton variante="secondaire" taille="compact" href="/dashboard/pos/promotions">{t("Gérer dans Promotions")}</Bouton>
        </div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#666666]">{t("L'avantage d'un niveau est une promotion de type « Prix membre » : une remise automatique selon le niveau du client.")}</p>
        {!d.moteurPromotions && <p role="status" className="mt-2 text-[12.5px] font-semibold text-[#B45309]">{t("Le moteur de promotions est éteint : ces avantages ne s'appliquent pas encore en caisse.")}</p>}
        {!d.avantages.length ? <p className="mt-2 text-[12.5px] text-[#888888]">{t("Aucun avantage défini pour l'instant.")}</p> : (
          <ul className="mt-2 space-y-1.5">
            {d.avantages.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FAFAFA] px-3 py-2 text-[13px]">
                <span className="font-semibold">{a.nom}</span>
                {!a.actif && <Badge>{t("Désactivée")}</Badge>}
                {NIVEAUX.filter((n) => a.niveaux[n] > 0).map((n) => <Badge key={n} ton={TON_NIVEAU[n]}>{LIBELLES_NIVEAU[n]} −{a.niveaux[n]} %</Badge>)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={carte} aria-labelledby="classement">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="classement" className={titre}>{t("Classement des clients")}</h2>
          {NIVEAUX.map((n) => <Badge key={n} ton={TON_NIVEAU[n]}>{LIBELLES_NIVEAU[n]} · {d.niveaux[n] ?? 0}</Badge>)}
        </div>
        {!d.classement.length ? <EtatVide compact className="mt-3" titre="Aucun client n'a encore de points" texte="Associez un client à une vente pour qu'il commence à en gagner." /> : (
          <ol className="mt-3 divide-y divide-[#F0F0F0]">
            {d.classement.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-2">
                <span className="w-6 text-right text-[12px] font-bold tabular-nums text-[#888888]">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold text-[#111111]">{m.nom}</span>
                  <span className="block text-[12px] text-[#666666]">{m.telephone ?? "—"} · {fmt(m.totalDepense)} {t("dépensés")}</span>
                </span>
                <Badge ton={TON_NIVEAU[m.niveau] ?? "neutre"}>{LIBELLES_NIVEAU[m.niveau] ?? m.niveau}</Badge>
                <span className="w-20 text-right text-[14px] font-bold tabular-nums">{m.points} {t("pts")}</span>
                {d.peutGerer && <Bouton variante="secondaire" taille="compact" aria-label={`${t("Ajuster les points de")} ${m.nom}`} onClick={() => { cle.current = nouvelleCle(); setAjustement({ membre: m, points: "", motif: "", enCours: false }); }}>{t("Ajuster")}</Bouton>}
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={carte} aria-labelledby="historique">
        <h2 id="historique" className={titre}>{t("Historique des points")}</h2>
        {!d.historique.length ? <p className="mt-2 text-[12.5px] text-[#888888]">{t("Aucun mouvement de points pour l'instant.")}</p> : (
          <ul className="mt-2 divide-y divide-[#F0F0F0]">
            {d.historique.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-2 py-2 text-[12.5px]">
                <Badge ton={TYPES_MOUVEMENT[m.type]?.ton ?? "neutre"}>{t(TYPES_MOUVEMENT[m.type]?.libelle ?? m.type)}</Badge>
                <span className="min-w-0 flex-1 truncate"><span className="font-semibold">{m.client}</span><span className="text-[#666666]">{m.vente ? ` · ${m.vente}` : ""}{m.motif ? ` · ${m.motif}` : ""}</span></span>
                <span className="text-[#888888]">{new Date(m.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className={`w-16 text-right font-bold tabular-nums ${m.points < 0 ? "text-[#B91C1C]" : "text-[#15803D]"}`}>{m.points > 0 ? "+" : ""}{m.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Modale ouverte={!!ajustement} onFermer={() => setAjustement(null)} taille="sm" verrouillee={ajustement?.enCours}
        titre="Ajuster les points" description="Geste commercial ou correction. L'ajustement est inscrit au journal d'audit avec son motif."
        actions={<><Bouton variante="secondaire" onClick={() => setAjustement(null)}>{t("Annuler")}</Bouton><Bouton charge={ajustement?.enCours} onClick={ajuster} disabled={!Number(ajustement?.points) || (ajustement?.motif.trim().length ?? 0) < 3}>{t("Valider")}</Bouton></>}>
        {ajustement && (
          <div className="space-y-3">
            <p className="text-[13px]"><strong>{ajustement.membre.nom}</strong> · {ajustement.membre.points} {t("pts")}</p>
            <Saisie label="Points à ajouter (négatif pour retirer)" type="number" inputMode="numeric" step={1} autoFocus value={ajustement.points} onChange={(e) => setAjustement({ ...ajustement, points: e.target.value })} />
            <Saisie label="Motif" value={ajustement.motif} maxLength={200} onChange={(e) => setAjustement({ ...ajustement, motif: e.target.value })} erreur={ajustement.erreur} />
          </div>
        )}
      </Modale>
    </div>
  );
}
