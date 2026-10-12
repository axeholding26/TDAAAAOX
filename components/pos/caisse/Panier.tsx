"use client";
// Panier de la caisse : lignes, totaux (sous-total, remises, taxes, frais,
// TOTAL), actions de vente et bouton PAYER. Les montants affichés viennent du
// panier CALCULÉ passé par l'écran (calcul local immédiat, puis confirmation du
// serveur) — ce composant ne calcule rien.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift, Lightbulb, Minus, Pause, Pencil, Play, Plus, RotateCcw, Tag, Trash2, User, Wallet, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/I18nProvider";
import { useDevise } from "@/components/dashboard/DeviseProvider";
import { Badge, Bouton, BoutonIcone, EtatVide, FOCUS } from "@/components/pos/ui";
import { libelleQuantite } from "@/lib/pos/tarification";
import type { ArticleResolu, PanierCalcule } from "@/lib/pos/types";
import { usePosStore } from "@/store/posStore";
import { appelPos } from "./api";

export type EtatCalcul = "confirme" | "attente" | "erreur";

export type ActionsPanier = {
  onModifier: (id: string) => void;
  onPayer: () => void;
  onClient: () => void;
  onRemise: () => void;
  onSuspendre: () => void;
  onReprendre: () => void;
  onAnnuler: () => void;
  onAjouter: (article: ArticleResolu) => void;
  /** Redemande au serveur la vérification du total (après une erreur ou une coupure). */
  onReverifier: () => void;
  /** Ouvre l'écran Retours ou Session de caisse (page du tableau de bord, ou onglet du kiosque). */
  onNaviguer: (ecran: "retours" | "session") => void;
};

export function Panier({ panier, etatCalcul, erreurCalcul, paiementDemande, modeSimple, droits, caisseId, ...a }: ActionsPanier & {
  panier: PanierCalcule;
  etatCalcul: EtatCalcul;
  erreurCalcul: { code: string; message: string } | null;
  /** PAYER a été demandé : la fenêtre de paiement s'ouvre dès que le serveur a vérifié le total. */
  paiementDemande: boolean;
  modeSimple: boolean;
  droits: { remise: boolean; suspendre_panier: boolean; retour: boolean };
  caisseId: string | null;
}) {
  const t = useT();
  const { fmt } = useDevise();
  const { lignes, client, remise, codePromo, modifier, retirer, definir } = usePosStore();
  const vide = lignes.length === 0;
  const bloquantes = panier.alertes.filter((x) => x.bloquant);
  // Pas d'encaissement sans total vérifié : hors ligne, la vente ne peut pas être enregistrée.
  const peutPayer = !vide && bloquantes.length === 0 && !erreurCalcul;

  const options = (
    <div className="grid grid-cols-2 gap-2">
      <Bouton variante="secondaire" taille="compact" onClick={a.onClient} icone={<User size={15} aria-hidden />} raccourci="F3">{t("Client")}</Bouton>
      <Bouton variante="secondaire" taille="compact" onClick={a.onRemise} disabled={vide} icone={<Tag size={15} aria-hidden />} raccourci="F4">{droits.remise ? t("Remise") : t("Code promo")}</Bouton>
      {droits.suspendre_panier && <Bouton variante="secondaire" taille="compact" onClick={a.onSuspendre} disabled={vide} icone={<Pause size={15} aria-hidden />} raccourci="F6">{t("Suspendre")}</Bouton>}
      <Bouton variante="secondaire" taille="compact" onClick={a.onReprendre} icone={<Play size={15} aria-hidden />} raccourci="F7">{t("Reprendre")}</Bouton>
      {droits.retour && <Bouton variante="secondaire" taille="compact" onClick={() => a.onNaviguer("retours")} icone={<RotateCcw size={15} aria-hidden />} raccourci="F8">{t("Retours")}</Bouton>}
      <Bouton variante="secondaire" taille="compact" onClick={() => a.onNaviguer("session")} icone={<Wallet size={15} aria-hidden />} raccourci="F9">{t("Caisse")}</Bouton>
      <Bouton variante="danger" taille="compact" onClick={a.onAnnuler} disabled={vide} icone={<X size={15} aria-hidden />} raccourci={t("Échap")} className="col-span-2">{t("Annuler la vente")}</Bouton>
    </div>
  );

  return (
    <section aria-label={t("Panier")} className="flex min-h-0 flex-1 flex-col">
      {client && (
        <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] px-3 py-1.5">
          <User size={15} className="flex-shrink-0 text-[#666666]" aria-hidden />
          <button type="button" onClick={a.onClient} className={cn("min-h-11 min-w-0 flex-1 text-left", FOCUS)}>
            <span className="block truncate text-[13px] font-semibold text-[#111111]">{client.nom}</span>
            <span className="block truncate text-[11px] text-[#666666]">{[client.telephone, client.niveauFidelite && client.pointsFidelite != null ? `${client.pointsFidelite} ${t("points")}` : null].filter(Boolean).join(" · ") || t("Client associé à la vente")}</span>
          </button>
          <BoutonIcone label={t("Retirer le client de la vente")} onClick={() => definir({ client: null })} className="border-transparent bg-transparent"><X size={16} aria-hidden /></BoutonIcone>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {vide ? (
          <EtatVide compact titre="Le panier est vide" texte="Scannez un article ou choisissez-le dans le catalogue." className="border-0" />
        ) : (
          <ul className="divide-y divide-[#F0F0F0]">
            {lignes.map((l, i) => {
              const c = panier.lignes[i];
              const kg = l.uniteVente === "kg";
              const fixe = kg || l.suiviSerie;
              return (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold leading-snug text-[#111111]">{l.nom || c?.nom}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[#666666]">
                        {l.variante && <span>{l.variante}</span>}
                        <span>{fmt(c?.prixApplique ?? l.prixUnitaire)}{kg ? " /kg" : ""}</span>
                        {l.numeroSerie && <span>{t("N° de série")} {l.numeroSerie}</span>}
                        {l.offert && <Badge ton="accent" icone={<Gift size={11} aria-hidden />}>{t("Offert")}</Badge>}
                        {c && !l.offert && c.remiseLigne > 0 && <Badge ton="accent">−{fmt(c.remiseLigne)}</Badge>}
                        {c && c.remisePromotion > 0 && <Badge ton="positif">{t("Promotion")} −{fmt(c.remisePromotion)}</Badge>}
                        {c && c.prixApplique !== c.prixUnitaire && <Badge ton="info">{t("Prix modifié")}</Badge>}
                        {l.stock !== null && l.quantite > l.stock && <Badge ton="attention">{t("Stock affiché : {0}", libelleQuantite(Math.max(0, l.stock), l.uniteVente))}</Badge>}
                      </p>
                      {l.commentaire && <p className="mt-0.5 text-[11.5px] italic text-[#666666]">« {l.commentaire} »</p>}
                    </div>
                    <p className="flex-shrink-0 text-right text-[13.5px] font-bold text-[#111111]">
                      {fmt(c ? c.brut - c.remiseLigne - c.remisePromotion : 0)}
                      {c && c.remiseLigne + c.remisePromotion > 0 && <span className="block text-[11px] font-normal text-[#999999] line-through">{fmt(c.brut)}</span>}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {fixe ? (
                      <button type="button" onClick={() => a.onModifier(l.id)} className={cn("min-h-11 rounded-xl border border-[#E8E8E8] bg-white px-3 text-[13px] font-bold", FOCUS)}>
                        {kg ? libelleQuantite(l.quantite, "kg") : t("1 unité")}
                      </button>
                    ) : (
                      <div className="flex items-center gap-1" role="group" aria-label={t("Quantité de {0}", l.nom)}>
                        <BoutonIcone label={t("Retirer une unité")} onClick={() => (l.quantite > 1 ? modifier(l.id, { quantite: l.quantite - 1 }) : retirer(l.id))}><Minus size={16} aria-hidden /></BoutonIcone>
                        <span aria-live="polite" className="min-w-9 text-center text-[15px] font-bold tabular-nums">{l.quantite}</span>
                        <BoutonIcone label={t("Ajouter une unité")} onClick={() => modifier(l.id, { quantite: l.quantite + 1 })}><Plus size={16} aria-hidden /></BoutonIcone>
                      </div>
                    )}
                    <span className="flex-1" />
                    <BoutonIcone label={t("Modifier la ligne {0}", l.nom)} onClick={() => a.onModifier(l.id)}><Pencil size={15} aria-hidden /></BoutonIcone>
                    <BoutonIcone label={t("Supprimer {0} du panier", l.nom)} variante="danger" onClick={() => retirer(l.id)}><Trash2 size={15} aria-hidden /></BoutonIcone>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {!modeSimple && !vide && <Suggestions caisseId={caisseId} onAjouter={a.onAjouter} />}
      </div>

      <div className="mt-2 border-t border-[#E8E8E8] pt-3">
        <dl className="space-y-1 text-[12.5px] text-[#555555]">
          <Total libelle={t("Sous-total")} valeur={fmt(panier.sousTotal)} />
          {(!modeSimple || panier.totalRemises > 0) && (
            <Total libelle={[t("Remises"), remise ? (remise.type === "pourcentage" ? `${remise.valeur} %` : null) : null, codePromo || null].filter(Boolean).join(" · ")} valeur={panier.totalRemises > 0 ? `−${fmt(panier.totalRemises)}` : fmt(0)} />
          )}
          {panier.taxesParTaux.length > 0
            ? panier.taxesParTaux.map((x) => <Total key={x.taux} libelle={t("TVA {0} %", +(x.taux * 100).toFixed(2))} valeur={fmt(x.montant)} />)
            : !modeSimple && <Total libelle={t("Taxes")} valeur={fmt(0)} />}
          {(!modeSimple || panier.frais > 0) && <Total libelle={t("Frais")} valeur={fmt(panier.frais)} />}
        </dl>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-[13px] font-bold uppercase tracking-wide text-[#111111]">{t("Total")}</span>
          <span className="text-[26px] font-bold leading-none tabular-nums text-[#111111]" aria-live="polite">{fmt(panier.total)}</span>
        </div>
        <p className="mt-1 min-h-4 text-right text-[11px] text-[#888888]" role="status">
          {vide ? "" : etatCalcul === "confirme" ? t("Total vérifié par le serveur")
            : erreurCalcul?.code === "hors_ligne" ? t("Total provisoire, non vérifié : l'encaissement reprendra au retour du réseau")
            : etatCalcul === "attente" ? t("Vérification du total…") : ""}
        </p>
        {erreurCalcul && erreurCalcul.code !== "hors_ligne" && !vide && (
          <p role="alert" className="mt-1 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12.5px] leading-snug text-[#B91C1C]">{t(erreurCalcul.message)}</p>
        )}
        {erreurCalcul && !vide && <Bouton variante="secondaire" taille="compact" large onClick={a.onReverifier} className="mt-1">{t("Vérifier de nouveau le total")}</Bouton>}
        {panier.alertes.map((x, i) => (
          <p key={i} role="alert" className={cn("mt-1 rounded-xl border px-3 py-2 text-[12.5px] leading-snug", x.bloquant ? "border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C]" : "border-[#FCD34D] bg-[#FFFBEB] text-[#B45309]")}>{t(x.message)}</p>
        ))}

        <Bouton taille="grand" large onClick={a.onPayer} disabled={!peutPayer} charge={paiementDemande && peutPayer} raccourci="F5" className="mt-3">{t("Payer")}</Bouton>

        {modeSimple ? (
          <details className="mt-2">
            <summary className={cn("flex min-h-11 cursor-pointer items-center justify-center rounded-xl text-[12.5px] font-semibold text-[#555555]", FOCUS)}>{t("Plus d'options")}</summary>
            <div className="pt-2">{options}</div>
          </details>
        ) : <div className="mt-2">{options}</div>}
      </div>
    </section>
  );
}

function Total({ libelle, valeur }: { libelle: string; valeur: string }) {
  return <div className="flex justify-between gap-3"><dt className="min-w-0 truncate">{libelle}</dt><dd className="flex-shrink-0 font-semibold tabular-nums text-[#111111]">{valeur}</dd></div>;
}

type Suggestion = { produitId: string; nom: string; prix: number; uniteVente?: "piece" | "kg"; stock: number; occurrences?: number; surCommandes?: number };

/**
 * Suggestions « souvent achetés ensemble » (/api/pos/suggestions) : une
 * ESTIMATION tirée de l'historique des ventes, présentée comme telle.
 * Bloc discret, jamais imposé : Ajouter ou Ignorer. Si la route n'existe pas
 * ou échoue, le bloc ne s'affiche pas — la vente n'en dépend jamais.
 */
function Suggestions({ caisseId, onAjouter }: { caisseId: string | null; onAjouter: (a: ArticleResolu) => void }) {
  const t = useT();
  const { fmt } = useDevise();
  const lignes = usePosStore((s) => s.lignes);
  const [articles, setArticles] = useState<Suggestion[]>([]);
  const [ajout, setAjout] = useState<string | null>(null);
  const [ignores, setIgnores] = useState<string[]>([]);
  const [eteint, setEteint] = useState(false);
  const ids = [...new Set(lignes.map((l) => l.produitId))].sort().join(",");

  useEffect(() => {
    if (eteint || !ids) return;
    const ctrl = new AbortController();
    const minuterie = setTimeout(async () => {
      const r = await appelPos<{ suggestions?: Suggestion[] }>(`/api/pos/suggestions?limite=4&produits=${encodeURIComponent(ids)}`, { caisseId, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (!r.ok) { if (r.code !== "hors_ligne" && r.code !== "annule") setEteint(true); return; }
      setArticles((r.donnees.suggestions ?? []).filter((x) => x && typeof x.produitId === "string" && typeof x.nom === "string" && typeof x.prix === "number"));
    }, 600);
    return () => { clearTimeout(minuterie); ctrl.abort(); };
  }, [ids, caisseId, eteint]);

  // La suggestion ne porte pas l'article complet (variantes, numéro de série…) : il est relu au catalogue à l'ajout.
  const ajouter = async (x: Suggestion) => {
    setAjout(x.produitId);
    const r = await appelPos<{ articles?: ArticleResolu[] }>(`/api/pos/articles?limite=100&q=${encodeURIComponent(x.nom.slice(0, 100))}`, { caisseId });
    setAjout(null);
    const article = r.ok ? r.donnees.articles?.find((a) => a.produitId === x.produitId) : null;
    if (!article) return toast.error(t("« {0} » n'a pas pu être ajouté. Recherchez-le dans le catalogue.", x.nom));
    onAjouter(article);
    setIgnores((v) => [...v, x.produitId]);
  };

  const visibles = articles.filter((x) => !ignores.includes(x.produitId) && !ids.split(",").includes(x.produitId)).slice(0, 2);
  if (eteint || visibles.length === 0) return null;
  return (
    <aside aria-label={t("Suggestions")} className="mt-2 space-y-1.5 rounded-xl border border-dashed border-[#FDE68A] bg-[#FFFBEB] p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#B45309]"><Lightbulb size={13} aria-hidden />{t("Souvent achetés ensemble")}<span className="font-normal normal-case tracking-normal text-[#888888]">· {t("estimation d'après vos ventes")}</span></p>
      {visibles.map((x) => {
        const stock = x.stock;
        return (
          <div key={x.produitId} className="flex items-center gap-2">
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-[#111111]">
              <span className="font-semibold">{x.nom}</span>
              <span className="block text-[11px] text-[#666666]">{fmt(x.prix)}{x.uniteVente === "kg" ? " /kg" : ""} · {stock > 0 ? t("En stock") : t("Rupture")}</span>
            </p>
            <Bouton variante="discret" taille="compact" onClick={() => ajouter(x)} charge={ajout === x.produitId}>{t("Ajouter")}</Bouton>
            <BoutonIcone label={t("Ignorer la suggestion {0}", x.nom)} onClick={() => setIgnores((v) => [...v, x.produitId])} className="border-transparent bg-transparent"><X size={15} aria-hidden /></BoutonIcone>
          </div>
        );
      })}
    </aside>
  );
}
