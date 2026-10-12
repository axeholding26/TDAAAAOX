"use client";
// Magasins et caisses : création, renommage, désactivation — par les routes des
// fondations (/api/pos/magasins, /api/pos/caisses ; droit gerer_magasins).
// Rien ne se supprime : un magasin ou une caisse qui a servi garde son
// historique, on le désactive.
import { useState } from "react";
import { useT } from "@/components/I18nProvider";
import { Badge, Bouton, EtatChargement, EtatPos, EtatVide, Modale, Saisie } from "@/components/pos/ui";
import { Carte, appelPos, useLecture, type ErreurAppel } from "@/components/pos/finance/commun";

type Caisse = { id: string; nom: string; actif: boolean; sessionOuverte: { id: string } | null };
type Magasin = { id: string; nom: string; ville: string | null; adresse: string | null; actif: boolean; demo: boolean; caisses: Caisse[] };
/** Fenêtre de saisie ouverte : nouveau magasin, nouvelle caisse d'un magasin, ou renommage. */
type Saisie_ = { quoi: "magasin" | "caisse"; id?: string; magasinId?: string; nom: string; ville?: string };

export function ReglagesMagasins({ peutGerer }: { peutGerer: boolean }) {
  const t = useT();
  const { donnees, erreur, recharger } = useLecture<{ magasins: Magasin[] }>("/api/pos/magasins");
  const [saisie, setSaisie] = useState<Saisie_ | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [refus, setRefus] = useState<ErreurAppel | null>(null);

  const envoyer = async (cle: string, url: string, method: "POST" | "PATCH", corps: Record<string, unknown>) => {
    setEnvoi(cle);
    const r = await appelPos(url, { method, corps });
    setEnvoi(null);
    if (!r.ok) { setRefus({ code: r.code, message: r.message }); return false; }
    setRefus(null);
    await recharger();
    return true;
  };
  const valider = async () => {
    if (!saisie) return;
    const nom = saisie.nom.trim();
    const fait = saisie.quoi === "magasin"
      ? await envoyer("saisie", saisie.id ? `/api/pos/magasins/${saisie.id}` : "/api/pos/magasins", saisie.id ? "PATCH" : "POST", { nom, ville: saisie.ville?.trim() || null })
      : await envoyer("saisie", saisie.id ? `/api/pos/caisses/${saisie.id}` : "/api/pos/caisses", saisie.id ? "PATCH" : "POST", saisie.id ? { nom } : { magasinId: saisie.magasinId, nom });
    if (fait) setSaisie(null);
  };
  const nomValide = (saisie?.nom.trim().length ?? 0) >= (saisie?.quoi === "magasin" ? 2 : 1);

  return (
    <Carte titre="Magasins et caisses" actions={peutGerer ? <Bouton variante="secondaire" taille="compact" onClick={() => { setRefus(null); setSaisie({ quoi: "magasin", nom: "", ville: "" }); }}>{t("Ajouter un magasin")}</Bouton> : undefined}>
      {refus && !saisie && <div className="mb-3"><EtatPos compact code={refus.code} message={refus.message} /></div>}
      {erreur && !donnees ? <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={recharger} />
        : !donnees ? <EtatChargement compact />
        : donnees.magasins.length === 0 ? <EtatVide compact titre="Aucun magasin" />
        : (
          <ul className="space-y-3">
            {donnees.magasins.map((m) => (
              <li key={m.id} className="rounded-2xl border border-[#E8E8E8] p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 flex-1 basis-40 text-[14px] font-bold text-[#111111]">{m.nom}{m.ville && <span className="ml-2 text-[12px] font-normal text-[#666666]">{m.ville}</span>}</p>
                  {m.demo && <Badge ton="info">{t("DÉMO")}</Badge>}
                  {!m.actif && <Badge ton="neutre">{t("Désactivé")}</Badge>}
                  {peutGerer && (
                    <>
                      <Bouton variante="discret" taille="compact" onClick={() => { setRefus(null); setSaisie({ quoi: "magasin", id: m.id, nom: m.nom, ville: m.ville ?? "" }); }}>{t("Modifier")}</Bouton>
                      <Bouton variante="discret" taille="compact" charge={envoi === m.id} onClick={() => void envoyer(m.id, `/api/pos/magasins/${m.id}`, "PATCH", { actif: !m.actif })}>{t(m.actif ? "Désactiver" : "Réactiver")}</Bouton>
                    </>
                  )}
                </div>
                <ul className="mt-2 divide-y divide-[#F0F0F0]">
                  {m.caisses.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="min-w-0 flex-1 basis-32 text-[13px] text-[#111111]">{c.nom}</span>
                      {c.sessionOuverte ? <Badge ton="positif">{t("Session ouverte")}</Badge> : !c.actif ? <Badge ton="neutre">{t("Désactivée")}</Badge> : null}
                      {peutGerer && (
                        <>
                          <Bouton variante="discret" taille="compact" onClick={() => { setRefus(null); setSaisie({ quoi: "caisse", id: c.id, nom: c.nom }); }}>{t("Renommer")}</Bouton>
                          <Bouton variante="discret" taille="compact" charge={envoi === c.id} onClick={() => void envoyer(c.id, `/api/pos/caisses/${c.id}`, "PATCH", { actif: !c.actif })}>{t(c.actif ? "Désactiver" : "Réactiver")}</Bouton>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                {peutGerer && m.actif && <div className="mt-2"><Bouton variante="secondaire" taille="compact" onClick={() => { setRefus(null); setSaisie({ quoi: "caisse", magasinId: m.id, nom: "" }); }}>{t("Ajouter une caisse")}</Bouton></div>}
              </li>
            ))}
          </ul>
        )}
      {!peutGerer && <p className="mt-3 text-[12px] text-[#888888]">{t("Seul un compte autorisé à gérer les magasins peut les modifier.")}</p>}

      <Modale ouverte={!!saisie} onFermer={() => setSaisie(null)} taille="sm"
        titre={saisie?.quoi === "magasin" ? (saisie.id ? "Modifier le magasin" : "Nouveau magasin") : saisie?.id ? "Renommer la caisse" : "Nouvelle caisse"}
        description={saisie?.quoi === "magasin" && !saisie.id ? "Le magasin reçoit son propre lieu de stock et une première caisse." : undefined}
        actions={<><Bouton variante="secondaire" onClick={() => setSaisie(null)}>{t("Annuler")}</Bouton><Bouton onClick={() => void valider()} charge={envoi === "saisie"} disabled={!nomValide}>{t("Enregistrer")}</Bouton></>}>
        {saisie && (
          <form onSubmit={(e) => { e.preventDefault(); if (nomValide) void valider(); }} className="space-y-3">
            <Saisie label="Nom" autoFocus maxLength={saisie.quoi === "magasin" ? 80 : 60} value={saisie.nom} onChange={(e) => setSaisie({ ...saisie, nom: e.target.value })} />
            {saisie.quoi === "magasin" && <Saisie label="Ville" maxLength={80} value={saisie.ville ?? ""} onChange={(e) => setSaisie({ ...saisie, ville: e.target.value })} />}
            {refus && <EtatPos compact code={refus.code} message={refus.message} />}
          </form>
        )}
      </Modale>
    </Carte>
  );
}
