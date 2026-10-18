import { contexteCC } from "@/lib/command-center/serveur";
import { mesurer } from "@/lib/command-center/moteur";
import { parCanal, campagnes, MIN_CANAL } from "@/lib/command-center/marketing";
import { formats } from "@/lib/command-center/format";
import { getT } from "@/lib/i18n/serveur";
import { lien } from "@/lib/command-center/contexte";
import { SOURCES_ACQ } from "@/lib/command-center/types";
import { EnTetePage, Carte, Kpi, GrilleKpi, EtatVide, Note, Fraicheur, ListeBarres, Progression } from "@/components/command-center/ui";
import { TableauInteractif, BoutonPDF } from "@/components/command-center/client";
import { Barres } from "@/components/command-center/graphiques";

export default async function PageMarketing({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const t = await getT();
  const { formatValeur } = formats(t);
  const c = await contexteCC("marketing", searchParams);
  const { vue: v, fen: f, filtres } = c;
  const sansDepenses = c.ds.manques.includes("marketing"), sansSource = c.ds.manques.includes("acquisition");
  const canaux = parCanal(v, f.cur).map((x) => ({ ...x, nom: t(x.nom) }));
  const camp = sansDepenses ? [] : campagnes(v, f.cur);
  const segment = v.filtreActif();
  const depense = canaux.reduce((s, x) => s + x.depense, 0), revenu = canaux.reduce((s, x) => s + x.revenu, 0);
  const inscrits = canaux.reduce((s, x) => s + x.inscrits, 0), actives = canaux.reduce((s, x) => s + x.actives, 0), payants = canaux.reduce((s, x) => s + x.payants, 0);
  const classes = canaux.filter((x) => x.ltv != null && x.canal !== "inconnu").sort((a, b) => b.ltv! - a.ltv!);

  const etatSource = <EtatVide titre={t("Source d'inscription non enregistrée")} explication={t("Pour ventiler par canal, Axso doit enregistrer la source de chaque inscription (paramètres UTM, code parrain, partenaire) sur le compte marchand.")} />;
  const etatDepenses = <EtatVide titre={t("Dépenses marketing non enregistrées")} explication={t("Saisissez ou importez les dépenses par campagne et par canal (Meta, Google, TikTok…) pour calculer CAC et ROAS.")} />;

  return (
    <div className="space-y-5">
      <EnTetePage eyebrow="Marketing & acquisition" titre={t("Marketing")} sousTitre={<>{t("Campagnes, coût d'acquisition et valeur des marchands par canal")} · <span className="cc-faint">{t(f.libelle)} {t(f.libelleComp)}</span></>}
        actions={<><Fraicheur genereA={c.ds.genereA} source={c.ds.source} erreur={c.erreur} /><BoutonPDF /></>} />
      {c.erreur && <Note ton="warn">{t(c.erreur)}</Note>}
      {segment && !sansDepenses && <Note>{t("Un segment est actif : les dépenses ne sont pas rattachées à un marchand, donc CAC et ROAS ne sont pas calculés sur ce périmètre.")}</Note>}

      <GrilleKpi colonnes={4}>
        {["nouveaux_marchands", "cac", "visiteurs", "activation"].map((id) => { const m = mesurer(v, id, f.cur, f.prev, 12); return <Kpi key={id} m={{ ...m, nom: t(m.nom), description: t(m.description), formule: t(m.formule) }} filtres={filtres} libelleComp={t(f.libelleComp)} />; })}
      </GrilleKpi>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <Carte titre={t("Conversions")} sousTitre={t("Inscrits de la période → activés → payants (à ce jour)")}>
          {!inscrits ? <EtatVide titre={t("Aucune inscription sur la période")} /> : (
            <ul className="space-y-3">
              {[{ nom: "Inscrits", n: inscrits }, { nom: "Activés", n: actives }, { nom: "Payants", n: payants }].map((e) => (
                <li key={e.nom}>
                  <div className="flex justify-between text-[13px]"><span>{t(e.nom)}</span><span className="cc-num font-medium">{formatValeur(e.n, "nombre", true)} <span className="cc-faint font-normal">{formatValeur(e.n / inscrits, "pct")}</span></span></div>
                  <Progression valeur={e.n / inscrits} />
                </li>
              ))}
            </ul>
          )}
          <p className="cc-faint text-[11.5px] mt-3">{t("Les inscrits récents n'ont pas encore eu 14 jours pour s'activer.")}</p>
        </Carte>

        <Carte titre={t("Quel canal produit les marchands à plus forte LTV ?")}>
          {sansSource ? etatSource : classes.length < 2 ? <EtatVide titre={t("Données insuffisantes")} explication={t("Il faut au moins {0} marchands dans au moins deux canaux.", MIN_CANAL)} /> : (
            <>
              <p className="text-[14px]"><strong>{classes[0].nom}</strong>{t(" : {0} de revenu Axso cumulé par marchand acquis ({1} marchands, ancienneté moyenne {2} mois), contre {3} pour {4}.", formatValeur(classes[0].ltv, "xaf"), formatValeur(classes[0].marchandsLtv, "nombre", true), formatValeur(classes[0].ancienneteMois, "nombre"), formatValeur(classes[classes.length - 1].ltv, "xaf"), classes[classes.length - 1].nom)}</p>
              <div className="mt-3"><ListeBarres format="xaf" lignes={classes.map((x) => ({ cle: x.canal, nom: x.nom, valeur: x.ltv!, sous: t("{0} mois", formatValeur(x.ancienneteMois, "nombre")), href: lien("/admin/marketing", filtres, { acq: x.canal }) }))} /></div>
              <p className="cc-faint text-[11.5px] mt-3">{t("LTV observée = revenu Axso (abonnements + commissions) cumulé à ce jour ÷ marchands acquis par le canal. À ancienneté inégale, un canal récent paraît moins rentable.")}</p>
            </>
          )}
        </Carte>
      </div>

      <Carte titre={t("Performance par canal")} sousTitre={t("Revenu = revenu Axso généré à ce jour par les inscrits de la période · ROAS = revenu ÷ dépense")}>
        {sansSource && sansDepenses ? <div className="grid md:grid-cols-2">{etatSource}{etatDepenses}</div> : (
          <>
            {!sansDepenses && !segment && depense > 0 && (
              <div className="mb-4"><Barres format="xaf" hauteur={220} series={[{ cle: "d", nom: t("Dépense") }, { cle: "r", nom: t("Revenu généré") }]} donnees={canaux.filter((x) => x.depense || x.revenu).map((x) => ({ x: x.nom, d: x.depense, r: x.revenu }))} /></div>
            )}
            <TableauInteractif nomExport="marketing-canaux" recherche={false} colonnes={[
              { cle: "nom", nom: t("Canal") }, { cle: "depense", nom: t("Dépense"), format: "xaf", droite: true }, { cle: "visiteurs", nom: t("Visiteurs"), format: "nombre", droite: true },
              { cle: "inscrits", nom: t("Inscrits"), format: "nombre", droite: true }, { cle: "actives", nom: t("Activés"), format: "nombre", droite: true }, { cle: "payants", nom: t("Payants"), format: "nombre", droite: true },
              { cle: "cac", nom: "CAC", format: "xaf", droite: true }, { cle: "revenu", nom: t("Revenu généré"), format: "xaf", droite: true }, { cle: "roas", nom: "ROAS", format: "ratio", droite: true }, { cle: "ltv", nom: t("LTV observée"), format: "xaf", droite: true },
            ]} lignes={canaux.map((x) => ({ _id: x.canal, _href: lien("/admin/marchands", filtres, { acq: x.canal }), nom: x.nom, depense: sansDepenses || segment ? null : x.depense, visiteurs: sansDepenses || segment ? null : x.visiteurs, inscrits: x.inscrits, actives: x.actives, payants: x.payants, cac: x.cac, revenu: x.revenu, roas: x.roas, ltv: x.ltv }))} />
            <p className="cc-faint text-[11.5px] mt-2">{t("Un ROAS inférieur à 1× n'est pas forcément mauvais : le revenu des marchands acquis continue de s'accumuler après la période.")}</p>
          </>
        )}
      </Carte>

      <Carte titre={t("Campagnes")} sousTitre={t("Dépenses {0}", t(f.libelle).toLowerCase())}>
        {sansDepenses ? etatDepenses : !camp.length ? <EtatVide titre={t("Aucune dépense sur la période")} /> : (
          <ListeBarres format="xaf" lignes={camp.map((x) => ({ cle: x.campagne, nom: x.campagne, valeur: x.montant, sous: t(SOURCES_ACQ[x.canal] ?? x.canal) }))} />
        )}
        {!sansDepenses && segment && camp.length > 0 && <p className="cc-faint text-[11.5px] mt-2">{t("Dépenses globales : elles ne sont pas filtrées par le segment.")}</p>}
        {!sansDepenses && depense > 0 && !segment && <p className="cc-faint text-[12px] mt-3">{t("Total : {0} dépensés · revenu généré par les inscrits : {1} · ROAS global {2}", formatValeur(depense, "xaf"), formatValeur(revenu, "xaf"), formatValeur(revenu / depense, "ratio"))}</p>}
      </Carte>
    </div>
  );
}
