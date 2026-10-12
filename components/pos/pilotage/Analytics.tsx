"use client";
// Analytics du magasin (§38-40) : indicateurs, ventes par heure / jour /
// caisse / magasin / vendeur, heatmap heure × jour, produits stars et dormants,
// pertes, écarts de caisse, performance des caissiers.
// Source : GET /api/pos/analytics. Ce que le compte n'a pas le droit de voir
// (marge, coûts, caissiers) arrive à null et n'est pas affiché.
import { BarChart, Bar, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { EtatChargement, EtatPos, EtatVide } from "@/components/pos/ui";
import { Carte, Chiffre, EnTete, Page, useLecture } from "@/components/pos/finance/commun";
import type { Indicateurs, ProduitDormant } from "@/lib/pos/analytics/ventes";
import { Actualiser, BarreFiltres, useFiltres, type ListesFiltres } from "./commun";

type Ligne = Indicateurs & { id: string; nom: string };
type Caissier = { id: string; nom: string; transactions: number; ca: number; panierMoyen: number; remises: number; annulations: number; remboursements: number; montantRembourse: number; sessionsFermees: number; sessionsAvecEcart: number; ecartNet: number };
type Reponse = {
  periode: { jours: number }; devise: string; voirCouts: boolean; resume: Indicateurs; precedent: Indicateurs;
  rotation: { periode: number; annuelle: number; stockUnites: number; stockValeur: number | null } | null;
  parHeure: { heure: number; ca: number; transactions: number }[];
  parJour: { jour: string; ca: number; transactions: number; marge: number | null }[];
  heatmap: { jour: number; heure: number; ca: number; transactions: number }[];
  parCaisse: Ligne[]; parMagasin: Ligne[]; parVendeur: Ligne[] | null; produitsStars: Ligne[];
  produitsDormants: { jours: number; total: number; produits: ProduitDormant[] };
  pertes: { quantite: number; valeur: number | null; mouvements: number; produits: { produitId: string; nom: string; quantite: number; valeur: number | null }[] };
  ecartsCaisse: { sessions: number; avecEcart: number; ecartNet: number; ecartAbsolu: number };
  annulations: { nombre: number; montant: number }; remboursements: { nombre: number; montant: number };
  caissiers: Caissier[] | null; filtres: ListesFiltres;
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const NOIR = "#111111", JAUNE = "#F5A623";

function Bulle({ active, payload, label, fmt }: { active?: boolean; payload?: { value: number; payload: { transactions: number } }[]; label?: string; fmt: (n: number) => string }) {
  const t = useT();
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#E8E8E8] bg-white px-3 py-2 text-[12px] shadow-lg">
      <p className="font-semibold text-[#666666]">{label}</p>
      <p className="font-bold tabular-nums text-[#111111]">{fmt(payload[0].value)}</p>
      <p className="text-[#888888]">{t("{0} vente(s)", payload[0].payload.transactions)}</p>
    </div>
  );
}

function Barres({ donnees, cle, fmt, couleur }: { donnees: { ca: number; transactions: number }[]; cle: string; fmt: (n: number) => string; couleur: string }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={donnees} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#F0F0F0" vertical={false} />
          <XAxis dataKey={cle} tick={{ fontSize: 11, fill: "#888888" }} tickLine={false} axisLine={{ stroke: "#E8E8E8" }} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 11, fill: "#888888" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => (v >= 1e6 ? `${Math.round(v / 1e5) / 10}M` : v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))} />
          <Tooltip cursor={{ fill: "#F5F5F5" }} content={<Bulle fmt={fmt} />} />
          <Bar dataKey="ca" fill={couleur} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Heatmap heure × jour de la semaine. L'intensité suit le chiffre d'affaires ; chaque case porte son détail en texte. */
function Heatmap({ cases, fmt }: { cases: Reponse["heatmap"]; fmt: (n: number) => string }) {
  const t = useT();
  if (!cases.length) return <EtatVide compact titre="Pas encore de ventes à cartographier" texte="Les heures et les jours forts apparaîtront après quelques ventes." />;
  const max = Math.max(...cases.map((c) => c.ca));
  const heures = cases.map((c) => c.heure);
  const debut = Math.min(...heures), fin = Math.max(...heures);
  const plage = Array.from({ length: fin - debut + 1 }, (_x, i) => debut + i);
  const fort = cases.reduce((a, b) => (b.ca > a.ca ? b : a));
  return (
    <>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1 text-[11px]">
          <caption className="sr-only">{t("Chiffre d'affaires par jour de la semaine et par heure")}</caption>
          <thead><tr><td />{plage.map((h) => <th key={h} scope="col" className="w-9 font-semibold text-[#888888]">{h}h</th>)}</tr></thead>
          <tbody>
            {JOURS.map((nom, i) => (
              <tr key={nom}>
                <th scope="row" className="pr-2 text-left font-semibold text-[#666666]">{t(nom)}</th>
                {plage.map((h) => {
                  const c = cases.find((x) => x.jour === i + 1 && x.heure === h);
                  const force = c && max > 0 ? c.ca / max : 0;
                  return (
                    <td key={h} title={c ? `${t(nom)} ${h}h — ${fmt(c.ca)}, ${t("{0} vente(s)", c.transactions)}` : undefined}
                      className="h-9 w-9 rounded-md text-center tabular-nums" style={{ background: c ? `rgba(245,166,35,${0.15 + force * 0.85})` : "#F5F5F5", color: force > 0.6 ? "#111111" : "#666666" }}>
                      {c ? c.transactions : <span className="sr-only">0</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[12px] text-[#666666]">{t("Dans chaque case : le nombre de ventes. Plus la case est foncée, plus le chiffre d'affaires est élevé. Créneau le plus fort : {0} à {1} h ({2}).", t(JOURS[fort.jour - 1]), fort.heure, fmt(fort.ca))}</p>
    </>
  );
}

function Tableau({ lignes, voirCouts, fmt, premiere }: { lignes: Ligne[]; voirCouts: boolean; fmt: (n: number) => string; premiere: string }) {
  const t = useT();
  if (!lignes.length) return <EtatVide compact titre="Aucune vente sur cette période" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-[13px]">
        <thead className="text-[11px] uppercase tracking-wide text-[#666666]">
          <tr>
            <th className="py-2 font-semibold">{t(premiere)}</th><th className="py-2 text-right font-semibold">{t("Chiffre d'affaires")}</th><th className="py-2 text-right font-semibold">{t("Ventes")}</th>
            <th className="py-2 text-right font-semibold">{t("Unités")}</th>{voirCouts && <th className="py-2 text-right font-semibold">{t("Marge")}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#F0F0F0]">
          {lignes.map((l) => (
            <tr key={l.id || "-"}>
              <td className="py-2.5 font-semibold text-[#111111]">{t(l.nom)}</td>
              <td className="py-2.5 text-right tabular-nums">{fmt(l.ca)}</td><td className="py-2.5 text-right tabular-nums">{l.transactions}</td><td className="py-2.5 text-right tabular-nums">{l.unites}</td>
              {voirCouts && <td className="py-2.5 text-right tabular-nums">{l.marge === null ? "—" : `${fmt(l.marge)} · ${l.margePct} %`}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Analytics() {
  const t = useT();
  const { fmt } = useDevise();
  const { filtres, setFiltres, url } = useFiltres("/api/pos/analytics");
  const { donnees: d, erreur, charge, recharger } = useLecture<Reponse>(url);
  const r = d?.resume;
  const jourCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString(t.loc, { day: "2-digit", month: "short" });

  return (
    <Page>
      <EnTete titre="Analytics du magasin" sousTitre="Ce que vos caisses ont vendu, quand, et avec quelle marge. Chiffres nets des remises et des retours.">
        <Actualiser onClick={() => void recharger()} charge={charge} />
      </EnTete>
      <BarreFiltres filtres={filtres} onChange={setFiltres} listes={d?.filtres ?? null} />

      {erreur && !d ? <EtatPos code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !d || !r ? <EtatChargement texte="Calcul des chiffres…" />
        : (
          <>
            {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Chiffre fort label="Chiffre d'affaires" valeur={fmt(r.ca)} aide={d.precedent.ca > 0 ? t("Période précédente : {0}", fmt(d.precedent.ca)) : undefined} />
              <Chiffre label="Transactions" valeur={String(r.transactions)} />
              <Chiffre label="Panier moyen" valeur={fmt(r.panierMoyen)} />
              <Chiffre label="Unités vendues" valeur={String(r.unites)} />
              {r.marge !== null && <Chiffre label="Marge" valeur={fmt(r.marge)} ton={r.marge < 0 ? "danger" : undefined} />}
              {r.margePct !== null && <Chiffre label="Marge %" valeur={`${r.margePct} %`} aide={d.precedent.margePct !== null && d.precedent.transactions > 0 ? t("Période précédente : {0} %", d.precedent.margePct) : undefined} />}
              <Chiffre label="Remises" valeur={fmt(r.remises)} />
              <Chiffre label="Taux de retour" valeur={`${r.tauxRetour} %`} aide={t("{0} repris", fmt(r.retours))} />
            </div>
            {r.lignesCoutApproche > 0 && <p role="note" className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-[12.5px] text-[#B45309]">{t("Marge approchée : {0} ligne(s) de vente d'avant la nouvelle caisse n'ont pas de coût figé ; le coût actuel du produit est utilisé à la place.", r.lignesCoutApproche)}</p>}

            {r.transactions === 0 ? <EtatVide titre="Aucune vente en caisse sur cette période" texte="Changez de période ou de filtre. Les analyses se remplissent avec les ventes enregistrées à la caisse." /> : (
              <>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Carte titre="Ventes par heure"><Barres donnees={d.parHeure.map((h) => ({ ...h, libelle: `${h.heure}h` }))} cle="libelle" fmt={fmt} couleur={NOIR} /></Carte>
                  <Carte titre="Ventes par jour"><Barres donnees={d.parJour.map((j) => ({ ...j, libelle: jourCourt(j.jour) }))} cle="libelle" fmt={fmt} couleur={JAUNE} /></Carte>
                </div>
                <Carte titre="Heures de pointe et jours forts"><Heatmap cases={d.heatmap} fmt={fmt} /></Carte>
                <Carte titre="Produits stars"><Tableau lignes={d.produitsStars} voirCouts={d.voirCouts} fmt={fmt} premiere="Produit" /></Carte>
                <div className="grid gap-5 lg:grid-cols-2">
                  <Carte titre="Par caisse"><Tableau lignes={d.parCaisse} voirCouts={d.voirCouts} fmt={fmt} premiere="Caisse" /></Carte>
                  <Carte titre="Par magasin"><Tableau lignes={d.parMagasin} voirCouts={d.voirCouts} fmt={fmt} premiere="Magasin" /></Carte>
                </div>
                {d.parVendeur && <Carte titre="Par vendeur"><Tableau lignes={d.parVendeur} voirCouts={d.voirCouts} fmt={fmt} premiere="Vendeur" /></Carte>}
              </>
            )}

            <div className="grid gap-5 lg:grid-cols-2">
              <Carte titre="Produits dormants">
                {d.produitsDormants.total === 0 ? <EtatVide compact titre="Aucun produit dormant" texte="Tout ce qui est en stock s'est vendu récemment." /> : (
                  <>
                    <p className="mb-2 text-[12.5px] text-[#666666]">{t("{0} produit(s) en stock sans aucune vente depuis {1} jours. Les plus gros stocks :", d.produitsDormants.total, d.produitsDormants.jours)}</p>
                    <ul className="divide-y divide-[#F0F0F0]">
                      {d.produitsDormants.produits.map((p) => (
                        <li key={p.produitId} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                          <span className="min-w-0 truncate font-semibold text-[#111111]">{p.nom}</span>
                          <span className="flex-shrink-0 tabular-nums text-[#666666]">{t("stock {0}", p.stock)}{p.valeur !== null && ` · ${fmt(p.valeur)}`}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </Carte>

              <Carte titre="Stock, pertes et caisse">
                <dl className="divide-y divide-[#F0F0F0] text-[13px]">
                  <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Rotation du stock (estimation)")}</dt><dd className="text-right font-semibold tabular-nums">{d.rotation ? t("{0} fois sur la période · {1} fois par an à ce rythme", d.rotation.periode, d.rotation.annuelle) : t("Aucun stock suivi")}</dd></div>
                  {d.rotation?.stockValeur != null && <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Valeur du stock au prix d'achat")}</dt><dd className="font-semibold tabular-nums">{fmt(d.rotation.stockValeur)}</dd></div>}
                  <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Pertes déclarées")}</dt><dd className="text-right font-semibold tabular-nums">{d.pertes.mouvements === 0 ? t("Aucune") : `${t("{0} unité(s)", d.pertes.quantite)}${d.pertes.valeur !== null ? ` · ${fmt(d.pertes.valeur)}` : ""}`}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Écarts de caisse")}</dt><dd className="text-right font-semibold tabular-nums">{d.ecartsCaisse.sessions === 0 ? t("Aucune caisse fermée") : t("{0} fermeture(s) sur {1} avec écart · net {2}", d.ecartsCaisse.avecEcart, d.ecartsCaisse.sessions, fmt(d.ecartsCaisse.ecartNet))}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Ventes annulées")}</dt><dd className="font-semibold tabular-nums">{d.annulations.nombre} · {fmt(d.annulations.montant)}</dd></div>
                  <div className="flex justify-between gap-3 py-2"><dt className="text-[#666666]">{t("Remboursements versés")}</dt><dd className="font-semibold tabular-nums">{d.remboursements.nombre} · {fmt(d.remboursements.montant)}</dd></div>
                </dl>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[#888888]">{t("Rotation : unités vendues divisées par le stock actuel (le stock moyen de la période n'est pas conservé). Pertes : valorisées au prix d'achat actuel.")}</p>
              </Carte>
            </div>

            {d.caissiers && (
              <Carte titre="Activité des caissiers">
                <p className="mb-3 text-[12px] leading-relaxed text-[#666666]">{t("Par ordre alphabétique, sans classement. Ces chiffres servent à organiser les équipes et à repérer un besoin de formation ; ils ne mesurent ni la vitesse ni les pauses.")}</p>
                {d.caissiers.length === 0 ? <EtatVide compact titre="Aucune activité de caissier sur cette période" /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-[13px]">
                      <thead className="text-[11px] uppercase tracking-wide text-[#666666]">
                        <tr>{["Caissier", "Ventes", "Chiffre d'affaires", "Panier moyen", "Remises", "Annulations", "Remboursements", "Écarts de caisse"].map((c, i) => <th key={c} className={`py-2 font-semibold ${i ? "text-right" : ""}`}>{t(c)}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0F0F0]">
                        {d.caissiers.map((c) => (
                          <tr key={c.id}>
                            <td className="py-2.5 font-semibold text-[#111111]">{c.nom}</td>
                            <td className="py-2.5 text-right tabular-nums">{c.transactions}</td><td className="py-2.5 text-right tabular-nums">{fmt(c.ca)}</td><td className="py-2.5 text-right tabular-nums">{fmt(c.panierMoyen)}</td>
                            <td className="py-2.5 text-right tabular-nums">{fmt(c.remises)}</td><td className="py-2.5 text-right tabular-nums">{c.annulations}</td>
                            <td className="py-2.5 text-right tabular-nums">{c.remboursements ? `${c.remboursements} · ${fmt(c.montantRembourse)}` : "0"}</td>
                            <td className="py-2.5 text-right tabular-nums">{c.sessionsFermees ? `${c.sessionsAvecEcart}/${c.sessionsFermees} · ${fmt(c.ecartNet)}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Carte>
            )}
          </>
        )}
    </Page>
  );
}
