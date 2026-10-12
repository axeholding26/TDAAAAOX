"use client";
// Stocks & ruptures : prévision calculée sur les ventes réelles des 30 derniers
// jours (lib/sourcing/stocks.ts). Seuls les produits physiques ont un stock suivi.
import { AlertTriangle, PackageCheck } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import type { PrevisionStock } from "@/lib/sourcing/stocks";
import { Bouton, Carte, Chargement, Erreur, Estimation, EtatVide, Entete, Kpi, Page, Pastille, useApi, type Ton } from "@/components/dashboard/sourcing/ui";

const NIVEAUX: Record<PrevisionStock["niveau"], { libelle: string; ton: Ton; couleur: string }> = {
  rupture: { libelle: "En rupture", ton: "attention", couleur: "#B91C1C" },
  urgent: { libelle: "Urgent", ton: "attention", couleur: "#B91C1C" },
  a_surveiller: { libelle: "À surveiller", ton: "accent", couleur: "#B45309" },
  ok: { libelle: "Stock suffisant", ton: "positif", couleur: "#15803D" },
};

export default function PageStocks() {
  const t = useT();
  const { data, erreur, chargement } = useApi<{ previsions: PrevisionStock[] }>("/api/sourcing/stocks");
  const previsions = data?.previsions ?? [];
  const nombre = (n: PrevisionStock["niveau"]) => previsions.filter((p) => p.niveau === n).length;
  // Le plus urgent en premier.
  const ordre = ["rupture", "urgent", "a_surveiller", "ok"];
  const tries = [...previsions].sort((a, b) => ordre.indexOf(a.niveau) - ordre.indexOf(b.niveau));

  return (
    <Page>
      <Entete badge="AXSO Sourcing" titre="Stocks et ruptures"
        sousTitre="Quantité à commander = ventes par jour × (délai du fournisseur + 14 jours de sécurité) − stock restant. Calculé sur vos ventes réelles des 30 derniers jours." />

      {erreur && <Erreur message={erreur} />}
      {chargement && !data && <Chargement />}

      {data && previsions.length === 0 && (
        <EtatVide titre="Aucun stock à suivre"
          texte="Seuls les produits physiques ont un stock suivi. Vos produits en dropshipping restent chez le fournisseur : ils n'apparaissent pas ici.">
          <Bouton href="/dashboard/sourcing/expeditions" variante="secondaire">{t("Voir les expéditions")}</Bouton>
        </EtatVide>
      )}

      {previsions.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Kpi libelle="Ruptures" valeur={String(nombre("rupture"))} ton={nombre("rupture") ? "attention" : undefined} />
            <Kpi libelle="Urgences" valeur={String(nombre("urgent"))} ton={nombre("urgent") ? "attention" : undefined} />
            <Kpi libelle="À surveiller" valeur={String(nombre("a_surveiller"))} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {tries.map((p) => {
              const n = NIVEAUX[p.niveau];
              return (
                <Carte key={p.produitId}>
                  <div className="flex items-start gap-3">
                    {p.image
                      ? <img src={p.image} alt="" className="w-12 h-12 rounded-xl object-cover border border-[#E8E8E8] flex-shrink-0" />
                      : <div className="w-12 h-12 rounded-xl bg-[#F5F5F5] flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-bold text-[#111111] leading-snug">{p.nom}</p>
                        <Pastille ton={n.ton}>{t(n.libelle)}</Pastille>
                      </div>
                      {p.fournisseur && <p className="text-[11px] text-[#AAAAAA] mt-0.5">{t("Fournisseur : {0}", p.fournisseur)}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3 text-[12px]">
                    <div>
                      <p className="text-[#AAAAAA]">{t("En stock")}</p>
                      <p className="text-[16px] font-bold text-[#111111] tabular-nums">{p.stock}</p>
                    </div>
                    <div>
                      <p className="text-[#AAAAAA]">{t("Ventes par jour (30 derniers jours)")}</p>
                      <p className="text-[16px] font-bold text-[#111111] tabular-nums">{p.ventes30j > 0 ? p.ventesParJour.toLocaleString(t.loc) : "—"}</p>
                    </div>
                  </div>

                  <p className="flex items-center gap-1.5 mt-3 text-[13px] font-semibold" style={{ color: n.couleur }}>
                    {p.niveau === "ok" ? <PackageCheck size={14} /> : <AlertTriangle size={14} />}
                    {p.niveau === "rupture" ? t("En rupture de stock")
                      : p.joursRestants === null ? t("Aucune vente sur 30 jours : pas de rupture prévisible")
                      : t("Rupture estimée dans {0} jours", p.joursRestants)}
                  </p>
                  <p className="flex items-center gap-1.5 flex-wrap mt-1 text-[12px] text-[#666666]">
                    {p.delaiConnu
                      ? t("Délai de réapprovisionnement : {0} jours", p.delaiReappro)
                      : <>{t("Délai de réapprovisionnement : 15 jours par défaut")} <Estimation /></>}
                  </p>

                  {p.aCommander > 0 && (
                    <div className="mt-3 rounded-xl bg-[#FFF7ED] border border-[#FDE68A] p-3">
                      <p className="text-[13px] font-bold text-[#111111]">{t("Commander {0} unités maintenant", p.aCommander)}</p>
                      <div className="flex gap-2 flex-wrap mt-2">
                        <Bouton href="/dashboard/sourcing/expeditions" petit>{t("Créer un réapprovisionnement")}</Bouton>
                        {p.sourceId && <Bouton href={`/dashboard/sourcing/produits/${p.sourceId}`} variante="secondaire" petit>{t("Fiche sourcing")}</Bouton>}
                      </div>
                    </div>
                  )}
                </Carte>
              );
            })}
          </div>
        </>
      )}
    </Page>
  );
}
