"use client";
// Petites fenêtres de la caisse : remise globale / code promo / note,
// mise en attente d'un panier, reprise d'un panier en attente.
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Bouton, Champ, CLASSE_SAISIE, EtatChargement, EtatPos, EtatVide, Modale, Saisie, Tiroir } from "@/components/pos/ui";
import type { LigneDemande, Remise } from "@/lib/pos/types";
import { appelPos } from "./api";
import { idLocal, lireNombre, type ContenuPanier } from "./logique";

/** Remise sur l'ensemble du panier (droit « remise »), code promo, note de vente. */
export function RemiseVente({ remise, codePromo, note, peutRemiser, horsPlafond, plafondPct, onValider, onFermer }: {
  remise: Remise | null; codePromo: string; note: string;
  peutRemiser: boolean; horsPlafond: boolean; plafondPct: number;
  onValider: (v: { remise: Remise | null; codePromo: string; note: string }) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const { devise } = useDevise();
  const [type, setType] = useState<Remise["type"]>(remise?.type ?? "pourcentage");
  const [valeur, setValeur] = useState(remise?.valeur ? String(remise.valeur) : "");
  const [code, setCode] = useState(codePromo);
  const [texte, setTexte] = useState(note);
  const n = valeur.trim() ? lireNombre(valeur) : 0;
  const invalide = n === null || (type === "pourcentage" && n > 100);
  const valider = () => { if (!invalide) onValider({ remise: n ? { type, valeur: n } : null, codePromo: code.trim(), note: texte.trim() }); };

  return (
    <Modale ouverte onFermer={onFermer} taille="sm" titre={peutRemiser ? "Remise et code promo" : "Code promo"}
      actions={<><Bouton variante="secondaire" onClick={onFermer}>{t("Annuler")}</Bouton><Bouton onClick={valider} disabled={invalide}>{t("Appliquer")}</Bouton></>}>
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); valider(); }}>
        {peutRemiser && (
          <div className="grid grid-cols-[1fr_auto] items-start gap-2">
            <Saisie label="Remise sur tout le panier" autoFocus inputMode="decimal" value={valeur} onChange={(e) => setValeur(e.target.value)} placeholder="0"
              erreur={invalide ? "Cette remise n'est pas valide." : null}
              aide={horsPlafond ? "Laissez vide pour retirer la remise." : `Plafond sans validation d'un responsable : ${plafondPct} %.`} />
            <Champ label="Type">
              {(attributs) => (
                <select {...attributs} value={type} onChange={(e) => setType(e.target.value as Remise["type"])} className={CLASSE_SAISIE}>
                  <option value="pourcentage">%</option>
                  <option value="montant">{devise}</option>
                </select>
              )}
            </Champ>
          </div>
        )}
        <Saisie label="Code promo" autoFocus={!peutRemiser} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={60} autoComplete="off" aide="Le code est vérifié par le serveur dès qu'il est appliqué." />
        <Champ label="Note de vente">
          {(attributs) => <textarea {...attributs} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={500} rows={2} placeholder={t("Facultatif")} className={CLASSE_SAISIE} />}
        </Champ>
        <button type="submit" hidden />
      </form>
    </Modale>
  );
}

/** Nom donné au panier mis en attente, pour le retrouver (« Dame au pagne bleu »). */
export function SuspendrePanier({ onValider, onFermer }: { onValider: (libelle: string) => Promise<{ code: string; message: string } | null>; onFermer: () => void }) {
  const t = useT();
  const [libelle, setLibelle] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const valider = async () => {
    if (envoi) return;
    setEnvoi(true); setErreur(null);
    const e = await onValider(libelle.trim());
    setEnvoi(false);
    if (e) setErreur(e);
  };
  return (
    <Modale ouverte onFermer={onFermer} verrouillee={envoi} taille="sm" titre="Mettre le panier en attente" description="Le panier est gardé sur le serveur : il pourra être repris depuis n'importe quelle caisse du magasin."
      actions={<><Bouton variante="secondaire" onClick={onFermer} disabled={envoi}>{t("Annuler")}</Bouton><Bouton onClick={valider} charge={envoi}>{t("Mettre en attente")}</Bouton></>}>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); valider(); }}>
        <Saisie label="Repère" autoFocus value={libelle} onChange={(e) => setLibelle(e.target.value)} maxLength={80} placeholder={t("Facultatif — ex. le nom du client")} />
        {erreur && <EtatPos compact code={erreur.code} message={erreur.message} onReessayer={valider} />}
        <button type="submit" hidden />
      </form>
    </Modale>
  );
}

type PanierEnAttente = { id: string; libelle: string | null; total: number; createdAt: string; clientId: string | null; contenu: { lignes?: LigneDemande[]; remise?: Remise | null; codePromo?: string | null; caisse?: ContenuPanier } };

/** Ce qu'un panier en attente redonne à l'écran. Sans l'instantané de la caisse (panier créé ailleurs), les libellés reviennent du serveur au calcul. */
function contenuDe(p: PanierEnAttente): Partial<ContenuPanier> {
  if (p.contenu?.caisse?.lignes?.length) return p.contenu.caisse;
  return {
    lignes: (p.contenu?.lignes ?? []).map((l) => ({ ...l, id: idLocal(), nom: "", prixUnitaire: 0, stock: null, variantes: [], suiviSerie: !!(l.numeroSerie || l.numeroSerieId) })),
    remise: p.contenu?.remise ?? null, codePromo: p.contenu?.codePromo ?? "",
  };
}

/** Paniers en attente du magasin : reprendre (une seule caisse y parvient) ou abandonner. */
export function PaniersSuspendus({ caisseId, panierOccupe, onReprendre, onFermer }: {
  caisseId: string | null;
  /** Une vente est en cours : il faut la terminer ou la suspendre avant d'en reprendre une autre. */
  panierOccupe: boolean;
  onReprendre: (contenu: Partial<ContenuPanier>) => void;
  onFermer: () => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [paniers, setPaniers] = useState<PanierEnAttente[]>([]);
  const [etat, setEtat] = useState<"chargement" | "pret" | { code: string; message: string }>("chargement");
  const [essai, setEssai] = useState(0);
  const [action, setAction] = useState<string | null>(null);
  const [aAbandonner, setAAbandonner] = useState<string | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);

  useEffect(() => {
    let annule = false;
    setEtat("chargement");
    appelPos<{ paniers?: PanierEnAttente[] }>("/api/pos/ventes/suspendus", { caisseId }).then((r) => {
      if (annule) return;
      if (!r.ok) return setEtat({ code: r.code, message: r.message });
      setPaniers(r.donnees.paniers ?? []);
      setEtat("pret");
    });
    return () => { annule = true; };
  }, [caisseId, essai]);

  const agir = async (p: PanierEnAttente, quoi: "reprendre" | "abandonner") => {
    setAction(p.id); setErreur(null);
    const r = await appelPos(`/api/pos/ventes/suspendus/${p.id}`, { method: "PATCH", caisseId, corps: { action: quoi } });
    setAction(null); setAAbandonner(null);
    if (!r.ok) { setErreur({ code: r.code, message: r.message }); if (r.code === "conflit") setEssai((n) => n + 1); return; }
    if (quoi === "reprendre") onReprendre(contenuDe(p));
    else setPaniers((ps) => ps.filter((x) => x.id !== p.id));
  };

  return (
    <Tiroir ouverte onFermer={onFermer} titre="Paniers en attente" description={panierOccupe ? "Terminez ou mettez en attente la vente en cours avant d'en reprendre une autre." : undefined}>
      <div className="space-y-3">
        {erreur && <EtatPos compact code={erreur.code} message={erreur.message} />}
        {etat === "chargement" ? <EtatChargement compact texte="Chargement des paniers en attente…" />
          : typeof etat === "object" ? <EtatPos compact code={etat.code} message={etat.message} onReessayer={() => setEssai((n) => n + 1)} />
          : paniers.length === 0 ? <EtatVide compact titre="Aucun panier en attente" texte="Un panier mis en attente (F6) apparaît ici, pour toutes les caisses du magasin." />
          : (
            <ul className="space-y-2">
              {paniers.map((p) => (
                <li key={p.id} className={cn("rounded-2xl border border-[#E8E8E8] p-3", action === p.id && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-semibold text-[#111111]">{p.libelle || p.contenu?.caisse?.client?.nom || t("Panier sans repère")}</p>
                      <p className="text-[11.5px] text-[#666666]">{new Date(p.createdAt).toLocaleString(t.loc, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {t("{0} ligne(s)", p.contenu?.lignes?.length ?? 0)}</p>
                    </div>
                    <p className="flex-shrink-0 text-[14px] font-bold tabular-nums text-[#111111]">{fmt(p.total)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap justify-end gap-2">
                    {aAbandonner === p.id
                      ? <><Bouton variante="secondaire" taille="compact" onClick={() => setAAbandonner(null)}>{t("Garder")}</Bouton><Bouton variante="danger" taille="compact" onClick={() => agir(p, "abandonner")} charge={action === p.id}>{t("Confirmer l'abandon")}</Bouton></>
                      : <><Bouton variante="danger" taille="compact" onClick={() => setAAbandonner(p.id)} disabled={!!action}>{t("Abandonner")}</Bouton><Bouton taille="compact" onClick={() => agir(p, "reprendre")} disabled={panierOccupe || !!action} charge={action === p.id}>{t("Reprendre")}</Bouton></>}
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
    </Tiroir>
  );
}
