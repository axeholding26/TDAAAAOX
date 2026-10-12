"use client";
// Promotions de la caisse : liste, création guidée, activation, suppression.
// Les promotions ne s'appliquent en caisse que si le moteur (drapeau
// smart_promotions) est allumé : l'écran le dit et propose de l'allumer.
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Power, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, BoutonIcone, EtatChargement, EtatPos, EtatVide, Modale, POLICE, type Ton } from "@/components/pos/ui";
import { appelPos } from "@/components/pos/crm/appel";
import { FormulairePromotion, type PromotionLue } from "@/components/pos/crm/FormulairePromotion";
import { TYPES_PROMO, dateCourte, resumePromotion } from "@/components/pos/crm/libelles";
import type { TypePromotion } from "@/lib/pos/promotions";

type Donnees = {
  promotions: PromotionLue[]; moteurActif: boolean; peutGerer: boolean; peutActiverMoteur: boolean;
  magasins: { id: string; nom: string }[]; codesPromo: { id: string; code: string }[];
};

const ETATS: Record<PromotionLue["etat"], { libelle: string; ton: Ton }> = {
  active: { libelle: "Active", ton: "positif" }, inactive: { libelle: "Désactivée", ton: "neutre" },
  a_venir: { libelle: "À venir", ton: "info" }, terminee: { libelle: "Terminée", ton: "neutre" },
};

export default function PagePromotions() {
  const t = useT();
  const { fmt } = useDevise();
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [formulaire, setFormulaire] = useState<{ ouvert: boolean; promotion: PromotionLue | null }>({ ouvert: false, promotion: null });
  const [aSupprimer, setASupprimer] = useState<PromotionLue | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [alerte, setAlerte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setErreur(null);
    const r = await appelPos<Donnees>("/api/pos/promotions");
    if (r.ok) setD(r.donnees); else setErreur(r);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  async function activerMoteur() {
    setOccupe("moteur"); setAlerte(null);
    const r = await appelPos("/api/pos/reglages", { method: "PATCH", corps: { flags: { smart_promotions: true } } });
    setOccupe(null);
    if (!r.ok) return setAlerte(r.message);
    toast.success(t("Moteur de promotions activé : les promotions actives s'appliquent en caisse."));
    charger();
  }

  async function basculer(p: PromotionLue) {
    setOccupe(p.id); setAlerte(null);
    const r = await appelPos<{ promotion: PromotionLue }>(`/api/pos/promotions/${p.id}`, { method: "PATCH", corps: { actif: !p.actif } });
    setOccupe(null);
    if (!r.ok) return setAlerte(r.message);
    setD((x) => x && { ...x, promotions: x.promotions.map((y) => (y.id === p.id ? r.donnees.promotion : y)) });
  }

  async function supprimer() {
    if (!aSupprimer) return;
    setOccupe(aSupprimer.id);
    const r = await appelPos(`/api/pos/promotions/${aSupprimer.id}`, { method: "DELETE" });
    setOccupe(null); setASupprimer(null);
    if (!r.ok) return setAlerte(r.message);
    toast.success(t("Promotion supprimée."));
    charger();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-5" style={POLICE}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#111111]">{t("Promotions")}</h1>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-[#666666]">{t("Remises appliquées d'office à la caisse. Un article ne reçoit jamais deux promotions : la plus prioritaire l'emporte.")}</p>
        </div>
        {d?.peutGerer && <Bouton icone={<Plus size={16} aria-hidden />} onClick={() => setFormulaire({ ouvert: true, promotion: null })}>{t("Nouvelle promotion")}</Bouton>}
      </header>

      {erreur && <EtatPos code={erreur.code} message={erreur.message} onReessayer={charger} />}
      {!d && !erreur && <EtatChargement texte="Chargement des promotions…" />}

      {d && (
        <>
          {!d.moteurActif && (
            <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-bold text-[#92400E]">{t("Le moteur de promotions est éteint")}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#92400E]">{t("Vous pouvez préparer vos promotions, mais aucune ne s'applique en caisse tant qu'il n'est pas activé.")}{!d.peutActiverMoteur && ` ${t("Demandez au propriétaire de l'activer dans les réglages de la caisse.")}`}</p>
              </div>
              {d.peutActiverMoteur && <Bouton variante="sombre" icone={<Power size={15} aria-hidden />} charge={occupe === "moteur"} onClick={activerMoteur}>{t("Activer le moteur")}</Bouton>}
            </div>
          )}
          {alerte && <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] text-[#B91C1C]">{t(alerte)}</p>}

          {!d.promotions.length ? (
            <EtatVide titre="Aucune promotion" texte="Créez votre première promotion : pourcentage, 2+1, lot, prix membre, prix de gros…">
              {d.peutGerer && <Bouton icone={<Plus size={16} aria-hidden />} onClick={() => setFormulaire({ ouvert: true, promotion: null })}>{t("Nouvelle promotion")}</Bouton>}
            </EtatVide>
          ) : (
            <ul className="space-y-2">
              {d.promotions.map((p) => {
                const magasins = p.magasinIds.map((id) => d.magasins.find((m) => m.id === id)?.nom).filter(Boolean);
                const code = d.codesPromo.find((c) => c.id === p.codePromoId)?.code;
                return (
                  <li key={p.id} className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#FFF7ED] text-[#B45309]" aria-hidden><Tag size={18} /></span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[14.5px] font-bold text-[#111111]">{p.nom}</h2>
                          <Badge ton={ETATS[p.etat].ton}>{t(ETATS[p.etat].libelle)}</Badge>
                          <Badge>{t(TYPES_PROMO[p.type as TypePromotion]?.libelle ?? p.type)}</Badge>
                          {p.cumulable && <Badge ton="info">{t("Cumulable")}</Badge>}
                          {code && <Badge ton="info">{t("Code")} {code}</Badge>}
                        </div>
                        <p className="mt-1 text-[13px] text-[#333333]">{resumePromotion(p, fmt)}</p>
                        <p className="mt-1 text-[11.5px] text-[#888888]">
                          {p.dateDebut || p.dateFin ? `${t("Du")} ${dateCourte(p.dateDebut)} ${t("au")} ${dateCourte(p.dateFin)}` : t("Sans limite de date")}
                          {" · "}{magasins.length ? magasins.join(", ") : t("Tous les magasins")}
                          {" · "}{t("Priorité")} {p.priorite}
                          {" · "}{p.utilisations} {t("utilisation(s)")}
                        </p>
                      </div>
                      {d.peutGerer && (
                        <div className="flex items-center gap-1.5">
                          <Bouton variante={p.actif ? "secondaire" : "discret"} taille="compact" charge={occupe === p.id} onClick={() => basculer(p)}>{t(p.actif ? "Désactiver" : "Activer")}</Bouton>
                          <BoutonIcone label={`${t("Modifier")} ${p.nom}`} onClick={() => setFormulaire({ ouvert: true, promotion: p })}><Pencil size={15} aria-hidden /></BoutonIcone>
                          <BoutonIcone label={`${t("Supprimer")} ${p.nom}`} variante="danger" onClick={() => setASupprimer(p)}><Trash2 size={15} aria-hidden /></BoutonIcone>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <FormulairePromotion
            ouverte={formulaire.ouvert} promotion={formulaire.promotion} autres={d.promotions} magasins={d.magasins} codesPromo={d.codesPromo}
            onFermer={() => setFormulaire({ ...formulaire, ouvert: false })}
            onEnregistree={(p) => { setFormulaire({ ouvert: false, promotion: null }); toast.success(`${t("Promotion enregistrée")} : ${p.nom}`); charger(); }}
          />
          <Modale ouverte={!!aSupprimer} onFermer={() => setASupprimer(null)} taille="sm" titre="Supprimer cette promotion ?"
            description="Une promotion déjà utilisée dans une vente ne peut pas être supprimée : désactivez-la."
            actions={<><Bouton variante="secondaire" onClick={() => setASupprimer(null)}>{t("Annuler")}</Bouton><Bouton variante="danger" charge={!!aSupprimer && occupe === aSupprimer.id} onClick={supprimer}>{t("Supprimer")}</Bouton></>}>
            <p className="text-[13px] font-semibold">{aSupprimer?.nom}</p>
          </Modale>
        </>
      )}
    </div>
  );
}
