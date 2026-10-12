"use client";
// Droits de caisse par membre de l'équipe : on part de ce que donne son rôle,
// et on retouche action par action (MembreEquipe.droitsPos), plus les magasins
// où il peut travailler (magasinIds). Route : /api/pos/demarrage/equipe (droit
// gerer_reglages, audité). Le propriétaire a tous les droits et n'apparaît pas.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, CLASSE_SAISIE, EtatChargement, EtatPos, EtatVide, FOCUS, Tiroir } from "@/components/pos/ui";
import { Carte, appelPos, useLecture, type ErreurAppel } from "@/components/pos/finance/commun";
import type { ActionPos, DroitsPos } from "@/lib/pos/types";

type Membre = { id: string; nom: string; email: string; role: string; statut: string; moi: boolean; magasinIds: string[]; retouches: Partial<Record<ActionPos, boolean>>; droitsRole: DroitsPos; droits: DroitsPos };
type Reponse = { membres: Membre[]; actions: { id: ActionPos; libelle: string }[]; magasins: { id: string; nom: string; actif: boolean }[] };

const ROLES: Record<string, string> = { gerant: "Gérant", caissier: "Caissier", comptable: "Comptable", lecture: "Lecture seule", personnalise: "Personnalisé" };
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function ReglagesEquipe() {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<Reponse>("/api/pos/demarrage/equipe");
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [retouches, setRetouches] = useState<Partial<Record<ActionPos, boolean | null>>>({});
  const [magasinIds, setMagasinIds] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<ErreurAppel | null>(null);
  const membre = donnees?.membres.find((m) => m.id === ouvert) ?? null;

  const ouvrir = (m: Membre) => { setOuvert(m.id); setRetouches({}); setMagasinIds(m.magasinIds); setRefus(null); };
  const enregistrer = async () => {
    if (!membre) return;
    setEnvoi(true);
    const r = await appelPos("/api/pos/demarrage/equipe", { method: "PATCH", corps: { membreId: membre.id, droitsPos: retouches, magasinIds } });
    setEnvoi(false);
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return; }
    await recharger();
    setOuvert(null);
  };
  /** Valeur affichée d'une action : la retouche en cours, sinon celle enregistrée, sinon « rôle ». */
  const choix = (a: ActionPos): "role" | "oui" | "non" => {
    const v = a in retouches ? retouches[a] : membre?.retouches[a];
    return v === true ? "oui" : v === false ? "non" : "role";
  };

  return (
    <Carte titre="Droits de l'équipe à la caisse">
      <p className="mb-3 text-[12.5px] leading-relaxed text-[#666666]">{t("Chaque rôle donne des droits de départ. Vous pouvez en accorder ou en retirer un par un, et limiter un membre à certains magasins.")}</p>
      {erreur && !donnees ? <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement compact />
        : donnees.membres.length === 0 ? <EtatVide compact titre="Aucun membre d'équipe" texte="Invitez vos caissiers depuis Paramètres → Équipe."><Bouton href="/dashboard/parametres/equipe" variante="secondaire">{t("Gérer l'équipe")}</Bouton></EtatVide>
        : (
          <ul className="divide-y divide-[#F0F0F0]">
            {donnees.membres.map((m) => {
              const nb = Object.keys(m.retouches).length;
              return (
                <li key={m.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate text-[13px] font-semibold text-[#111111]">{m.nom}{m.moi && <span className="ml-2 text-[11.5px] font-normal text-[#888888]">{t("(vous)")}</span>}</p>
                    <p className="truncate text-[12px] text-[#666666]">{t(ROLES[m.role] ?? m.role)} · {m.magasinIds.length ? t("{0} magasin(s)", m.magasinIds.length) : t("tous les magasins")}{nb > 0 && ` · ${t("{0} droit(s) retouché(s)", nb)}`}</p>
                  </div>
                  {m.statut !== "actif" && <Badge ton="neutre">{t(m.statut === "invite" ? "Invité" : "Suspendu")}</Badge>}
                  <Bouton variante="secondaire" taille="compact" disabled={m.moi} onClick={() => ouvrir(m)}>{t("Régler ses droits")}</Bouton>
                </li>
              );
            })}
          </ul>
        )}

      <Tiroir ouverte={!!membre} onFermer={() => setOuvert(null)} largeur="lg" titre={membre ? `Droits de ${membre.nom}` : "Droits"} description="« Selon le rôle » rend la valeur par défaut du rôle."
        actions={<><Bouton variante="secondaire" onClick={() => setOuvert(null)}>{t("Annuler")}</Bouton><Bouton onClick={() => void enregistrer()} charge={envoi}>{t("Enregistrer")}</Bouton></>}>
        {membre && donnees && (
          <div className="space-y-5">
            {refus && <EtatPos compact code={refus.code} message={refus.message} />}
            {donnees.magasins.length > 1 && (
              <fieldset>
                <legend className="mb-1 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Magasins autorisés")}</legend>
                <p className="mb-2 text-[12px] text-[#666666]">{t("Aucune case cochée = tous les magasins.")}</p>
                {donnees.magasins.map((g) => (
                  <label key={g.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-[#FAFAFA]">
                    <input type="checkbox" className={`h-5 w-5 accent-[#111111] ${FOCUS}`} checked={magasinIds.includes(g.id)} onChange={(e) => setMagasinIds((l) => (e.target.checked ? [...l, g.id] : l.filter((x) => x !== g.id)))} />
                    <span className="text-[13px] text-[#111111]">{g.nom}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{t("Ce que ce membre peut faire")}</legend>
              <ul className="divide-y divide-[#F0F0F0]">
                {donnees.actions.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5">
                    <label htmlFor={`droit-${a.id}`} className="min-w-0 flex-1 basis-48 text-[13px] text-[#111111]">{t(majuscule(a.libelle))}</label>
                    <select id={`droit-${a.id}`} className={`${CLASSE_SAISIE} !w-auto`} value={choix(a.id)} onChange={(e) => setRetouches((r) => ({ ...r, [a.id]: e.target.value === "role" ? null : e.target.value === "oui" }))}>
                      <option value="role">{t(membre.droitsRole[a.id] ? "Selon le rôle : oui" : "Selon le rôle : non")}</option>
                      <option value="oui">{t("Autorisé")}</option>
                      <option value="non">{t("Refusé")}</option>
                    </select>
                  </li>
                ))}
              </ul>
            </fieldset>
          </div>
        )}
      </Tiroir>
    </Carte>
  );
}
