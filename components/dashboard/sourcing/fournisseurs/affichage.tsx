"use client";
// Briques d'affichage de Supplier Intelligence, communes à la découverte, à la
// fiche fournisseur, aux demandes de devis et à l'agent de sourcing.
// Règle d'affichage : une donnée montre toujours son niveau de confiance ; rien
// n'est présenté comme « vérifié » si l'analyse ne le dit pas.
import Link from "next/link";
import { AlertTriangle, Award, BadgeCheck, Check, Factory, HelpCircle, ShieldAlert, ShieldCheck, Trophy, X } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Carte, Pastille, type Ton } from "@/components/dashboard/sourcing/ui";
import type { Candidat, Classement, Recommandation } from "@/lib/sourcing/fournisseurs/classement";
import type { CoutTotal } from "@/lib/sourcing/fournisseurs/cout";
import {
  LIBELLES_CONFIANCE, LIBELLES_RISQUE,
  type AnalyseFournisseur, type DetectionFabricant, type EtatCertification, type NiveauConfiance, type NiveauRisque,
} from "@/lib/sourcing/fournisseurs/types";

export const montant = (n: number | null | undefined, devise: string, loc = "fr-FR") =>
  n === null || n === undefined ? "—" : `${n.toLocaleString(loc, { maximumFractionDigits: 2 })} ${devise}`;

const TON_CONFIANCE: Record<NiveauConfiance, Ton> = { verifie: "positif", partiellement_verifie: "info", declare_fournisseur: "accent", inconnu: "neutre" };

/** Niveau de confiance d'une donnée ; la source de vérification est dans l'infobulle. */
export function PastilleConfiance({ niveau, source }: { niveau: NiveauConfiance; source?: string | null }) {
  const t = useT();
  return <span title={source ? t(source) : undefined}><Pastille ton={TON_CONFIANCE[niveau]}>{niveau === "verifie" && <Check size={9} />}{t(LIBELLES_CONFIANCE[niveau])}</Pastille></span>;
}

const TON_RISQUE: Record<NiveauRisque, Ton> = { faible: "positif", moyen: "accent", eleve: "attention" };

export function PastilleRisque({ niveau }: { niveau: NiveauRisque }) {
  return <Pastille ton={TON_RISQUE[niveau]}>{niveau === "faible" ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}{LIBELLES_RISQUE[niveau]}</Pastille>;
}

const TON_FABRICANT: Record<DetectionFabricant["statut"], Ton> = { fabricant: "positif", fabricant_trading: "accent", trading: "info", insuffisant: "attention" };

export function PastilleFabricant({ fabricant }: { fabricant: DetectionFabricant }) {
  const t = useT();
  return <span title={t(fabricant.source)}><Pastille ton={TON_FABRICANT[fabricant.statut]}>{fabricant.statut === "insuffisant" ? <HelpCircle size={10} /> : <Factory size={10} />}{t(fabricant.libelle)}</Pastille></span>;
}

/** ✓ vérifiée / ⚠ déclarée par le fournisseur / ✕ non trouvée (ou expirée). */
export function PastilleCertification({ c }: { c: EtatCertification }) {
  const t = useT();
  const [ton, Icone, libelle]: [Ton, typeof Check, string] =
    c.statut === "verifiee" ? ["positif", Check, "vérifiée"]
    : c.statut === "declaree" ? ["accent", AlertTriangle, "déclarée"]
    : c.statut === "expiree" ? ["attention", X, "expirée"]
    : ["neutre", X, "non trouvée"];
  return <span title={`${t(c.note)} — ${t(c.source)}`}><Pastille ton={ton}><Icone size={9} />{c.code} {t(libelle)}</Pastille></span>;
}

export function LabelVerified() {
  return <Pastille ton="positif"><BadgeCheck size={10} />AXSO Verified Supplier</Pastille>;
}

const couleurNote = (n: number) => (n >= 70 ? "#15803D" : n >= 45 ? "#B45309" : "#B91C1C");

/** Score /100 avec la part des critères réellement documentés. */
export function Score({ analyse, grand }: { analyse: Pick<AnalyseFournisseur, "score" | "couverture">; grand?: boolean }) {
  const t = useT();
  return (
    <div className="text-right shrink-0">
      <p className={`font-bold tabular-nums leading-none ${grand ? "text-[34px]" : "text-[22px]"}`} style={{ color: couleurNote(analyse.score) }}>
        {analyse.score}<span className="text-[12px] text-[#AAAAAA] font-semibold">/100</span>
      </p>
      <p className="text-[10px] text-[#AAAAAA] mt-1">{t("{0} % des critères documentés", Math.round(analyse.couverture * 100))}</p>
    </div>
  );
}

/** Détail du score : chaque critère avec sa note, son poids, sa raison et la confiance de la donnée. */
export function DetailScore({ analyse }: { analyse: AnalyseFournisseur }) {
  const t = useT();
  return (
    <div className="space-y-2.5">
      {analyse.criteres.map((c) => (
        <div key={c.cle}>
          <div className="flex items-center gap-2 text-[12px]">
            <span className="font-semibold text-[#111111] w-28 shrink-0">{t(c.libelle)}</span>
            <div className="flex-1 h-1.5 rounded-full bg-[#F5F5F5] overflow-hidden">
              {c.note !== null && <div className="h-full rounded-full" style={{ width: `${c.note}%`, background: couleurNote(c.note) }} />}
            </div>
            <span className="w-12 text-right font-bold tabular-nums" style={{ color: c.note === null ? "#AAAAAA" : couleurNote(c.note) }}>{c.note === null ? t("n. d.") : c.note}</span>
            <span className="w-10 text-right text-[10px] text-[#AAAAAA] tabular-nums" title={t("Poids du critère dans le score")}>× {c.poids} %</span>
          </div>
          <div className="flex items-start gap-2 mt-0.5 pl-0 sm:pl-[120px]">
            <p className="text-[11px] text-[#666666] leading-snug flex-1">{t(c.raison)}</p>
            <PastilleConfiance niveau={c.confiance} />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-[#AAAAAA] leading-snug pt-1">{t("Un critère sans donnée (n. d.) compte pour 0 : il n'est jamais noté par défaut. Une donnée seulement déclarée compte pour 60 % de sa valeur.")}</p>
    </div>
  );
}

/** AXSO RISK ALERT : chaque signal avec son explication. */
export function AlertesRisque({ risque }: { risque: AnalyseFournisseur["risque"] }) {
  const t = useT();
  if (!risque.signaux.length && !risque.plancher) return <p className="text-[12px] text-[#15803D] flex items-center gap-1.5"><ShieldCheck size={13} />{t("Aucun signal de risque détecté.")}</p>;
  return (
    <div className="rounded-xl border p-3 space-y-2" style={risque.niveau === "eleve" ? { background: "#FEF2F2", borderColor: "#FECACA" } : { background: "#FFF7ED", borderColor: "#FDE68A" }}>
      {risque.signaux.length > 0 && <p className="text-[11px] font-bold tracking-wide flex items-center gap-1.5" style={{ color: risque.niveau === "eleve" ? "#B91C1C" : "#B45309" }}><ShieldAlert size={13} />AXSO RISK ALERT</p>}
      {risque.signaux.map((s) => (
        <div key={s.cle} className="text-[12px] leading-snug">
          <span className="font-semibold text-[#111111]">{t(s.libelle)}</span>
          <span className="text-[#666666]"> — {t(s.explication)}</span>
        </div>
      ))}
      {risque.plancher && <p className="text-[12px] text-[#666666] leading-snug">{t(risque.plancher)}</p>}
    </div>
  );
}

/** Manufacturer Confidence Score et les indices qui le composent. */
export function IndicesFabricant({ fabricant }: { fabricant: DetectionFabricant }) {
  const t = useT();
  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <PastilleFabricant fabricant={fabricant} />
        <p className="text-[12px] font-bold text-[#111111]">Manufacturer Confidence Score : <span style={{ color: couleurNote(fabricant.score) }}>{fabricant.score}/100</span></p>
      </div>
      <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1">
        {fabricant.indices.map((i) => (
          <li key={i.cle} className="flex items-center gap-1.5 text-[11px]" style={{ color: i.present ? "#111111" : "#AAAAAA" }}>
            {i.present ? <Check size={11} className="text-[#15803D] shrink-0" /> : <X size={11} className="shrink-0" />}
            <span className="flex-1">{t(i.libelle)}</span>
            <span className="tabular-nums text-[#666666]">{i.obtenu}/{i.points}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[#AAAAAA] mt-2 leading-snug">{t(fabricant.source)}. {t("Un indice déclaré sans vérification ne rapporte que 60 % de ses points.")}</p>
    </div>
  );
}

/** Critères du label « AXSO Verified Supplier » : chacun rempli, non rempli ou sans objet. */
export function CriteresLabel({ label }: { label: AnalyseFournisseur["label"] }) {
  const t = useT();
  return (
    <div>
      <ul className="space-y-1.5">
        {label.criteres.map((c) => (
          <li key={c.cle} className="flex items-start gap-2 text-[12px]">
            {!c.applicable ? <span className="w-3.5 text-center text-[#AAAAAA] shrink-0">–</span> : c.rempli ? <Check size={13} className="text-[#15803D] shrink-0 mt-0.5" /> : <X size={13} className="text-[#B91C1C] shrink-0 mt-0.5" />}
            <span><span className="font-semibold text-[#111111]">{t(c.libelle)}</span><span className="text-[#666666]"> — {t(c.raison)}</span></span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-[#AAAAAA] mt-2 leading-snug">
        {label.attribue ? t("Tous les critères applicables sont remplis : label attribué.") : t("Le label est calculé sur ces critères. Les vérifications sont faites par l'équipe AXSO, avec leur source ; elles ne peuvent pas être saisies par le marchand ni par le fournisseur.")}
      </p>
    </div>
  );
}

type OffreCandidat = NonNullable<Candidat["offre"]>;

/** Paliers de prix : « 10 → 3,50 ; 50 → 3,10 ; … ». */
export function GrillePrix({ offre }: { offre: Pick<OffreCandidat, "grille" | "devise" | "moq"> }) {
  const t = useT();
  return (
    <div className="flex gap-1.5 flex-wrap">
      {offre.grille.map((g) => (
        <div key={g.quantite} className="rounded-lg border border-[#E8E8E8] px-2 py-1 text-center min-w-[58px]" style={g.sousMoq ? { opacity: 0.45 } : undefined}
          title={g.sousMoq ? t("Sous le MOQ ({0})", offre.moq) : undefined}>
          <p className="text-[10px] text-[#666666] tabular-nums">{g.quantite.toLocaleString(t.loc)}</p>
          <p className="text-[12px] font-bold text-[#111111] tabular-nums">{g.prix.toLocaleString(t.loc, { maximumFractionDigits: 2 })}</p>
        </div>
      ))}
      <span className="self-center text-[10px] text-[#AAAAAA]">{offre.devise} / {t("unité")}</span>
    </div>
  );
}

/** Coût réel estimé par unité : coût rendu puis coûts cachés, chaque ligne avec sa source. */
export function DetailCout({ cout }: { cout: CoutTotal }) {
  const t = useT();
  return (
    <div className="text-[12px]">
      {cout.lignes.map((l, i) => (
        <div key={l.cle}>
          {l.cle === "inspection" && (
            <div className="flex justify-between gap-3 py-1.5 border-y border-[#E8E8E8] font-bold text-[#111111] my-1">
              <span>{t("Coût rendu (landed cost)")}</span><span className="tabular-nums">{montant(cout.rendu, cout.devise, t.loc)}</span>
            </div>
          )}
          <div className={`flex justify-between gap-3 py-1 ${i ? "" : "pt-0"}`}>
            <span className="text-[#111111]">{t(l.libelle)} <span className="text-[10px] text-[#AAAAAA]">· {t(l.source)}</span></span>
            <span className="tabular-nums text-[#666666] shrink-0">{montant(l.montant, cout.devise, t.loc)}</span>
          </div>
        </div>
      ))}
      <div className="flex justify-between gap-3 pt-2 mt-1 border-t border-[#E8E8E8] font-bold text-[#111111]">
        <span>TRUE COST — {t("coût réel estimé par unité")}</span><span className="tabular-nums">{montant(cout.total, cout.devise, t.loc)}</span>
      </div>
      <p className="text-[11px] text-[#AAAAAA] mt-1.5 leading-snug">{t("Calculé pour {0} unités à {1} {2} l'unité. Estimation : droits, défauts, retours et capital reposent sur des hypothèses à ajuster.", cout.quantite, cout.prix, cout.devisePrix)}</p>
    </div>
  );
}

/** Les quatre podiums d'un produit. */
export function Podiums({ classement }: { classement: Classement }) {
  const t = useT();
  const cases: [string, typeof Trophy, Classement[keyof Classement]][] = [
    ["Meilleur fournisseur global", Trophy, classement.global],
    ["Meilleur prix", Award, classement.meilleurPrix],
    ["Meilleur fabricant", Factory, classement.meilleurFabricant],
    ["Meilleur rapport risque / prix", ShieldCheck, classement.meilleurRisquePrix],
  ];
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cases.map(([titre, Icone, trophee]) => (
        <div key={titre} className="bg-white rounded-2xl border border-[#E8E8E8] shadow-sm p-4">
          <p className="text-[10px] font-bold text-[#B45309] uppercase tracking-wide flex items-center gap-1.5"><Icone size={12} />{t(titre)}</p>
          {trophee ? (
            <>
              <p className="text-[14px] font-bold text-[#111111] mt-1.5">{trophee.nom}</p>
              <p className="text-[11px] text-[#666666] mt-0.5 leading-snug">{t(trophee.raison)}</p>
            </>
          ) : <p className="text-[11px] text-[#AAAAAA] mt-1.5 leading-snug">{t("Aucun fournisseur ne remplit ce critère avec les données disponibles.")}</p>}
        </div>
      ))}
    </div>
  );
}

/** Recommandation finale : uniquement des ✓ établis par les données ; le reste en réserves. */
export function CarteRecommandation({ reco }: { reco: Recommandation }) {
  const t = useT();
  const idFournisseur = reco.ref.split(":")[0];
  return (
    <section className="rounded-2xl border p-4 sm:p-5" style={reco.ferme ? { background: "#FFFBEB", borderColor: "#FDE68A" } : { background: "#FFFFFF", borderColor: "#E8E8E8" }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[11px] font-bold tracking-wide text-[#B45309] flex items-center gap-1.5">
            <Trophy size={13} />{reco.ferme ? "AXSO RECOMMENDS" : t("MEILLEUR DISPONIBLE — NON RECOMMANDÉ EN L'ÉTAT")}
          </p>
          <Link href={`/dashboard/sourcing/fournisseurs/${idFournisseur}`} className="text-[18px] font-bold text-[#111111] hover:underline">{reco.nom}</Link>
        </div>
        <p className="text-[22px] font-bold tabular-nums" style={{ color: couleurNote(reco.score) }}>{reco.score}<span className="text-[12px] text-[#AAAAAA]">/100</span></p>
      </div>
      <p className="text-[13px] text-[#111111] mt-2 leading-relaxed">{t(reco.explication)}</p>
      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1 mt-3">
        <ul className="space-y-1">
          {reco.raisons.map((r) => <li key={r} className="text-[12px] text-[#111111] flex items-center gap-1.5"><Check size={12} className="text-[#15803D] shrink-0" />{t(r)}</li>)}
          {!reco.raisons.length && <li className="text-[12px] text-[#666666]">{t("Aucun point n'est encore établi par des données vérifiées.")}</li>}
        </ul>
        <ul className="space-y-1">
          {reco.reserves.map((r) => <li key={r} className="text-[12px] text-[#666666] flex items-start gap-1.5"><AlertTriangle size={12} className="text-[#B45309] shrink-0 mt-0.5" />{t(r)}</li>)}
        </ul>
      </div>
      {(reco.alternative || reco.meilleurPrix) && (
        <p className="text-[12px] text-[#666666] mt-3 pt-3 border-t border-[#E8E8E8]">
          {reco.alternative && <>{t("Alternative")} : <b className="text-[#111111]">{reco.alternative.nom}</b> — {reco.alternative.score}/100</>}
          {reco.alternative && reco.meilleurPrix && " · "}
          {reco.meilleurPrix && <>{t("Meilleur prix")} : <b className="text-[#111111]">{reco.meilleurPrix.nom}</b> — {reco.meilleurPrix.score}/100</>}
        </p>
      )}
    </section>
  );
}

/** Tableau de comparaison (jusqu'à 5 fournisseurs) : prix, MOQ, fabricant, certifications, score, risque, délai. */
export function TableauComparaison({ candidats }: { candidats: Candidat[] }) {
  const t = useT();
  const lignes: [string, (c: Candidat) => React.ReactNode][] = [
    ["Prix unitaire", (c) => (c.cout ? montant(c.cout.prix, c.cout.devisePrix, t.loc) : "—")],
    ["Coût rendu", (c) => (c.cout ? montant(c.cout.rendu, c.cout.devise, t.loc) : "—")],
    ["Coût réel estimé", (c) => (c.cout ? <b>{montant(c.cout.total, c.cout.devise, t.loc)}</b> : "—")],
    ["MOQ", (c) => c.offre?.moq ?? t("Non communiqué")],
    ["Fabricant", (c) => <><PastilleFabricant fabricant={c.analyse.fabricant} /> <span className="text-[10px] text-[#AAAAAA]">{c.analyse.fabricant.score}/100</span></>],
    ["Certifications", (c) => (c.analyse.certifications.length ? <div className="flex gap-1 flex-wrap">{c.analyse.certifications.map((x) => <PastilleCertification key={x.code} c={x} />)}</div> : t("Aucune"))],
    ["Score", (c) => <b style={{ color: couleurNote(c.analyse.score) }}>{c.analyse.score}/100</b>],
    ["Risque", (c) => <PastilleRisque niveau={c.analyse.risque.niveau} />],
    ["Délai", (c) => (c.delaiJours === null ? t("Non communiqué") : t("{0} jours", c.delaiJours))],
    ["Confiance des données", (c) => <PastilleConfiance niveau={c.analyse.confiance} />],
  ];
  return (
    <Carte titre="Comparaison" className="overflow-x-auto">
      <table className="w-full text-[12px] min-w-[560px]">
        <thead>
          <tr>
            <th />
            {candidats.map((c) => (
              <th key={c.ref} className="text-left font-bold text-[#111111] px-2 pb-2 align-bottom">
                <Link href={`/dashboard/sourcing/fournisseurs/${c.fournisseur.id}`} className="hover:underline">{c.fournisseur.nom}</Link>
                {c.offre && <span className="block text-[10px] font-normal text-[#AAAAAA]">{c.offre.nomProduit}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lignes.map(([libelle, cellule]) => (
            <tr key={libelle} className="border-t border-[#F0F0F0]">
              <td className="py-2 pr-2 text-[11px] font-semibold text-[#666666] uppercase tracking-wide whitespace-nowrap">{t(libelle)}</td>
              {candidats.map((c) => <td key={c.ref} className="px-2 py-2 text-[#111111] tabular-nums align-top">{cellule(c)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Carte>
  );
}
