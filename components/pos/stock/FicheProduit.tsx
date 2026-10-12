"use client";
// Fiche produit universelle (§10) — réutilisable partout où l'on veut « tout
// savoir d'un article » : scan → fiche, tiroir de l'écran de stock, caisse.
//
//   <FicheProduit code="6111234567890" />                      fiche complète d'un code lu
//   <FicheProduit produitId={id} varianteId={v} mode="stock" />  contrôle stock
//
// Props :
// - code | produitId (+ varianteId) : l'article à montrer.
// - mode : "complete" (défaut) · "prix" (contrôle prix : prix, promotions) ·
//          "stock" (contrôle stock : états par lieu, lots). Mêmes données, vue réduite.
// - caisseId : caisse de travail (le « lieu courant » est l'entrepôt de son magasin).
// - onVariante(id) : appelé quand on choisit une variante dans la fiche (défaut : la fiche la charge elle-même).
// Les blocs affichés dépendent du type de commerce (fiche.champs, table CHAMPS_PAR_COMMERCE côté serveur).
// Coût, marge et prix d'achat n'apparaissent qu'avec le droit « voir_couts ».
import { useEffect, useState } from "react";
import { ShieldCheck, Tag, Truck } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, EtatChargement, EtatPos, FOCUS, type Ton } from "@/components/pos/ui";
import type { FicheProduit as Fiche } from "@/lib/pos/operations/fiche";
import { cn } from "@/lib/utils";
import AnalyseArticle from "@/components/pos/pilotage/AnalyseArticle";
import { appelPos, jour, qte, Vignette, type Etats } from "./commun";

export type ModeFiche = "complete" | "prix" | "stock";

const ETATS_LOT: Record<string, { libelle: string; ton: Ton }> = {
  ok: { libelle: "Actif", ton: "positif" }, expire_bientot: { libelle: "Expire bientôt", ton: "attention" }, expire: { libelle: "Expiré", ton: "danger" },
  bloque: { libelle: "Bloqué", ton: "danger" }, epuise: { libelle: "Épuisé", ton: "neutre" }, perime: { libelle: "Périmé", ton: "danger" }, rappele: { libelle: "Rappelé", ton: "danger" },
};
export const STATUTS_SERIE: Record<string, { libelle: string; ton: Ton }> = {
  en_stock: { libelle: "En stock", ton: "positif" }, vendu: { libelle: "Vendu", ton: "info" }, retourne: { libelle: "Retourné", ton: "attention" },
  defectueux: { libelle: "Défectueux", ton: "danger" }, bloque: { libelle: "Bloqué", ton: "danger" },
};
export { ETATS_LOT };

/** Les 7 états du stock, en grille. `fort` met le disponible en avant. */
export function GrilleEtats({ etats, unite, compact }: { etats: Etats; unite?: string | null; compact?: boolean }) {
  const t = useT();
  const cases: [string, number, boolean?][] = [
    ["Physique", etats.physique], ["Réservé", etats.reserve], ["Bloqué", etats.bloque], ["Endommagé", etats.endommage],
    ["Disponible", etats.disponible, true], ["En transit", etats.enTransit], ["En commande", etats.enCommande],
  ];
  return (
    <dl className={cn("grid gap-1.5", compact ? "grid-cols-4 sm:grid-cols-7" : "grid-cols-2 sm:grid-cols-4")}>
      {cases.map(([libelle, valeur, fort]) => (
        <div key={libelle} className={cn("rounded-xl px-2 py-1.5", fort ? "bg-[#111111] text-white" : "bg-[#F5F5F5] text-[#111111]")}>
          <dt className={cn("truncate text-[10px] font-semibold uppercase tracking-wide", fort ? "text-white/70" : "text-[#666666]")}>{t(libelle)}</dt>
          <dd className={cn("font-bold tabular-nums", compact ? "text-[13px]" : "text-[15px]", !fort && valeur === 0 && "text-[#AAAAAA]")}>{qte(valeur, unite, t.loc)}</dd>
        </div>
      ))}
    </dl>
  );
}

function Bloc({ titre, icone, children }: { titre: string; icone?: React.ReactNode; children: React.ReactNode }) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-[#E8E8E8] bg-white p-4">
      <h3 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[#666666]">{icone}{t(titre)}</h3>
      {children}
    </section>
  );
}

function Paire({ libelle, children }: { libelle: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-[13px]">
      <dt className="text-[#666666]">{t(libelle)}</dt>
      <dd className="text-right font-semibold text-[#111111]">{children}</dd>
    </div>
  );
}

export default function FicheProduit({ code, produitId, varianteId, mode = "complete", caisseId, onVariante }: {
  code?: string | null; produitId?: string | null; varianteId?: string | null; mode?: ModeFiche; caisseId?: string | null; onVariante?: (varianteId: string) => void;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const [variante, setVariante] = useState<string | null>(null);
  const [fiche, setFiche] = useState<Fiche | null>(null);
  const [erreur, setErreur] = useState<{ code: string; message: string } | null>(null);
  const [charge, setCharge] = useState(false);
  const [tour, setTour] = useState(0);

  // Changement d'article : la variante choisie dans la fiche précédente ne vaut plus.
  useEffect(() => { setVariante(null); }, [code, produitId, varianteId]);

  useEffect(() => {
    if (!code && !produitId) { setFiche(null); setErreur(null); return; }
    const abandon = new AbortController();
    const p = new URLSearchParams();
    // Une variante choisie dans la fiche se lit par identifiants, même si la fiche était venue d'un code.
    if (variante && fiche) { p.set("produitId", fiche.produitId); p.set("varianteId", variante); }
    else if (produitId) { p.set("produitId", produitId); if (varianteId) p.set("varianteId", varianteId); }
    else p.set("code", code!);
    setCharge(true);
    appelPos<{ fiche: Fiche }>(`/api/pos/fiche?${p}`, { caisseId, signal: abandon.signal }).then((r) => {
      if (!r.ok) { if (r.code === "annule") return; setErreur({ code: r.code, message: r.message }); setFiche(null); }
      else { setFiche(r.donnees.fiche); setErreur(null); }
      setCharge(false);
    });
    return () => abandon.abort();
    // `fiche` n'est lu que pour retrouver le produit d'une variante choisie : il ne doit pas relancer le chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, produitId, varianteId, variante, caisseId, tour]);

  if (!code && !produitId) return null;
  if (erreur) {
    return erreur.code === "inconnu"
      ? <div role="alert" className="rounded-2xl border border-dashed border-[#FCD34D] bg-[#FFFBEB] p-5 text-center"><p className="text-[14px] font-bold text-[#111111]">{t("Produit non reconnu")}</p><p className="mt-1 text-[12.5px] text-[#666666]">{t(erreur.message)}</p></div>
      : <EtatPos code={erreur.code} message={erreur.message} onReessayer={() => setTour((n) => n + 1)} compact />;
  }
  if (!fiche) return <EtatChargement texte="Chargement de la fiche…" compact />;

  const f = fiche;
  const u = f.uniteVente;
  const suffixePrix = u === "kg" ? ` / kg` : "";
  const voirPrix = mode !== "stock";
  const voirStock = mode !== "prix";
  const complet = mode === "complete";
  const lieuCourant = f.stock.lieux.find((l) => l.courant);

  return (
    <div className={cn("space-y-3 transition-opacity", charge && "opacity-60")} aria-busy={charge}>
      <header className="flex items-start gap-3 rounded-2xl border border-[#E8E8E8] bg-white p-4">
        <Vignette src={f.image} taille={64} />
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold leading-tight text-[#111111]">{f.nom}</h2>
          {f.variante && <p className="text-[13px] font-semibold text-[#B45309]">{f.variante}</p>}
          <p className="mt-1 break-all text-[11.5px] text-[#666666]">
            {[f.sku && `${t("Réf.")} ${f.sku}`, f.codeBarres && `${t("Code-barres")} ${f.codeBarres}`, f.categorie, f.marque].filter(Boolean).join(" · ") || t("Aucune référence enregistrée")}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {!f.actif && <Badge ton="danger">{t("Retiré de la vente")}</Badge>}
            {f.suiviSerie && <Badge ton="info">{t("Suivi par numéro de série")}</Badge>}
            {u === "kg" && <Badge>{t("Vendu au poids")}</Badge>}
            {f.poidsGrammes ? <Badge ton="accent">{t("Étiquette : {0}", qte(f.poidsGrammes, "kg", t.loc))}</Badge> : null}
          </div>
        </div>
        {voirPrix && (
          <div className="flex-shrink-0 text-right">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[#666666]">{t("Prix de vente")}</p>
            <p className={cn("font-bold tabular-nums text-[#111111]", mode === "prix" ? "text-[26px]" : "text-[18px]")}>{fmt(f.prix)}{suffixePrix}</p>
          </div>
        )}
      </header>

      {voirPrix && f.promotions.length > 0 && (
        <Bloc titre="Promotions en cours" icone={<Tag size={13} aria-hidden />}>
          <ul className="flex flex-wrap gap-1.5">{f.promotions.map((p) => <li key={p.id}><Badge ton="accent">{p.nom}</Badge></li>)}</ul>
          <p className="mt-2 text-[11px] text-[#888888]">{t("Promotions qui visent cet article. Le montant exact dépend du panier : il est calculé à la caisse.")}</p>
        </Bloc>
      )}

      {complet && f.coutsVisibles && (
        <Bloc titre="Coût et marge">
          <dl>
            <Paire libelle="Prix d'achat">{f.prixAchat !== null ? `${fmt(f.prixAchat)}${suffixePrix}` : t("Non renseigné")}</Paire>
            <Paire libelle="Marge">{f.marge !== null ? `${fmt(f.marge)}${suffixePrix}` : "—"}</Paire>
            <Paire libelle="Taux de marge">{f.margePct !== null ? `${f.margePct.toLocaleString(t.loc)} %` : "—"}</Paire>
            <Paire libelle="Dernier prix d'achat reçu">{f.dernierAchat ? `${fmt(f.dernierAchat.cout)} · ${jour(f.dernierAchat.date, t.loc)}` : t("Aucune réception enregistrée")}</Paire>
          </dl>
        </Bloc>
      )}

      {voirStock && (
        <Bloc titre={lieuCourant && mode === "stock" ? "Stock de ce magasin" : "Stock de la boutique"}>
          <GrilleEtats etats={mode === "stock" && lieuCourant ? lieuCourant : f.stock.total} unite={u} />
          {f.stockMin ? <p className="mt-2 text-[11.5px] text-[#666666]">{t("Seuil d'alerte : {0}", qte(f.stockMin, u, t.loc))}</p> : null}
          {f.stock.lieux.length > 1 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-[12.5px]">
                <caption className="sr-only">{t("Stock par lieu")}</caption>
                <thead><tr className="text-[10.5px] uppercase tracking-wide text-[#666666]">
                  <th scope="col" className="py-1.5 font-semibold">{t("Lieu")}</th>
                  {["Physique", "Bloqué", "Endommagé", "Disponible", "En transit"].map((c) => <th key={c} scope="col" className="py-1.5 text-right font-semibold">{t(c)}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {f.stock.lieux.map((l) => (
                    <tr key={l.id}>
                      <th scope="row" className="py-2 font-semibold text-[#111111]">{l.nom}{l.courant && <Badge ton="accent" className="ml-1.5">{t("Ici")}</Badge>}</th>
                      {[l.physique, l.bloque, l.endommage, l.disponible, l.enTransit].map((v, i) => <td key={i} className={cn("py-2 text-right tabular-nums", i === 3 ? "font-bold text-[#111111]" : "text-[#555555]")}>{qte(v, u, t.loc)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Bloc>
      )}

      {complet && (
        <Bloc titre="Ventes">
          <dl className="grid grid-cols-3 gap-2">
            {([["Aujourd'hui", f.ventes.aujourdhui], ["7 jours", f.ventes.jours7], ["30 jours", f.ventes.jours30]] as const).map(([libelle, v]) => (
              <div key={libelle} className="rounded-xl bg-[#F5F5F5] px-2.5 py-2">
                <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-[#666666]">{t(libelle)}</dt>
                <dd className="text-[15px] font-bold tabular-nums text-[#111111]">{qte(v.quantite, u, t.loc)}</dd>
                <dd className="text-[11px] tabular-nums text-[#666666]">{fmt(v.montant)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-[11px] text-[#888888]">{t("Toutes ventes confondues (caisse et boutique en ligne), retours déduits.")}</p>
        </Bloc>
      )}

      {f.champs.variantes && f.variantes.length > 0 && (
        <Bloc titre="Variantes">
          <ul className="divide-y divide-[#F0F0F0]">
            {f.variantes.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => (onVariante ? onVariante(v.id) : setVariante(v.id))} aria-current={v.id === f.varianteId || undefined}
                  className={cn("flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 text-left text-[12.5px] hover:bg-[#FFF7ED]", FOCUS, v.id === f.varianteId && "bg-[#FFF7ED]")}>
                  <span className="min-w-0">
                    <span className="font-semibold text-[#111111]">{v.libelle}</span>{!v.actif && <span className="text-[#B91C1C]"> · {t("inactive")}</span>}
                    <span className="block break-all text-[11px] text-[#888888]">{[v.sku, v.codeBarres].filter(Boolean).join(" · ") || t("Sans code")}</span>
                  </span>
                  <span className="flex-shrink-0 text-right tabular-nums">
                    {voirPrix && <span className="font-bold text-[#111111]">{fmt(v.prix)}</span>}
                    {complet && f.coutsVisibles && v.cout !== null && <span className="block text-[11px] text-[#666666]">{t("Coût {0} · marge {1}", fmt(v.cout), v.margePct !== null ? `${v.margePct.toLocaleString(t.loc)} %` : "—")}</span>}
                    {voirStock && <span className="block text-[11px] text-[#666666]">{t("Stock {0}", qte(v.stock, u, t.loc))}{v.stockLieu !== null && f.stock.lieux.length > 1 ? ` · ${t("ici {0}", qte(v.stockLieu, u, t.loc))}` : ""}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Bloc>
      )}

      {voirStock && f.champs.lots && (
        <Bloc titre="Lots et expiration">
          {f.lots.length === 0 ? <p className="text-[12.5px] text-[#888888]">{t("Aucun lot en stock pour cet article.")}</p> : (
            <ul className="divide-y divide-[#F0F0F0]">
              {f.lots.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                  <span><span className="font-mono font-bold text-[#111111]">{l.codeLot}</span> · {t("reste {0}", qte(l.quantiteRestante, u, t.loc))}{f.coutsVisibles && l.cout !== null ? ` · ${fmt(l.cout)}` : ""}</span>
                  <span className="flex items-center gap-1.5">
                    {l.dateExpiration && <span className="text-[#666666]">{t("Expire le {0}", jour(l.dateExpiration, t.loc))}</span>}
                    <Badge ton={ETATS_LOT[l.etat]?.ton ?? "neutre"}>{t(ETATS_LOT[l.etat]?.libelle ?? l.etat)}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-[#888888]">{t("La caisse vend d'abord le lot qui expire le plus tôt. Alerte {0} jours avant la date.", f.seuilExpirationJours)}</p>
        </Bloc>
      )}

      {mode !== "prix" && f.champs.series && (
        <Bloc titre="Numéros de série" icone={<ShieldCheck size={13} aria-hidden />}>
          {f.series.scanne && (
            <div className="mb-2 rounded-xl bg-[#FFF7ED] p-3 text-[12.5px]">
              <p className="font-bold text-[#111111]">{t("Numéro scanné :")} <span className="font-mono">{f.series.scanne.numero}</span> <Badge ton={STATUTS_SERIE[f.series.scanne.statut]?.ton ?? "neutre"}>{t(STATUTS_SERIE[f.series.scanne.statut]?.libelle ?? f.series.scanne.statut)}</Badge></p>
              {f.series.scanne.venduAt && <p className="mt-1 text-[#666666]">{t("Acheté le {0}", jour(f.series.scanne.venduAt, t.loc))}{f.series.scanne.client ? ` · ${f.series.scanne.client}` : ""}</p>}
              {f.series.scanne.garantieFinAt && <p className="text-[#666666]">{t("Garantie jusqu'au {0}", jour(f.series.scanne.garantieFinAt, t.loc))}{new Date(f.series.scanne.garantieFinAt) < new Date() ? ` — ${t("expirée")}` : ""}</p>}
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {Object.keys(STATUTS_SERIE).filter((s) => f.series.compte[s]).map((s) => <Badge key={s} ton={STATUTS_SERIE[s].ton}>{t(STATUTS_SERIE[s].libelle)} : {f.series.compte[s]}</Badge>)}
            {!Object.keys(f.series.compte).length && <p className="text-[12.5px] text-[#888888]">{t("Aucun numéro enregistré pour cet article.")}</p>}
          </div>
          {f.series.liste.filter((s) => s.statut === "en_stock").length > 0 && (
            <p className="mt-2 break-all font-mono text-[11.5px] leading-relaxed text-[#555555]">{f.series.liste.filter((s) => s.statut === "en_stock").map((s) => s.numero).join(" · ")}</p>
          )}
          {f.garantieMois ? <p className="mt-2 text-[11.5px] text-[#666666]">{t("Garantie : {0} mois à compter de la vente.", f.garantieMois)}</p> : null}
        </Bloc>
      )}

      {complet && (
        <Bloc titre="Analyse des ventes et du réassort">
          <AnalyseArticle produitId={f.produitId} varianteId={f.varianteId} caisseId={caisseId} compact />
        </Bloc>
      )}

      {complet && f.champs.fournisseur && (
        <Bloc titre="Fournisseur" icone={<Truck size={13} aria-hidden />}>
          {f.fournisseur ? (
            <dl>
              <Paire libelle={f.fournisseur.principal ? "Fournisseur principal" : "Fournisseur"}>{f.fournisseur.nom}</Paire>
              {f.coutsVisibles && f.fournisseur.prix !== null && <Paire libelle="Prix annoncé">{f.fournisseur.prix.toLocaleString(t.loc)} {f.fournisseur.devise ?? ""}</Paire>}
              {f.fournisseur.moq ? <Paire libelle="Commande minimale">{f.fournisseur.moq.toLocaleString(t.loc)}</Paire> : null}
              {f.fournisseur.delaiJours ? <Paire libelle="Délai">{t("{0} jours", f.fournisseur.delaiJours)}</Paire> : null}
            </dl>
          ) : <p className="text-[12.5px] text-[#888888]">{t("Aucun fournisseur n'est rattaché à cet article.")}</p>}
        </Bloc>
      )}
    </div>
  );
}
