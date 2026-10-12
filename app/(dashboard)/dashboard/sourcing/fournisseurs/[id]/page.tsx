"use client";
// Fiche d'un fournisseur (Supplier Intelligence) : score expliqué, risques,
// offres et coût réel, documents, audits, échantillons, évaluations.
// Règle d'affichage : rien n'est montré comme « vérifié » si l'API ne le dit pas,
// et le marchand ne peut saisir aucun niveau de vérification.
import { useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Globe, Mail, MessageCircle, Pencil } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Page, Entete, Carte, Bouton, Chargement, Erreur, Onglets, CLASSE_CHAMP, useApi, envoyer } from "@/components/dashboard/sourcing/ui";
import { PastilleConfiance, PastilleRisque, PastilleFabricant, LabelVerified, Score, DetailScore, AlertesRisque, IndicesFabricant, CriteresLabel } from "@/components/dashboard/sourcing/fournisseurs/affichage";
import { FormulaireFournisseur } from "@/components/dashboard/sourcing/fournisseurs/FormulaireFournisseur";
import { CHAMPS_VERIFIABLES, TYPES_ENTREPRISE, niveauConfiance } from "@/lib/sourcing/fournisseurs/types";
import { dateCourte, useEcriture, type Fiche, type PropsOnglet } from "@/components/dashboard/sourcing/fournisseurs/fiche/commun";
import { OngletOffres } from "@/components/dashboard/sourcing/fournisseurs/fiche/OngletOffres";
import { OngletDocuments } from "@/components/dashboard/sourcing/fournisseurs/fiche/OngletDocuments";
import { OngletAudits } from "@/components/dashboard/sourcing/fournisseurs/fiche/OngletAudits";
import { OngletEchantillons } from "@/components/dashboard/sourcing/fournisseurs/fiche/OngletEchantillons";
import { OngletEvaluations } from "@/components/dashboard/sourcing/fournisseurs/fiche/OngletEvaluations";

type CleOnglet = "apercu" | "offres" | "documents" | "audits" | "echantillons" | "evaluations";

function Apercu({ fiche, recharger }: PropsOnglet) {
  const t = useT();
  const { erreur, enCours, executer } = useEcriture(recharger);
  const { dossier, analyse } = fiche;
  // Signalements du marchand : chacun est un signal de risque pris en compte par l'analyse.
  const signalements: [string, boolean, (coche: boolean) => Record<string, boolean | null>][] = [
    ["Refuse d'envoyer un échantillon", dossier.echantillonPossible === false, (c) => ({ echantillonPossible: c ? false : null })],
    ["Refuse une inspection par un tiers", dossier.inspectionAcceptee === false, (c) => ({ inspectionAcceptee: c ? false : null })],
    ["Me pousse à payer hors plateforme", dossier.paiementHorsPlateforme, (c) => ({ paiementHorsPlateforme: c })],
  ];
  return (
    <div className="space-y-4">
      <Carte titre="Risques"><AlertesRisque risque={analyse.risque} /></Carte>
      <div className="grid lg:grid-cols-2 gap-4">
        <Carte titre="Détail du score"><DetailScore analyse={analyse} /></Carte>
        <div className="space-y-4">
          <Carte titre="Fabricant ou intermédiaire ?"><IndicesFabricant fabricant={analyse.fabricant} /></Carte>
          <Carte titre="Label AXSO Verified Supplier"><CriteresLabel label={analyse.label} /></Carte>
        </div>
      </div>
      <Carte titre="Vos signalements" aide="Ce que vous avez constaté en échangeant avec ce fournisseur. Chaque signalement compte comme un signal de risque.">
        {erreur && <div className="mb-3"><Erreur message={erreur} /></div>}
        <div className="space-y-2">
          {signalements.map(([libelle, coche, corps]) => (
            <label key={libelle} className="flex items-center gap-2.5 text-[13px] text-[#111111] cursor-pointer">
              <input type="checkbox" checked={coche} disabled={enCours} className="w-4 h-4 accent-[#F5A623]"
                onChange={(e) => executer(() => envoyer(`/api/fournisseurs/${dossier.id}`, "PATCH", corps(e.target.checked)))} />
              {t(libelle)}
            </label>
          ))}
        </div>
      </Carte>
      <Carte titre="Journal des vérifications" aide="Chaque ligne indique qui ou quoi atteste l'information. Les vérifications sont faites par l'équipe AXSO, jamais saisies par le marchand.">
        {!dossier.verifications.length && <p className="text-[12px] text-[#666666]">{t("Aucune vérification enregistrée : les informations de cette fiche sont déclarées.")}</p>}
        <ul className="divide-y divide-[#F0F0F0]">
          {dossier.verifications.map((v) => (
            <li key={v.id} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[12px] font-semibold text-[#111111]">{t(CHAMPS_VERIFIABLES[v.champ] ?? v.champ)}</p>
                <p className="text-[11px] text-[#666666] leading-snug">{dateCourte(v.createdAt, t.loc)} · {t(v.source)}{v.note && <> · {v.note}</>}</p>
              </div>
              <PastilleConfiance niveau={niveauConfiance(v.niveau)} source={v.source} />
            </li>
          ))}
        </ul>
      </Carte>
    </div>
  );
}

export default function PageFicheFournisseur() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const [quantite, setQuantite] = useState(100);
  const [saisieQuantite, setSaisieQuantite] = useState("100");
  const [onglet, setOnglet] = useState<CleOnglet>("apercu");
  const [edition, setEdition] = useState(false);
  const { data: fiche, erreur, recharger } = useApi<Fiche>(`/api/fournisseurs/${id}?quantite=${quantite}`);

  // Pendant un rechargement, la fiche déjà affichée reste en place (les onglets gardent leur saisie).
  if (!fiche) return <Page>{erreur ? <Erreur message={erreur} /> : <Chargement />}<Bouton variante="secondaire" href="/dashboard/sourcing/fournisseurs"><ArrowLeft size={13} />{t("Fournisseurs")}</Bouton></Page>;

  const { dossier, analyse } = fiche;
  const validerQuantite = () => {
    const q = Math.floor(Number(saisieQuantite));
    if (q > 0) setQuantite(q); else setSaisieQuantite(String(quantite));
  };
  const chiffres = (dossier.telephone ?? "").replace(/\D/g, "");
  const classeLien = "inline-flex items-center gap-1 text-[12px] font-semibold text-[#B45309] hover:underline";
  const props = { fiche, recharger };

  return (
    <Page>
      <Entete badge="Supplier Intelligence" titre={dossier.nom}
        actions={<>
          <Bouton variante="secondaire" href="/dashboard/sourcing/fournisseurs"><ArrowLeft size={13} />{t("Fournisseurs")}</Bouton>
          <Bouton onClick={() => setEdition(true)}><Pencil size={13} />{t("Modifier")}</Bouton>
        </>} />

      {erreur && <Erreur message={erreur} />}

      {edition ? (
        <Carte titre="Modifier le fournisseur">
          <FormulaireFournisseur initial={dossier} onEnregistre={() => { setEdition(false); recharger(); }} onAnnule={() => setEdition(false)} />
        </Carte>
      ) : (
        <Carte>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <p className="text-[12px] text-[#666666]">{dossier.pays} · {t(TYPES_ENTREPRISE[dossier.typeEntreprise] ?? TYPES_ENTREPRISE.inconnu)}{!dossier.actif && <> · {t("Désactivé")}</>}</p>
              <div className="flex gap-1.5 flex-wrap">
                {analyse.label.attribue && <LabelVerified />}
                <PastilleFabricant fabricant={analyse.fabricant} />
                <PastilleRisque niveau={analyse.risque.niveau} />
                <PastilleConfiance niveau={analyse.confiance} />
              </div>
              <div className="flex gap-x-4 gap-y-1 flex-wrap">
                {dossier.url && <a href={dossier.url} target="_blank" rel="noopener noreferrer" className={classeLien}><Globe size={12} />{t("Site")}</a>}
                {dossier.email && <a href={`mailto:${dossier.email}`} className={classeLien}><Mail size={12} />{dossier.email}</a>}
                {chiffres.length >= 8 && <a href={`https://wa.me/${chiffres}`} target="_blank" rel="noopener noreferrer" className={classeLien}><MessageCircle size={12} />WhatsApp</a>}
              </div>
            </div>
            <Score analyse={analyse} grand />
          </div>
          <form className="flex items-center gap-2 flex-wrap mt-4 pt-4 border-t border-[#F0F0F0]" onSubmit={(e) => { e.preventDefault(); validerQuantite(); }}>
            <label htmlFor="quantite-visee" className="text-[11px] font-semibold text-[#666666] uppercase tracking-wide">{t("Quantité visée")}</label>
            <input id="quantite-visee" type="number" inputMode="numeric" min={1} step={1} value={saisieQuantite}
              onChange={(e) => setSaisieQuantite(e.target.value)} onBlur={validerQuantite} className={`${CLASSE_CHAMP} !w-28`} />
            <span className="text-[11px] text-[#AAAAAA] leading-snug">{t("Prix, coût réel et score sont calculés pour cette quantité, livrée en {0}.", fiche.contexte.paysNom)}</span>
          </form>
        </Carte>
      )}

      <Onglets<CleOnglet> actif={onglet} onChange={setOnglet} onglets={[
        { cle: "apercu", libelle: "Aperçu" },
        { cle: "offres", libelle: "Offres & prix", nombre: dossier.offres.length },
        { cle: "documents", libelle: "Documents & certifications", nombre: dossier.documents.length },
        { cle: "audits", libelle: "Audits & inspections", nombre: dossier.audits.length },
        { cle: "echantillons", libelle: "Échantillons", nombre: dossier.echantillons.length },
        { cle: "evaluations", libelle: "Évaluations", nombre: dossier.evaluations.length },
      ]} />

      {onglet === "apercu" && <Apercu {...props} />}
      {onglet === "offres" && <OngletOffres {...props} />}
      {onglet === "documents" && <OngletDocuments {...props} />}
      {onglet === "audits" && <OngletAudits {...props} />}
      {onglet === "echantillons" && <OngletEchantillons {...props} />}
      {onglet === "evaluations" && <OngletEvaluations {...props} />}
    </Page>
  );
}
